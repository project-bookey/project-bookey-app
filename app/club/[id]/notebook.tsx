import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Menu, Undo2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Platform, Pressable, StyleSheet, Text, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, clubNoteApi } from '@/api/endpoints';
import type { ClubNotePageSummary } from '@/api/types';
import { confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import { CANVAS, NoteCanvas, scaleFor, type LiveStroke, type PlacedElement } from '@/components/clubNote';
import { EditableElementView } from '@/components/clubNote/EditableElementView';
import { InkGestureLayer } from '@/components/clubNote/InkGestureLayer';
import { ToolIcon } from '@/components/clubNote/NoteIcons';
import { NoteToolbar, type NoteTool } from '@/components/clubNote/NoteToolbar';
import { PageMenu } from '@/components/clubNote/PageMenu';
import { PageStrip } from '@/components/clubNote/PageStrip';
import { PageTapLayer } from '@/components/clubNote/PageTapLayer';
import { PendingPhotos } from '@/components/clubNote/PendingPhotos';
import { ReadOnlyPage } from '@/components/clubNote/ReadOnlyPage';
import { SelectionFrame } from '@/components/clubNote/SelectionFrame';
import { StickerSheet } from '@/components/clubNote/StickerSheet';
import { TextEditorSheet } from '@/components/clubNote/TextEditorSheet';
import { TitlePrompt } from '@/components/clubNote/TitlePrompt';
import { applyPreview } from '@/components/clubNote/editing';
import { clubNoteKeys, useNotebook } from '@/components/clubNote/queries';
import { useInkGesture, type PenState } from '@/components/clubNote/useInkGesture';
import { useNoteInserts } from '@/components/clubNote/useNoteInserts';
import { useNotePage } from '@/components/clubNote/useNotePage';
import { useNotePhotos } from '@/components/clubNote/useNotePhotos';
import { useNoteSelection } from '@/components/clubNote/useNoteSelection';
import { Button, EmptyState, Loading, formatRelative, linkLabel } from '@/components/ui';
import { sharePng } from '@/lib/sharePng';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';

/** PNG 내보내기 크기 — 논리 캔버스 3:4 그대로. */
const EXPORT = { width: 1080, height: 1440 };

/**
 * 모임 노트북 — 모임당 한 권, 멤버가 함께 꾸미는 페이지.
 * 페이지는 세로 스크롤 없이 항상 화면 안에 통째로 들어온다(가용 폭·높이 중 작은 쪽에 3:4 로 맞춤).
 * 도구는 모드로 나뉜다 — 보기(스와이프로 페이지 넘김)·선택(요소 이동·크기·회전)·펜·지우개. 삽입 4종은 시트를 여는 동작이다.
 * 현재 페이지만 편집 상태(useNotePage)를 들고, 이웃 페이지는 읽기 전용으로 미리 그린다.
 */
export default function ClubNotebookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const notebook = useNotebook(clubId);
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId) });
  const members = club.data?.members ?? [];
  const pages = useMemo(
    () => [...(notebook.data?.pages ?? [])].sort((a, b) => a.seq - b.seq),
    [notebook.data],
  );
  const readOnly = notebook.data?.readOnly ?? false;

  const [pageIndex, setPageIndex] = useState(0);
  const index = Math.min(pageIndex, Math.max(pages.length - 1, 0));
  const current: ClubNotePageSummary | null = pages[index] ?? null;
  const note = useNotePage({ clubId, pageId: current?.id ?? null });
  const { editor } = note;

  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<NoteTool>('hand');
  const [pen, setPen] = useState<PenState>({ color: 'ink', width: 8 });
  const [live, setLive] = useState<LiveStroke | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const captureRef = useRef<View>(null);
  const listRef = useRef<FlatList<ClubNotePageSummary>>(null);

  const onLayout = (e: LayoutChangeEvent) =>
    setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const stageWidth = stage?.w ?? 0;
  // 좌우 여백을 뺀 폭, 높이에서 역산한 폭, 콘텐츠 최대 폭 중 가장 작은 값 — 페이지가 화면을 넘지 않는다.
  const pageWidth = stage
    ? Math.floor(Math.min(
        stage.w - spacing.lg * 2,
        (stage.h - spacing.md * 2) * (CANVAS.w / CANVAS.h),
        layout.content.maxWidth - spacing.lg * 2,
      ))
    : 0;
  const scale = scaleFor(Math.max(pageWidth, 1));
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const inkTool = tool === 'pen' || tool === 'eraser' ? tool : null;
  const inkGesture = useInkGesture({
    tool: inkTool, scale, pen, apply: editor.apply, endBatch: editor.endBatch, setLive, onLimit: notify,
  });

  const photos = useNotePhotos({ clubId, apply: editor.apply });
  const openEditorRef = useRef<(elementId: string) => void>(() => {});
  const selection = useNoteSelection({ editor, scaleRef, tool, onEdit: (elementId) => openEditorRef.current(elementId) });
  const inserts = useNoteInserts({
    editor, me: members.find((m) => m.isMe), setTool, select: selection.select, pickPhoto: photos.pick,
  });
  openEditorRef.current = inserts.openEditor;

  // 끝난 모임은 보기만 — 도구를 쥘 수 없다.
  useEffect(() => {
    if (readOnly && tool !== 'hand') setTool('hand');
  }, [readOnly, tool]);
  // 페이지가 바뀌면 선택을 푼다.
  useEffect(() => {
    selection.select(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // ────────────────────────────── 페이지 이동·추가·삭제 ──────────────────────────────

  const goTo = useCallback(async (next: number) => {
    if (next < 0 || next >= pages.length || next === index) return;
    await note.saveNow();
    setPageIndex(next);
  }, [pages.length, index, note]);

  useEffect(() => {
    if (pages.length > 0 && stageWidth > 0) listRef.current?.scrollToIndex({ index, animated: true });
  }, [index, pages.length, stageWidth]);

  const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (stageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / stageWidth);
    if (next !== index) void goTo(next);
  };

  const createPage = useMutation({
    mutationFn: () => clubNoteApi.createPage(clubId),
    onSuccess: async (page) => {
      qc.setQueryData(clubNoteKeys.page(clubId, page.id), page);
      await qc.invalidateQueries({ queryKey: clubNoteKeys.list(clubId) });
      setPageIndex(Number.MAX_SAFE_INTEGER);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '페이지를 만들지 못했어요'),
  });
  const addPage = async () => {
    await note.saveNow();
    createPage.mutate();
  };

  const deletePage = useMutation({
    mutationFn: (pageId: number) => clubNoteApi.deletePage(clubId, pageId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: clubNoteKeys.all(clubId) });
      setPageIndex((i) => Math.max(0, i - 1));
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '페이지를 지우지 못했어요'),
  });
  const removePage = async () => {
    if (!current) return;
    if (!(await confirmAsync('이 페이지를 지울까요? 그린 것과 붙인 사진이 모두 사라져요.', '지우기'))) return;
    deletePage.mutate(current.id);
  };

  const exportPng = async () => {
    if (!current) return;
    selection.select(null);
    // 선택 프레임이 사라지고 마지막 미리보기가 그려질 한 프레임을 기다린다.
    await new Promise((r) => setTimeout(r, 60));
    try {
      const result = await sharePng(captureRef, {
        ...EXPORT, fileName: `bookey-note-${clubId}-${current.seq}.png`, title: '모임 노트 페이지',
      });
      if (result === 'unavailable') notify('이 기기에서는 공유를 쓸 수 없어요.');
    } catch {
      notify(Platform.OS === 'web'
        ? '페이지를 이미지로 만들지 못했어요. 웹에서는 사진이 든 페이지를 저장하지 못할 수 있어요 · 앱에서 다시 시도해 주세요.'
        : '페이지를 이미지로 만들지 못했어요 · 다시 시도');
    }
  };

  // ────────────────────────────── 렌더 ──────────────────────────────

  const selecting = tool === 'select' && !readOnly;
  const { preview, handlers } = selection;
  const renderElement = useCallback((el: PlacedElement, s: number) => (
    <EditableElementView key={el.id} element={applyPreview(el, preview, s)} scale={s} editable={selecting} handlers={handlers} />
  ), [preview, selecting, handlers]);

  const renderPage = ({ item, index: i }: { item: ClubNotePageSummary; index: number }) => (
    <View style={[styles.slide, { width: stageWidth }]}>
      {i === index ? (
        note.loading ? (
          <ReadOnlyPage clubId={clubId} pageId={item.id} width={pageWidth} />
        ) : (
          <NoteCanvas
            doc={editor.doc}
            width={pageWidth}
            live={live}
            captureRef={captureRef}
            underlay={
              <PageTapLayer
                active={tool === 'hand' || tool === 'select'}
                onTap={() => { if (tool === 'select') selection.select(null); }}
                onDoubleTap={() => { if (tool === 'hand' && !readOnly) setTool('select'); }}
              />
            }
            renderElement={renderElement}
          >
            <InkGestureLayer gesture={inkGesture} active={inkTool !== null} />
            <PendingPhotos items={photos.pending} scale={scale} onRetry={photos.retry} onRemove={photos.remove} />
            {selection.selected ? (
              <SelectionFrame
                element={applyPreview(selection.selected, preview, scale)}
                scale={scale}
                height={selection.selectedHeight}
                onPreview={handlers.onPreview}
                onCommit={selection.commit}
                onDelete={selection.remove}
                onFront={selection.front}
                onEdit={() => inserts.openEditor(selection.selected!.id)}
              />
            ) : null}
          </NoteCanvas>
        )
      ) : (
        <ReadOnlyPage clubId={clubId} pageId={item.id} width={pageWidth} />
      )}
    </View>
  );

  const status = note.saving ? '저장 중' : note.dirty ? '저장 대기' : '저장됨';
  const editedBy = note.page?.updatedBy?.nickname ?? '알 수 없음';

  return (
    <PaperScreen>
      <SubHeader
        category="노트"
        onBack={async () => {
          await note.saveNow();
          router.back();
        }}
        right={
          <View style={styles.headerRight}>
            {!readOnly ? (
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
            ) : null}
            {current ? (
              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="페이지 메뉴 열기"
                style={({ pressed }) => [styles.iconButton, pressed ? pressedStyle : null]}
              >
                <ToolIcon icon={Menu} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        }
      />

      {notebook.isLoading ? (
        <Loading />
      ) : notebook.isError ? (
        <EmptyState
          title="노트를 불러오지 못했어요"
          description={notebook.error instanceof ApiError ? notebook.error.message : undefined}
          action={<Button label="다시 시도" variant="outline" onPress={() => notebook.refetch()} />}
        />
      ) : pages.length === 0 ? (
        <EmptyState
          title="아직 페이지가 없어요"
          description={readOnly ? '끝난 모임이라 새 페이지를 만들 수 없어요.' : '첫 페이지를 만들고 그날의 사진과 대화를 붙여 보세요.'}
          action={readOnly ? undefined : (
            <Button label="첫 페이지 만들기" onPress={() => createPage.mutate()} loading={createPage.isPending} />
          )}
        />
      ) : (
        <>
          <PageStrip
            pages={pages}
            index={index}
            title={note.title}
            readOnly={readOnly}
            onPrev={() => void goTo(index - 1)}
            onNext={() => void goTo(index + 1)}
            onAdd={() => void addPage()}
            onTitle={() => setTitleOpen(true)}
          />
          <View style={styles.stage} onLayout={onLayout}>
            {stageWidth > 0 && pageWidth > 0 ? (
              <FlatList
                ref={listRef}
                key={stageWidth}
                data={pages}
                horizontal
                pagingEnabled
                keyExtractor={(p) => String(p.id)}
                renderItem={renderPage}
                getItemLayout={(_, i) => ({ length: stageWidth, offset: stageWidth * i, index: i })}
                initialScrollIndex={index}
                scrollEnabled={tool === 'hand'}
                onMomentumScrollEnd={onSwipeEnd}
                showsHorizontalScrollIndicator={false}
                windowSize={3}
                initialNumToRender={1}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
              />
            ) : null}
          </View>
          <View style={styles.foot}>
            {note.saveError ? (
              <Pressable onPress={() => void note.saveNow()} accessibilityRole="button" style={({ pressed }) => [pressed ? pressedStyle : null]}>
                <Text style={[typeScale.monoLabel, { color: colors.danger }]}>
                  {note.saveError} · {linkLabel('다시 시도', 'action')}
                </Text>
              </Pressable>
            ) : (
              <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                {note.page ? `${editedBy}님이 ${formatRelative(note.page.updatedAt)} 수정 · ` : ''}{readOnly ? '보기 전용' : status}
              </Text>
            )}
          </View>
          {!readOnly ? (
            <NoteToolbar
              tool={tool}
              onTool={setTool}
              pen={pen}
              onPen={(patch) => setPen((prev) => ({ ...prev, ...patch }))}
              onInsert={inserts.insert}
              photoDisabled={photos.disabled}
            />
          ) : null}
        </>
      )}

      <TextEditorSheet element={inserts.editing} members={members} onPatch={inserts.patchEditing} onClose={inserts.closeEditor} />
      <StickerSheet visible={inserts.stickerOpen} onPick={inserts.pickSticker} onClose={inserts.closeSticker} />
      <TitlePrompt visible={titleOpen} initial={note.title} onSubmit={note.setTitle} onClose={() => setTitleOpen(false)} />
      <PageMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        readOnly={readOnly}
        canDelete={note.page?.canDelete ?? false}
        paper={editor.doc.paper}
        onPaper={note.setPaper}
        onRename={() => setTitleOpen(true)}
        onAdd={() => void addPage()}
        onExport={() => void exportPng()}
        onDelete={() => void removePage()}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconDisabled: { opacity: 0.35 },
  stage: { flex: 1 },
  list: { flex: 1 },
  slide: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.sm, paddingBottom: spacing.md },
  foot: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, minHeight: 20 },
});
