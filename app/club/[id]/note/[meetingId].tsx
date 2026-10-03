import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Undo2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, meetingNoteApi } from '@/api/endpoints';
import type { MeetingNote } from '@/api/types';
import { notify } from '@/components/club';
import {
  meetingNoteKey, meetingNotesKey, useMeetingNoteSync, type MeetingNotePeer, type MeetingNoteSyncStatus,
} from '@/components/club/useMeetingNoteSync';
import { PaperScreen, SubHeader } from '@/components/collage';
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
import { StickerSheet } from '@/components/note/StickerSheet';
import { TextEditorSheet } from '@/components/note/TextEditorSheet';
import { Avatar } from '@/components/Avatar';
import { EmptyState, Loading, linkLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { layout, radius, serif, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

/** 모임 노트 도구 줄의 삽입 — 텍스트·스티커·사진·말풍선. */
const MEETING_NOTE_INSERTS: readonly InsertKind[] = ['text', 'sticker', 'photo', 'speech'];
const CANVAS = canvasFor('large');
/** 사진 상한 — 여럿이 함께 쓰는 노트라 한 사람이 다 쓰지 않게 하는 정도. */
const NOTE_IMAGE_MAX = 30;
/** 함께 보는 사람 아바타는 이만큼만 겹쳐 보이고 나머지는 숫자로. */
const PEER_AVATAR_MAX = 4;

/**
 * 모임 공유 노트 — 모임 하나에 대형노트 한 권, 클럽 멤버가 함께 꾸민다. 함께 독서를 끝내면 여기로 온다.
 * 노트를 한 번 받아 온 뒤 편집기를 세우고, 그다음부터는 동기화 훅이 실시간 연결·자동 저장으로 맞춘다
 * (편집기는 마운트 때 한 번만 시드를 읽는다).
 */
export default function MeetingNoteScreen() {
  const { id, meetingId } = useLocalSearchParams<{ id: string; meetingId: string }>();
  const clubId = Number(id);
  const mid = Number(meetingId);
  const { colors } = useTheme();
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
            <Pressable
              onPress={() => note.refetch()}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={({ pressed }) => [styles.retry, pressed ? pressedStyle : null]}
            >
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
            </Pressable>
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
 */
function MeetingNoteEditor({ clubId, meetingId, note }: { clubId: number; meetingId: number; note: MeetingNote }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [seed] = useState(() => parseMeetingNoteDoc(note.document));
  // 나가면 클럽 '노트' 탭 격자가 새 썸네일을 받게 한다.
  useEffect(() => () => {
    void queryClient.invalidateQueries({ queryKey: meetingNotesKey(clubId) });
  }, [queryClient, clubId]);
  const editor = useNoteEditor(seed);
  const [readOnly, setReadOnly] = useState(note.readOnly);

  // 말풍선 화자 — 나, 또는 클럽 멤버 중에서(클럽 홈과 같은 캐시 키).
  const me = useAuth((s) => s.user);
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId) });
  const members = club.data?.members ?? [];
  const speaker: NoteSpeaker | undefined = members.find((m) => m.isMe)
    ?? (me ? { userId: me.id, nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined);

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

  const onReadOnly = useCallback(() => {
    setReadOnly(true);
    setTool('hand');
    notify('끝난 클럽이나 취소된 모임의 노트라 이제 읽기만 돼요.');
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
          <Pressable
            onPress={editor.undo}
            disabled={!editor.canUndo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="되돌리기"
            accessibilityState={{ disabled: !editor.canUndo }}
            style={({ pressed }) => [styles.iconButton, !editor.canUndo ? styles.iconDisabled : null, pressed ? pressedStyle : null]}
          >
            <ToolIcon icon={Undo2} color={colors.text} />
          </Pressable>
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

      {readOnly ? (
        <View style={[styles.readOnly, { borderTopColor: colors.line }]}>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>끝난 클럽이나 취소된 모임의 노트는 읽기만 돼요.</Text>
        </View>
      ) : (
        <NoteToolbar
          tool={tool}
          onTool={setTool}
          pen={pen}
          onPen={(patch) => setPen((prev) => ({ ...prev, ...patch }))}
          onInsert={inserts.insert}
          photoDisabled={photos.disabled}
          inserts={MEETING_NOTE_INSERTS}
        />
      )}

      <TextEditorSheet element={inserts.editing} members={members} onPatch={inserts.patchEditing} onClose={inserts.closeEditor} />
      <StickerSheet
        visible={inserts.stickerOpen}
        onPick={inserts.pickSticker}
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
    ? '읽기 전용'
    : status === 'connecting'
      ? '연결 중'
      : status === 'live'
        ? saving ? '실시간 · 저장 중' : '실시간 · 저장됨'
        : saving ? '오프라인 · 저장 대기' : '오프라인 · 자동으로 맞춰요';
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
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconDisabled: { opacity: 0.35 },
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
  readOnly: { ...layout.content, borderTopWidth: hairline, padding: spacing.lg, alignItems: 'center' },
  tag: {
    position: 'absolute',
    maxWidth: 120,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: hairline,
  },
  tagText: { fontSize: 10 },
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
