import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Undo2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { clubApi, clubCommunityApi, meetingNoteApi } from '@/api/endpoints';
import type { MeetingNote } from '@/api/types';
import { confirmAsync, notify } from '@/components/club';
import {
  meetingNoteKey, meetingNotesKey, useMeetingNoteSync, type MeetingNotePeer, type MeetingNoteSyncStatus,
} from '@/components/club/useMeetingNoteSync';
import { ICON_SIZE, IconButton, PaperScreen, SubHeader } from '@/components/collage';
import {
  NoteCanvas, ZoomControls, ZoomStage, applyPreview, canvasFor, contentBounds, parseMeetingNoteDoc, useInkGesture,
  useNoteEditor, useNoteInserts, useNotePhotos, useNoteSelection, useNoteZoom,
  type LiveStroke, type NoteSpeaker, type PenState, type PlacedElement, type ZoomHome,
} from '@/components/note';
import { EditableElementView } from '@/components/note/EditableElementView';
import { InkGestureLayer } from '@/components/note/InkGestureLayer';
import { ToolIcon } from '@/components/note/NoteIcons';
import { NoteToolbar, type InsertKind, type NoteTool } from '@/components/note/NoteToolbar';
import { PageTapLayer } from '@/components/note/PageTapLayer';
import { PendingPhotos } from '@/components/note/PendingPhotos';
import { SelectionFrame } from '@/components/note/SelectionFrame';
import { StickerSheet, type StickerBook } from '@/components/note/StickerSheet';
import { TextEditorSheet } from '@/components/note/TextEditorSheet';
import { Avatar } from '@/components/Avatar';
import { Button, EmptyState, Loading } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { layout, radius, serif, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/** 모임 노트 도구 줄의 삽입 — 텍스트·스티커·사진·말풍선. */
const MEETING_NOTE_INSERTS: readonly InsertKind[] = ['text', 'sticker', 'photo', 'speech'];
const CANVAS = canvasFor('large');
/** 사진 상한 — 여럿이 함께 쓰는 노트라 한 사람이 다 쓰지 않게 하는 정도. */
const NOTE_IMAGE_MAX = 30;
/** 함께 보는 사람 아바타는 이만큼만 겹쳐 보이고 나머지는 숫자로. */
const PEER_AVATAR_MAX = 4;

/** 읽기만 되는 까닭 — 마무리했거나, 클럽이 끝났거나 모임이 취소됐거나, 연결 중에 알게 돼 까닭을 모를 때. */
type Lock = 'closed' | 'over' | 'guest' | 'unknown';
const LOCK_TEXT: Record<Lock, string> = {
  closed: '마무리한 노트예요. 이제 볼 수만 있어요.',
  over: '끝난 클럽이나 취소된 모임의 노트는 볼 수만 있어요.',
  guest: '노트는 모임에 참여한 사람만 쓸 수 있어요. 지금은 볼 수만 있어요.',
  unknown: '이 노트는 이제 볼 수만 있어요.',
};

/**
 * 모임 공유 노트 — 모임 하나에 대형노트 한 권, 클럽 멤버가 함께 꾸민다. 함께 독서를 끝내면 여기로 온다.
 * 노트를 한 번 받아 온 뒤 편집기를 세우고, 그다음부터는 동기화 훅이 실시간 연결·자동 저장으로 맞춘다
 * (편집기는 마운트 때 한 번만 시드를 읽는다).
 */
export default function MeetingNoteScreen() {
  const { id, meetingId } = useLocalSearchParams<{ id: string; meetingId: string }>();
  const clubId = Number(id);
  const mid = Number(meetingId);
  const note = useQuery({
    queryKey: meetingNoteKey(clubId, mid),
    queryFn: () => meetingNoteApi.get(clubId, mid),
    // 남이 고친 노트를 늘 새로 받는다 — 열린 뒤에는 동기화 훅이 맞춘다.
    staleTime: 0,
    gcTime: 0,
    enabled: Number.isFinite(clubId) && Number.isFinite(mid),
  });

  if (note.isLoading) return <Shell><Loading /></Shell>;
  if (!note.data) {
    const gone = note.error instanceof ApiError && (note.error.status === 404 || note.error.status === 403);
    return (
      <Shell>
        <EmptyState
          title="모임 노트를 열지 못했어요"
          description={note.error instanceof ApiError ? note.error.message : '잠시 후 다시 시도해 주세요.'}
          action={gone ? undefined : (
            <Button label="다시 시도" variant="outline" onPress={() => note.refetch()} />
          )}
        />
      </Shell>
    );
  }
  return <MeetingNoteEditor key={`${clubId}-${mid}`} clubId={clubId} meetingId={mid} note={note.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <PaperScreen>
      <SubHeader category="모임 노트" />
      {children}
    </PaperScreen>
  );
}

/**
 * 편집기 본체 — 대형노트 한 장을 줌 무대 위에 올리고, 노트 도구(보기·선택·펜·지우개 + 삽입)를 쓴다.
 * 위에는 모임 제목·함께 보는 사람·동기화 상태, 종이 위에는 다른 멤버가 보고 있는 곳을 이름표로 띄운다.
 * 도구 줄 위에는 '저장하고 나가기'를 늘 두어 어떻게 나가는지 헤매지 않게 하고, 모임을 연 사람에게는
 * '노트 마무리'를 함께 둔다 — 마무리하면 모두 읽기만 되고 노트 탭에 완성본으로 남는다.
 */
function MeetingNoteEditor({ clubId, meetingId, note }: { clubId: number; meetingId: number; note: MeetingNote }) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [seed] = useState(() => parseMeetingNoteDoc(note.document));
  // 나가면 클럽 '노트' 탭 격자가 새 썸네일을 받게 한다.
  useEffect(() => () => {
    void queryClient.invalidateQueries({ queryKey: meetingNotesKey(clubId) });
  }, [queryClient, clubId]);
  const editor = useNoteEditor(seed);
  // 서버는 참여하지 않은 사람에게도 readOnly 를 켠다 — 그때는 attending 으로 이유를 가른다.
  const [lock, setLock] = useState<Lock | null>(
    note.closedAt ? 'closed' : !note.attending ? 'guest' : note.readOnly ? 'over' : null,
  );
  const readOnly = lock !== null;
  const [busy, setBusy] = useState<'leaving' | 'closing' | null>(null);

  // 말풍선 화자 — 나, 또는 클럽 멤버 중에서(클럽 홈과 같은 캐시 키).
  const me = useAuth((s) => s.user);
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId) });
  const members = club.data?.members ?? [];
  const speaker: NoteSpeaker | undefined = members.find((m) => m.isMe)
    ?? (me ? { userId: me.id, nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined);
  // 책 스티커 — 이 모임의 책, 고르지 않은 모임이면 클럽이 지금 읽는 책(모임 상세와 같은 캐시 키).
  const meeting = useQuery({
    queryKey: ['clubMeeting', clubId, meetingId],
    queryFn: () => clubCommunityApi.meeting(clubId, meetingId),
    enabled: !readOnly,
  });
  const stickerBook = ((): StickerBook => {
    if (meeting.data?.book) return { state: 'ready', book: meeting.data.book, label: '이 모임의 책' };
    if (meeting.isLoading || club.isLoading) return { state: 'loading' };
    if (meeting.isError || club.isError) {
      return {
        state: 'error',
        retry: () => {
          if (meeting.isError) void meeting.refetch();
          if (club.isError) void club.refetch();
        },
      };
    }
    if (club.data?.book) return { state: 'ready', book: club.data.book, label: '클럽이 지금 읽는 책' };
    return { state: 'none' };
  })();

  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<NoteTool>('hand');
  const [pen, setPen] = useState<PenState>({ color: 'ink', width: 8 });
  const [live, setLive] = useState<LiveStroke | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // 처음 모습 — 붙인 것들의 가운데(비었으면 종이 한가운데)를 100% 로.
  const home = useCallback((): ZoomHome => {
    const b = contentBounds(editor.docRef.current);
    return { center: b ? [b.x + b.w / 2, b.y + b.h / 2] : [CANVAS.w / 2, CANVAS.h / 2] };
  }, [editor.docRef]);
  const zoom = useNoteZoom({
    kind: 'large',
    viewport: { w: stage?.w ?? 0, h: stage?.h ?? 0 },
    fitInset: { x: spacing.lg, y: spacing.lg },
    maxFitWidth: layout.content.maxWidth - spacing.lg * 2,
    alignTop: true,
    panEnabled: tool === 'hand',
    home,
  });
  const scale = zoom.scale;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const onReadOnly = useCallback((reason?: 'closed') => {
    setLock(reason ?? 'unknown');
    setTool('hand');
    notify(reason === 'closed' ? '모임을 연 사람이 노트를 마무리했어요. 이제 볼 수만 있어요.' : LOCK_TEXT.unknown);
  }, []);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const { visibleCenter } = zoom;
  const sync = useMeetingNoteSync({
    clubId,
    meetingId,
    editor,
    initialVersion: note.version,
    readOnly,
    onReadOnly,
    getPresence: () => {
      const c = visibleCenter();
      return c ? { x: c[0], y: c[1], tool: toolRef.current } : null;
    },
  });

  const inkTool = !readOnly && (tool === 'pen' || tool === 'eraser') ? tool : null;
  const inkGesture = useInkGesture({
    tool: inkTool, scale, pen, apply: editor.apply, endBatch: editor.endBatch, setLive, onLimit: notify,
  });
  const photos = useNotePhotos({
    upload: (form) => meetingNoteApi.uploadImage(clubId, meetingId, form),
    apply: editor.apply,
    canvas: CANVAS,
    getAnchor: visibleCenter,
    limit: {
      max: NOTE_IMAGE_MAX,
      count: () => editor.docRef.current.elements.filter((e) => e.type === 'photo').length,
    },
  });
  const openEditorRef = useRef<(elementId: string) => void>(() => {});
  const selection = useNoteSelection({ editor, scaleRef, tool, onEdit: (elementId) => openEditorRef.current(elementId) });
  const inserts = useNoteInserts({
    editor, me: speaker, setTool, select: selection.select, pickPhoto: photos.pick, getAnchor: visibleCenter,
  });
  openEditorRef.current = inserts.openEditor;

  const { select } = selection;
  const selecting = tool === 'select' && !readOnly;
  const { preview, handlers } = selection;
  const renderElement = useCallback((el: PlacedElement, s: number) => (
    <EditableElementView key={el.id} element={applyPreview(el, preview, s, CANVAS)} scale={s} editable={selecting} handlers={handlers} />
  ), [preview, selecting, handlers]);
  const selected = readOnly ? null : selection.selected;

  // 딥링크로 바로 들어와 돌아갈 곳이 없으면 클럽의 노트 탭으로.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/club/[id]', params: { id: String(clubId), tab: 'notes' } });
  };
  const unsavedNotice = '아직 저장하지 못한 내용이 있어요. 연결을 확인하고 다시 눌러 주세요.';

  /** 남은 편집을 다 보낸 걸 확인하고 나간다 — 연결이 끊겨 못 보냈으면 머문다. */
  const saveAndLeave = async () => {
    setBusy('leaving');
    const saved = await sync.drain();
    setBusy(null);
    if (!saved) {
      notify(unsavedNotice);
      return;
    }
    goBack();
  };

  /** 마무리 — 확인을 받고, 남은 편집을 다 보낸 뒤 서버에 마무리를 알리고 나간다. */
  const closeNote = async () => {
    const ok = await confirmAsync('노트를 마무리할까요? 마무리하면 아무도 더 고칠 수 없고, 노트 탭에 완성본으로 남아요.', '마무리');
    if (!ok) return;
    setBusy('closing');
    try {
      if (!(await sync.drain())) {
        notify(unsavedNotice);
        return;
      }
      await meetingNoteApi.close(clubId, meetingId);
      setLock('closed');
      void queryClient.invalidateQueries({ queryKey: meetingNotesKey(clubId) });
      notify('노트를 마무리했어요.');
      goBack();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : '노트를 마무리하지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  // 같은 사람이 여러 기기로 들어와도 아바타는 한 번만.
  const people = useMemo(() => {
    const seen = new Map<number, MeetingNotePeer>();
    for (const p of sync.peers) if (!seen.has(p.userId)) seen.set(p.userId, p);
    return [...seen.values()];
  }, [sync.peers]);

  return (
    <PaperScreen>
      {/* 뒤로 가기는 기본 동작 — 남은 편집은 화면을 떠날 때 동기화 훅이 마저 보낸다. */}
      <SubHeader
        category="모임 노트"
        right={readOnly ? undefined : (
          <IconButton onPress={editor.undo} disabled={!editor.canUndo} accessibilityLabel="되돌리기">
            <ToolIcon icon={Undo2} size={ICON_SIZE.plain} color={colors.text} />
          </IconButton>
        )}
      />

      <View style={[styles.info, { borderBottomColor: colors.line }]}>
        <View style={styles.infoText}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{note.meetingTitle ?? '모임 노트'}</Text>
          <SyncLabel status={sync.status} saving={sync.saving} readOnly={readOnly} />
        </View>
        <PeerStack people={people} />
      </View>

      <View style={styles.stage} onLayout={onLayout}>
        {stage && zoom.fitWidth > 0 ? (
          <ZoomStage zoom={zoom} controls={false}>
            {(w, win) => (
              <NoteCanvas
                doc={editor.doc}
                width={w}
                window={win}
                live={live}
                underlay={
                  <PageTapLayer
                    active={tool === 'hand' || tool === 'select'}
                    onTap={() => {
                      if (tool === 'select') select(null);
                    }}
                    onDoubleTap={() => {
                      if (tool === 'hand' && !readOnly) setTool('select');
                    }}
                  />
                }
                renderElement={renderElement}
              >
                <InkGestureLayer gesture={inkGesture} active={inkTool !== null} />
                <PendingPhotos items={photos.pending} scale={scale} onRetry={photos.retry} onRemove={photos.remove} />
                {selected ? (
                  <SelectionFrame
                    element={applyPreview(selected, preview, scale, CANVAS)}
                    scale={scale}
                    height={selection.selectedHeight}
                    onPreview={handlers.onPreview}
                    onCommit={selection.commit}
                    onDelete={selection.remove}
                    onFront={selection.front}
                    onEdit={selected.type === 'text' || selected.type === 'speech' ? () => inserts.openEditor(selected.id) : undefined}
                  />
                ) : null}
                <PeerTags peers={sync.peers} scale={scale} />
              </NoteCanvas>
            )}
          </ZoomStage>
        ) : null}
        <ZoomControls zoom={zoom} style={styles.zoomControls} />
      </View>

      {lock ? (
        // 읽기만 될 때도 나가는 길을 글로 보여 준다 — 뒤로 화살표만으로는 찾기 어렵다.
        <View
          style={[
            styles.readOnly,
            { borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <Text style={[typeScale.caption, styles.lockText, { color: colors.textMuted }]}>{LOCK_TEXT[lock]}</Text>
          <Button label="나가기" variant="outline" size="sm" onPress={goBack} />
        </View>
      ) : (
        <>
          {/* 앱 공통 순서 [보조][주요] — 마무리할 수 있는 사람에게는 마무리가 주요, 나머지에게는 저장하고 나가기가 주요. */}
          <View style={[styles.actions, { borderTopColor: colors.line }]}>
            <Button
              label="저장하고 나가기"
              variant={note.canClose ? 'outline' : 'primary'}
              loading={busy === 'leaving'}
              disabled={busy !== null}
              onPress={() => void saveAndLeave()}
              style={styles.action}
            />
            {note.canClose ? (
              <Button
                label="노트 마무리"
                loading={busy === 'closing'}
                disabled={busy !== null}
                onPress={() => void closeNote()}
                style={styles.action}
              />
            ) : null}
          </View>
          <NoteToolbar
            tool={tool}
            onTool={setTool}
            pen={pen}
            onPen={(patch) => setPen((prev) => ({ ...prev, ...patch }))}
            onInsert={inserts.insert}
            photoDisabled={photos.disabled}
            inserts={MEETING_NOTE_INSERTS}
          />
        </>
      )}

      <TextEditorSheet element={inserts.editing} members={members} onPatch={inserts.patchEditing} onClose={inserts.closeEditor} />
      <StickerSheet
        visible={inserts.stickerOpen}
        book={stickerBook}
        onPick={inserts.pickSticker}
        onPickBook={inserts.pickBook}
        onPickCard={inserts.pickCard}
        onClose={inserts.closeSticker}
      />
    </PaperScreen>
  );
}

/** 동기화 상태 한 줄 — 모노 라벨. 실시간이면 잉크 점, 끊겼으면 흐린 점. */
function SyncLabel({ status, saving, readOnly }: { status: MeetingNoteSyncStatus; saving: boolean; readOnly: boolean }) {
  const { colors } = useTheme();
  const label = readOnly
    ? '보기 전용'
    : status === 'connecting'
      ? '연결 중'
      : status === 'live'
        ? saving ? '실시간 · 저장 중' : '실시간 · 저장됨'
        : saving ? '연결 끊김 · 저장 대기' : '연결 끊김 · 다시 연결되면 저장돼요';
  return (
    <View style={styles.syncRow} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: status === 'live' ? colors.ink : colors.textFaint }]} />
      <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

/** 지금 함께 보고 있는 멤버 — 겹친 아바타와 인원. */
function PeerStack({ people }: { people: MeetingNotePeer[] }) {
  const { colors } = useTheme();
  if (people.length === 0) return null;
  const shown = people.slice(0, PEER_AVATAR_MAX);
  const names = people.map((p) => p.nickname).join(', ');
  return (
    <View style={styles.peers} accessible accessibilityLabel={`함께 보는 중: ${names}`}>
      <View style={styles.avatars}>
        {shown.map((p, i) => (
          <View key={p.userId} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.bg }]}>
            <Avatar uri={p.avatarUrl} nickname={p.nickname} size={24} />
          </View>
        ))}
      </View>
      <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{people.length}명</Text>
    </View>
  );
}

/** 다른 멤버가 보고 있는 곳 — 종이 위 이름표. 논리 좌표에 scale 을 곱해 캔버스 안에 놓는다. */
function PeerTags({ peers, scale }: { peers: MeetingNotePeer[]; scale: number }) {
  const { colors } = useTheme();
  return (
    <>
      {peers.map((p) => (p.x == null || p.y == null ? null : (
        <View
          key={p.peer}
          pointerEvents="none"
          style={[styles.tag, { left: p.x * scale, top: p.y * scale, backgroundColor: colors.note, borderColor: colors.line }]}
        >
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.tagText, { color: colors.onNote }]}>{p.nickname}</Text>
        </View>
      )))}
    </>
  );
}

const styles = StyleSheet.create({
  info: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: hairline,
  },
  infoText: { flex: 1, gap: 2 },
  title: { fontFamily: serif.bold, fontSize: 17, lineHeight: 24 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: radius.round },
  peers: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatars: { flexDirection: 'row' },
  avatar: { borderWidth: 2, borderRadius: radius.round },
  stage: { flex: 1 },
  zoomControls: { position: 'absolute', right: spacing.lg, bottom: spacing.sm },
  readOnly: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  lockText: { flex: 1 },
  // 도구 줄 바로 위 — 두 버튼은 같은 폭, 서로 다른 동작이라 sm 이상 띄운다.
  actions: {
    ...layout.content,
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  action: { flex: 1 },
  tag: {
    position: 'absolute',
    maxWidth: 120,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.badge,
    borderWidth: hairline,
  },
  tagText: { fontSize: 10 },
});
