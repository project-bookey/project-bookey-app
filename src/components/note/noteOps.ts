/**
 * 노트 연산 — 모임 공유 노트가 서버·다른 멤버와 주고받는 단위.
 *
 * 요소 id 기준 두 가지뿐이다: upsert(같은 id 를 통째로 바꾸거나 새로 붙임) · delete. 같은 연산을 두 번 적용해도
 * 결과가 같아서(멱등) 연결이 끊겨 다시 보내도 안전하다. 같은 요소를 둘이 고치면 서버에 나중에 닿은 쪽이 이긴다.
 * 서버(MeetingNoteOps)도 같은 규칙으로 저장된 문서에 적용한다.
 */
import {
  DOC_VERSION, parseNoteElement, parseNoteElements, type NoteDoc, type NoteElement,
} from './noteDoc';

export type NoteOp = { t: 'upsert'; el: NoteElement } | { t: 'delete'; id: string };

/** 모임 노트는 언제나 대형노트(도트 종이) 한 장이다. */
export function emptyMeetingNoteDoc(): NoteDoc {
  return { v: DOC_VERSION, paper: 'grid', kind: 'large', elements: [] };
}

/** 서버의 불투명 document 를 대형노트 한 장으로 좁힌다. 절대 throw 하지 않는다. */
export function parseMeetingNoteDoc(raw: unknown): NoteDoc {
  const elements = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? parseNoteElements((raw as Record<string, unknown>).elements)
    : [];
  return { ...emptyMeetingNoteDoc(), elements };
}

/**
 * before → after 로 가는 연산. 요소는 참조로 견준다 — 편집기는 바뀐 요소만 새 객체로 만들기 때문에 싸고 정확하다.
 * 바뀐 요소는 문서 순서대로, 지운 요소는 그 뒤에.
 */
export function diffOps(before: NoteDoc, after: NoteDoc): NoteOp[] {
  if (before === after) return [];
  const prev = new Map<string, NoteElement>();
  for (const e of before.elements) prev.set(e.id, e);
  const ops: NoteOp[] = [];
  const seen = new Set<string>();
  for (const e of after.elements) {
    seen.add(e.id);
    if (prev.get(e.id) !== e) ops.push({ t: 'upsert', el: e });
  }
  for (const id of prev.keys()) if (!seen.has(id)) ops.push({ t: 'delete', id });
  return ops;
}

/** 연산을 적용한 새 문서. 있던 요소는 제자리에서 바꾸고, 새 요소는 뒤에 붙인다. 바뀐 게 없으면 같은 문서. */
export function applyOps(doc: NoteDoc, ops: readonly NoteOp[]): NoteDoc {
  if (ops.length === 0) return doc;
  const upserts = new Map<string, NoteElement>();
  const deletes = new Set<string>();
  for (const op of ops) {
    if (op.t === 'upsert') {
      upserts.set(op.el.id, op.el);
      deletes.delete(op.el.id);
    } else {
      deletes.add(op.id);
      upserts.delete(op.id);
    }
  }
  let changed = false;
  const elements: NoteElement[] = [];
  for (const e of doc.elements) {
    if (deletes.has(e.id)) {
      changed = true;
      continue;
    }
    const next = upserts.get(e.id);
    if (next) {
      upserts.delete(e.id);
      if (next !== e) changed = true;
      elements.push(next);
    } else {
      elements.push(e);
    }
  }
  for (const e of upserts.values()) {
    changed = true;
    elements.push(e);
  }
  return changed ? { ...doc, elements } : doc;
}

/** 서버·다른 멤버가 보낸 연산을 좁힌다 — 깨진 연산은 버린다. */
export function parseOps(raw: unknown): NoteOp[] {
  if (!Array.isArray(raw)) return [];
  const ops: NoteOp[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (r.t === 'upsert') {
      const el = parseNoteElement(r.el);
      if (el) ops.push({ t: 'upsert', el });
    } else if (r.t === 'delete' && typeof r.id === 'string') {
      ops.push({ t: 'delete', id: r.id });
    }
  }
  return ops;
}

/** 보낼 JSON — undefined 필드를 걷어낸 깊은 사본. */
export function serializeOps(ops: readonly NoteOp[]): unknown[] {
  return JSON.parse(JSON.stringify(ops)) as unknown[];
}
