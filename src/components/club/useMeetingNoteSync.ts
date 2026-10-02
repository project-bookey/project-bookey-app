import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, currentAccessToken, wsUrlOf } from '@/api/client';
import { meetingNoteApi, meetingNoteSocketPath } from '@/api/endpoints';
import {
  applyOps, diffOps, newId, parseMeetingNoteDoc, parseOps, serializeOps,
  type NoteDoc, type NoteEditor, type NoteElement, type NoteOp,
} from '@/components/note';
import { notify } from './dialogs';

/** 모임 노트 캐시 키 — 노트 화면·클럽 피드가 같이 쓴다. */
export const meetingNoteKey = (clubId: number, meetingId: number) => ['meetingNote', clubId, meetingId] as const;
/** 클럽 모임 노트 피드 캐시 키. */
export const meetingNotesKey = (clubId: number) => ['meetingNotes', clubId] as const;

/** live: 실시간 연결 중 · connecting: 처음 붙는 중 · offline: 끊김(자동 저장은 REST 로, 남의 편집은 5초마다 받아 온다). */
export type MeetingNoteSyncStatus = 'connecting' | 'live' | 'offline';

/** 지금 같은 노트를 보고 있는 다른 연결. x·y 는 그 사람이 보고 있는 곳(논리 좌표). */
export type MeetingNotePeer = {
  peer: string;
  userId: number;
  nickname: string;
  avatarUrl?: string;
  x?: number;
  y?: number;
  tool?: string;
  seenAt: number;
};

/** 내가 보고 있는 곳 — 화면이 줌 무대의 가운데와 도구를 알려 준다. */
export type MeetingNotePresence = { x: number; y: number; tool: string } | null;

/** 편집을 모아 보내는 간격 — 드래그·타이핑 중에도 이 간격으로 남에게 보인다. */
const SEND_THROTTLE_MS = 250;
/** 서버가 한 번에 받는 연산 수(MeetingNoteOps.MAX_OPS). */
const OPS_PER_BATCH = 200;
const POLL_MS = 5_000;
const PING_MS = 25_000;
const PRESENCE_TICK_MS = 1_500;
const PRESENCE_HEARTBEAT_MS = 8_000;
const PEER_TTL_MS = 25_000;
const ACK_TIMEOUT_MS = 8_000;
const RETRY_MS = 2_000;
const BACKOFF_MAX_MS = 15_000;
/** 인증 실패로 닫혔을 때의 이유 — 토큰을 갱신해 다시 붙는다. */
const TOKEN_CODES = new Set(['EXPIRED_TOKEN', 'INVALID_TOKEN']);
/** 다시 보내도 결과가 같은 실패 — 그 묶음은 버리고 서버 상태로 맞춘다. */
const PERMANENT_STATUS = new Set([400, 403, 404, 409, 413]);

/** 연산 묶음 전송 실패. permanent 면 다시 보내지 않는다. */
class SyncError extends Error {
  constructor(readonly code: string, message: string, readonly permanent: boolean) {
    super(message);
  }
}

type Batch = { seq: number; ops: NoteOp[] };
type Ack = { resolve: (version: number) => void; reject: (e: SyncError) => void };

const sameElement = (a: NoteElement, b: NoteElement) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** 내용까지 견준 연산 — 서버에서 새로 받은 문서는 요소가 모두 새 객체라 참조로는 다 바뀐 것처럼 보인다. */
function deepDiffOps(before: NoteDoc, after: NoteDoc): NoteOp[] {
  const prev = new Map(before.elements.map((e) => [e.id, e] as const));
  return diffOps(before, after).filter((op) => {
    if (op.t !== 'upsert') return true;
    const was = prev.get(op.el.id);
    return !was || !sameElement(was, op.el);
  });
}

/** base 의 요소 중 doc 과 내용이 같은 것은 doc 의 객체로 — 다음 참조 비교(diffOps)가 정말 바뀐 것만 잡게. */
function alignRefs(base: NoteDoc, doc: NoteDoc): NoteDoc {
  const mine = new Map(doc.elements.map((e) => [e.id, e] as const));
  return {
    ...base,
    elements: base.elements.map((e) => {
      const d = mine.get(e.id);
      return d && sameElement(d, e) ? d : e;
    }),
  };
}

function chunk(ops: NoteOp[]): NoteOp[][] {
  const out: NoteOp[][] = [];
  for (let i = 0; i < ops.length; i += OPS_PER_BATCH) out.push(ops.slice(i, i + OPS_PER_BATCH));
  return out;
}

function toSyncError(e: unknown): SyncError {
  if (e instanceof SyncError) return e;
  if (e instanceof ApiError) return new SyncError(e.code, e.message, PERMANENT_STATUS.has(e.status));
  return new SyncError('NETWORK', '연결이 끊겼어요', false);
}

/**
 * 모임 공유 노트 동기화 — 편집기 문서를 서버·다른 멤버와 맞춘다.
 *
 * - 내 편집: 문서가 바뀌면 SEND_THROTTLE_MS 간격으로 '마지막으로 맞춘 문서(synced)' 와의 차이를 연산으로 만들어
 *   보낸다. 실시간 연결이 살아 있으면 웹소켓으로(ack 를 기다림), 아니면 REST 로. 보내지 못한 묶음은 순서대로 다시 보낸다.
 * - 남의 편집: 웹소켓으로 받은 연산을 편집기에 얹는다(되돌리기 건을 만들지 않는다). 연결이 끊기면 5초마다 노트를 다시 받아
 *   '서버 문서 + 아직 안 간 내 연산' 으로 맞춘다(resync). version 이 건너뛰었거나, 내가 아직 보내는 중인 요소를
 *   남이 고쳤을 때도 resync 로 서버 결과에 맞춘다 — 같은 요소를 둘이 고치면 서버에 나중에 닿은 쪽이 이긴다.
 * - 누가 보고 있는지(presence): 몇 초마다 내가 보는 곳을 보내고, 남의 것은 25초 소식이 없으면 지운다.
 */
export function useMeetingNoteSync({ clubId, meetingId, editor, initialVersion, readOnly, onReadOnly, getPresence }: {
  clubId: number;
  meetingId: number;
  editor: NoteEditor;
  initialVersion: number;
  readOnly: boolean;
  /** 서버가 읽기 전용이라고 알려 왔을 때(클럽이 끝났거나 모임이 취소됨). */
  onReadOnly: () => void;
  getPresence: () => MeetingNotePresence;
}) {
  const [clientId] = useState(newId);
  const [status, setStatus] = useState<MeetingNoteSyncStatus>('connecting');
  const [saving, setSaving] = useState(false);
  const [peers, setPeers] = useState<Record<string, MeetingNotePeer>>({});

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const latest = useRef({ readOnly, onReadOnly, getPresence });
  latest.current = { readOnly, onReadOnly, getPresence };

  /** 마지막으로 서버와 맞춘 문서 + 이미 묶어 둔 내 연산. 편집기 문서와의 차이가 아직 안 보낸 내 편집이다. */
  const syncedRef = useRef<NoteDoc>(editor.docRef.current);
  const versionRef = useRef(initialVersion);
  const outbox = useRef<Batch[]>([]);
  const seqRef = useRef(0);
  const pumping = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acks = useRef(new Map<number, Ack>());
  const socketRef = useRef<WebSocket | null>(null);
  const liveRef = useRef(false);
  const alive = useRef(true);
  const resyncing = useRef(false);
  const resyncAgain = useRef(false);
  /** 내가 보내는 중인 요소를 남이 고쳤다 — 보내기가 끝나면 서버 결과로 맞춘다. */
  const resyncAfterDrain = useRef(false);

  const bumpVersion = (v: unknown) => {
    if (typeof v === 'number' && v > versionRef.current) versionRef.current = v;
  };

  // ────────────────────────────── 서버 상태로 맞추기 ──────────────────────────────

  const resync = useCallback(async () => {
    if (resyncing.current) {
      resyncAgain.current = true;
      return;
    }
    resyncing.current = true;
    try {
      const note = await meetingNoteApi.get(clubId, meetingId);
      if (!alive.current) return;
      if (note.readOnly && !latest.current.readOnly) latest.current.onReadOnly();
      // 서버 문서 위에 아직 서버에 닿지 않은 내 묶음, 그 위에 아직 묶지 않은 내 편집.
      let base = parseMeetingNoteDoc(note.document);
      for (const batch of outbox.current) base = applyOps(base, batch.ops);
      const ed = editorRef.current;
      const doc = ed.docRef.current;
      const unsent = diffOps(syncedRef.current, doc);
      const target = applyOps(base, unsent);
      ed.applyRemote(deepDiffOps(doc, target));
      syncedRef.current = alignRefs(base, ed.docRef.current);
      versionRef.current = Math.max(versionRef.current, note.version);
    } catch {
      // 오프라인 — 다음 폴링·재연결 때 다시 한다.
    } finally {
      resyncing.current = false;
      if (resyncAgain.current) {
        resyncAgain.current = false;
        void resync();
      }
    }
  }, [clubId, meetingId]);

  /** 남의 연산 — synced 와 편집기 양쪽에 얹는다. 내가 보내는 중인 요소면 건너뛰고 나중에 서버 결과로 맞춘다. */
  const applyRemote = useCallback((ops: NoteOp[]) => {
    const pending = new Set<string>();
    for (const batch of outbox.current) for (const op of batch.ops) pending.add(op.t === 'upsert' ? op.el.id : op.id);
    for (const op of diffOps(syncedRef.current, editorRef.current.docRef.current)) {
      pending.add(op.t === 'upsert' ? op.el.id : op.id);
    }
    const clean = ops.filter((op) => !pending.has(op.t === 'upsert' ? op.el.id : op.id));
    if (clean.length < ops.length) resyncAfterDrain.current = true;
    syncedRef.current = applyOps(syncedRef.current, clean);
    editorRef.current.applyRemote(clean);
  }, []);

  // ────────────────────────────── 내 편집 보내기 ──────────────────────────────

  const sendViaSocket = useCallback((batch: Batch) => new Promise<number>((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket || !liveRef.current) {
      reject(new SyncError('OFFLINE', '연결이 끊겼어요', false));
      return;
    }
    const timer = setTimeout(() => {
      acks.current.delete(batch.seq);
      reject(new SyncError('TIMEOUT', '응답이 없어요', false));
    }, ACK_TIMEOUT_MS);
    acks.current.set(batch.seq, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    socket.send(JSON.stringify({ type: 'ops', seq: batch.seq, ops: serializeOps(batch.ops) }));
  }), []);

  const sendBatch = useCallback(async (batch: Batch): Promise<number> => {
    if (liveRef.current) {
      try {
        return await sendViaSocket(batch);
      } catch (e) {
        const err = toSyncError(e);
        if (err.permanent) throw err;
        // 소켓이 막 끊겼거나 응답이 늦다 — 같은 묶음을 REST 로. 다시 보내도 결과가 같다.
      }
    }
    try {
      return (await meetingNoteApi.applyOps(clubId, meetingId, serializeOps(batch.ops), clientId)).version;
    } catch (e) {
      throw toSyncError(e);
    }
  }, [clubId, meetingId, clientId, sendViaSocket]);

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    try {
      while (alive.current && outbox.current.length > 0) {
        const batch = outbox.current[0];
        try {
          bumpVersion(await sendBatch(batch));
          outbox.current.shift();
        } catch (e) {
          const err = toSyncError(e);
          if (!err.permanent) {
            // 잠시 뒤 같은 묶음부터 다시.
            retryTimer.current = setTimeout(() => void pump(), RETRY_MS);
            break;
          }
          if (err.code === 'MEETING_NOTE_READ_ONLY') {
            outbox.current = [];
            latest.current.onReadOnly();
          } else {
            outbox.current.shift();
            notify(err.message);
          }
          resyncAfterDrain.current = true;
        }
      }
    } finally {
      pumping.current = false;
      if (alive.current) {
        setSaving(outbox.current.length > 0);
        if (outbox.current.length === 0 && resyncAfterDrain.current) {
          resyncAfterDrain.current = false;
          void resync();
        }
      }
    }
  }, [sendBatch, resync]);

  /** 아직 안 보낸 내 편집을 묶어 보낸다. */
  const flush = useCallback(() => {
    if (sendTimer.current) {
      clearTimeout(sendTimer.current);
      sendTimer.current = null;
    }
    if (latest.current.readOnly) return;
    const doc = editorRef.current.docRef.current;
    const ops = diffOps(syncedRef.current, doc);
    syncedRef.current = doc;
    if (ops.length === 0) return;
    for (const part of chunk(ops)) outbox.current.push({ seq: ++seqRef.current, ops: part });
    setSaving(true);
    void pump();
  }, [pump]);

  // 문서가 바뀌면(내 편집이든 남의 편집이든) 잠깐 모았다가 차이만 보낸다 — 남의 편집이면 차이가 없어 아무것도 안 간다.
  useEffect(() => {
    if (readOnly || editor.doc === syncedRef.current || sendTimer.current) return;
    sendTimer.current = setTimeout(() => {
      sendTimer.current = null;
      flush();
    }, SEND_THROTTLE_MS);
  }, [editor.doc, readOnly, flush]);

  // ────────────────────────────── 실시간 연결 ──────────────────────────────

  useEffect(() => {
    alive.current = true;
    let stopped = false;
    let attempt = 0;
    let refreshToken = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const rejectAcks = () => {
      for (const ack of acks.current.values()) ack.reject(new SyncError('OFFLINE', '연결이 끊겼어요', false));
      acks.current.clear();
    };

    const handle = (raw: unknown) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }
      switch (msg.type) {
        case 'ready': {
          liveRef.current = true;
          attempt = 0;
          setStatus('live');
          if (msg.readOnly === true && !latest.current.readOnly) latest.current.onReadOnly();
          // 끊긴 사이 놓친 편집이 있으면 받아 온다.
          if (msg.version !== versionRef.current) void resync();
          void pump();
          return;
        }
        case 'ops': {
          if (msg.clientId === clientId) {
            bumpVersion(msg.version);
            return;
          }
          const v = typeof msg.version === 'number' ? msg.version : null;
          // 번호가 건너뛰었거나 늦게 도착했으면 얹은 뒤 서버 결과로 한 번 더 맞춘다.
          const outOfOrder = v === null || v !== versionRef.current + 1;
          applyRemote(parseOps(msg.ops));
          bumpVersion(v);
          if (outOfOrder) void resync();
          return;
        }
        case 'ack': {
          const ack = typeof msg.seq === 'number' ? acks.current.get(msg.seq) : undefined;
          if (ack && typeof msg.version === 'number') {
            acks.current.delete(msg.seq as number);
            ack.resolve(msg.version);
          }
          return;
        }
        case 'error': {
          const code = typeof msg.code === 'string' ? msg.code : 'UNKNOWN';
          const message = typeof msg.message === 'string' ? msg.message : '노트를 저장하지 못했어요';
          const ack = typeof msg.seq === 'number' ? acks.current.get(msg.seq) : undefined;
          if (ack) {
            acks.current.delete(msg.seq as number);
            ack.reject(new SyncError(code, message, code !== 'RATE_LIMITED' && code !== 'INTERNAL_ERROR'));
          } else if (TOKEN_CODES.has(code)) {
            refreshToken = true;
          }
          return;
        }
        case 'presence': {
          const user = msg.user as { userId?: unknown; nickname?: unknown; avatarUrl?: unknown } | undefined;
          if (typeof msg.peer !== 'string' || typeof user?.userId !== 'number') return;
          const peer: MeetingNotePeer = {
            peer: msg.peer,
            userId: user.userId,
            nickname: typeof user.nickname === 'string' ? user.nickname : '멤버',
            avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : undefined,
            x: typeof msg.x === 'number' ? msg.x : undefined,
            y: typeof msg.y === 'number' ? msg.y : undefined,
            tool: typeof msg.tool === 'string' ? msg.tool : undefined,
            seenAt: Date.now(),
          };
          setPeers((prev) => ({ ...prev, [peer.peer]: peer }));
          return;
        }
        case 'leave': {
          if (typeof msg.peer !== 'string') return;
          const gone = msg.peer;
          setPeers((prev) => {
            if (!(gone in prev)) return prev;
            const next = { ...prev };
            delete next[gone];
            return next;
          });
          return;
        }
        default:
      }
    };

    const schedule = () => {
      if (stopped) return;
      const delay = Math.min(1000 * 2 ** attempt, BACKOFF_MAX_MS);
      attempt += 1;
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      reconnectTimer = null;
      if (stopped || socketRef.current) return;
      const token = await currentAccessToken(refreshToken).catch(() => null);
      refreshToken = false;
      if (stopped) return;
      if (!token) {
        schedule();
        return;
      }
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrlOf(meetingNoteSocketPath(clubId, meetingId)));
      } catch {
        schedule();
        return;
      }
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token, clientId }));
      socket.onmessage = (ev) => handle(ev.data);
      socket.onerror = () => {
        // 곧 onclose 가 따라온다.
      };
      socket.onclose = (ev) => {
        if (socketRef.current === socket) socketRef.current = null;
        liveRef.current = false;
        rejectAcks();
        if (stopped) return;
        setPeers({});
        setStatus('offline');
        if (TOKEN_CODES.has(ev.reason)) refreshToken = true;
        // 멤버가 아니게 됐거나 모임이 없어진 경우(1008 + 다른 이유)는 다시 붙어도 같다 — REST 폴링만 남긴다.
        const permanent = ev.code === 1008 && ev.reason !== 'auth timeout' && !TOKEN_CODES.has(ev.reason);
        if (!permanent) schedule();
      };
    };

    void connect();

    const ping = setInterval(() => {
      const socket = socketRef.current;
      if (socket && liveRef.current) socket.send(JSON.stringify({ type: 'ping' }));
    }, PING_MS);

    // 끊겨 있는 동안은 폴링으로 남의 편집을 받고, 밀린 내 묶음도 다시 보낸다.
    const poll = setInterval(() => {
      if (liveRef.current) return;
      void resync();
      if (outbox.current.length > 0) void pump();
    }, POLL_MS);

    // 내가 보는 곳 — 바뀌었거나 오래됐으면 보낸다. 남의 것은 소식이 끊기면 지운다.
    let lastPresence = '';
    let lastPresenceAt = 0;
    const presence = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => {
        const stale = Object.values(prev).filter((p) => now - p.seenAt > PEER_TTL_MS);
        if (stale.length === 0) return prev;
        const next = { ...prev };
        for (const p of stale) delete next[p.peer];
        return next;
      });
      const socket = socketRef.current;
      if (!socket || !liveRef.current) return;
      const p = latest.current.getPresence();
      const payload = p ? { type: 'presence', x: Math.round(p.x), y: Math.round(p.y), tool: p.tool } : { type: 'presence' };
      const key = JSON.stringify(payload);
      if (key === lastPresence && now - lastPresenceAt < PRESENCE_HEARTBEAT_MS) return;
      lastPresence = key;
      lastPresenceAt = now;
      socket.send(key);
    }, PRESENCE_TICK_MS);

    // 앱이 뒤로 가면 밀린 편집을 바로 보내고, 돌아오면 놓친 것을 받고 다시 붙는다.
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        flush();
        return;
      }
      void resync();
      if (!socketRef.current) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        attempt = 0;
        void connect();
      }
    });

    return () => {
      stopped = true;
      alive.current = false;
      liveRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (sendTimer.current) clearTimeout(sendTimer.current);
      clearInterval(ping);
      clearInterval(poll);
      clearInterval(presence);
      appState.remove();
      rejectAcks();
      socketRef.current?.close();
      socketRef.current = null;
      // 떠나기 전에 남은 편집을 REST 로 마저 보낸다(화면은 이미 없으니 결과는 보지 않는다).
      const leftover = [
        ...outbox.current.flatMap((b) => b.ops),
        ...diffOps(syncedRef.current, editorRef.current.docRef.current),
      ];
      outbox.current = [];
      if (!latest.current.readOnly && leftover.length > 0) {
        // 순서대로 — 같은 요소를 고친 묶음이 뒤바뀌지 않게.
        void chunk(leftover).reduce<Promise<unknown>>(
          (prev, part) => prev.then(() => meetingNoteApi.applyOps(clubId, meetingId, serializeOps(part), clientId)),
          Promise.resolve(),
        ).catch(() => undefined);
      }
    };
  }, [clubId, meetingId, clientId, applyRemote, flush, pump, resync]);

  return { status, saving, peers: Object.values(peers), flush, resync };
}
