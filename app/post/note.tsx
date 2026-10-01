import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Menu, Undo2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList, Platform, Pressable, StyleSheet, Text, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, clubApi, postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey } from '@/api/postCache';
import type { BookQuote, Post, PostVisibility } from '@/api/types';
import { useBookPicker, type PickedBook } from '@/components/book/BookPicker';
import { confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  NOTE_DOC_MAX_BYTES, NOTE_KINDS, NoteCanvas, ZoomControls, ZoomStage, applyPreview, contentBounds, emptyPostNoteDoc, imageIdsOf,
  plainTextOf, postNoteDocBytes, quoteIdsOf, serializePostNoteDoc, useInkGesture, useNoteInserts, useNotePhotos,
  useNoteSelection, useNoteZoom, usePostNoteEditor,
  type LiveStroke, type NoteKind, type NoteSpeaker, type PenState, type PlacedElement, type PostNoteDoc, type ZoomHome,
} from '@/components/note';
import { EditableElementView } from '@/components/note/EditableElementView';
import { InkGestureLayer } from '@/components/note/InkGestureLayer';
import { ToolIcon } from '@/components/note/NoteIcons';
import { NoteToolbar, type InsertKind, type NoteTool } from '@/components/note/NoteToolbar';
import { PageMenu } from '@/components/note/PageMenu';
import { PageStrip } from '@/components/note/PageStrip';
import { PageTapLayer } from '@/components/note/PageTapLayer';
import { PendingPhotos } from '@/components/note/PendingPhotos';
import { SelectionFrame } from '@/components/note/SelectionFrame';
import { StickerSheet } from '@/components/note/StickerSheet';
import { TextEditorSheet } from '@/components/note/TextEditorSheet';
import { NotePublishSheet } from '@/components/post/NotePublishSheet';
import { QuoteAttachSheet } from '@/components/post/QuoteAttachSheet';
import {
  NOTE_IMAGE_MAX, POST_QUOTE_MAX, defaultVisibility, isNotePost, noteDocOf,
} from '@/components/post/postFormat';
import { EmptyState, Loading, linkLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';

/** 노트 독후감 도구 줄의 삽입 — 텍스트·스티커·사진·말풍선·오려둔 문장. */
const NOTE_INSERTS: readonly InsertKind[] = ['text', 'sticker', 'photo', 'speech', 'quote'];

const isNoteKind = (v: unknown): v is NoteKind => typeof v === 'string' && (NOTE_KINDS as readonly string[]).includes(v);

/**
 * 노트 독후감 쓰기·고치기 — 모드 고르기에서 `kind`(+ `bookId`·`clubId`)로, 상세 '고치기'에서 `id` 로 들어온다.
 * 편집은 전부 메모리에서 한다(자동 저장 없음) — '다음' 에서 책·제목·공개 범위를 고르고 한 번에 올린다.
 * 고칠 글을 먼저 받아 온 뒤에야 편집기를 세운다(usePostNoteEditor 는 마운트 때 한 번만 시드를 읽는다).
 */
export default function PostNoteScreen() {
  const { id, kind, bookId, clubId } = useLocalSearchParams<{
    id?: string; kind?: string; bookId?: string; clubId?: string;
  }>();
  const { colors } = useTheme();
  const postId = id ? Number(id) : NaN;
  const editing = Number.isFinite(postId);
  const bookParam = bookId ? Number(bookId) : NaN;
  const fromBook = !editing && Number.isFinite(bookParam);
  const clubParam = clubId ? Number(clubId) : NaN;
  const category = editing ? '노트 고치기' : '노트 독후감';

  const post = useQuery({
    queryKey: editing ? postKey(postId) : ['post', 'pending'],
    queryFn: () => postApi.get(postId),
    enabled: editing,
  });
  const book = useQuery({
    queryKey: fromBook ? ['book', bookParam] : ['book', 'pending'],
    queryFn: () => bookApi.detail(bookParam),
    enabled: fromBook,
  });

  if ((editing && post.isLoading) || (fromBook && book.isLoading)) {
    return <Shell category={category}><Loading /></Shell>;
  }
  const loaded = post.data;
  if (editing && !loaded) {
    const gone = post.error instanceof ApiError && (post.error.status === 404 || post.error.status === 403);
    return (
      <Shell category={category}>
        <EmptyState
          title="독후감을 불러오지 못했어요"
          description={gone ? '지워졌거나 볼 수 없는 글이에요.' : '잠시 후 다시 시도해 주세요.'}
          action={gone ? undefined : (
            <Pressable
              onPress={() => post.refetch()}
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
  if (loaded && !isNotePost(loaded)) {
    return <Redirect href={{ pathname: '/post/new', params: { id: String(loaded.id) } }} />;
  }
  if (loaded && !loaded.mine) {
    return (
      <Shell category={category}>
        <EmptyState title="고칠 수 없는 글입니다" description="내가 쓴 글만 고칠 수 있어요." />
      </Shell>
    );
  }

  const initialDoc = loaded ? noteDocOf(loaded) : emptyPostNoteDoc(isNoteKind(kind) ? kind : 'grid');
  const initialBook: PickedBook | null | undefined = loaded
    ? loaded.bookId != null
      ? { bookId: loaded.bookId, title: loaded.bookTitle ?? '', coverUrl: loaded.bookCoverUrl }
      : null
    : fromBook && book.data
      ? {
          bookId: book.data.book.id,
          title: book.data.book.title,
          coverUrl: book.data.book.coverUrl,
          recordId: book.data.myRecordId,
        }
      : undefined;
  const noteClubId = loaded ? loaded.clubId : Number.isFinite(clubParam) ? clubParam : undefined;

  return (
    <NoteEditor
      key={editing ? `edit-${postId}` : 'new'}
      post={loaded}
      initial={initialDoc}
      initialBook={initialBook}
      clubId={noteClubId}
    />
  );
}

function Shell({ category, children }: { category: string; children: ReactNode }) {
  return (
    <PaperScreen>
      <SubHeader category={category} />
      {children}
    </PaperScreen>
  );
}

/**
 * 편집기 본체 — 페이지는 가로 페이저로 넘기고(이웃은 읽기 전용 미리보기), 지금 페이지만 편집 층을 얹는다.
 * 도구는 보기(스와이프로 넘김)·선택·펜·지우개, 삽입은 텍스트·스티커·사진·말풍선·문장. 지금 페이지는 줌 무대 위에 —
 * 어느 노트든 핀치·휠·버튼으로 줄이고 키운다. 대형노트는 아주 넓은 종이라 100%(격자노트와 같은 글씨 크기)로 한 구역을
 * 보며 시작하고, 손 도구로 끌어 옮기거나 '전체'로 줄여 종이 전체를 본다.
 */
function NoteEditor({ post, initial, initialBook, clubId }: {
  post?: Post;
  initial: PostNoteDoc;
  initialBook?: PickedBook | null;
  clubId?: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const editingPost = post != null;
  const inClub = clubId != null;

  const [seed] = useState(initial);
  const pe = usePostNoteEditor(seed);
  const { editor, toDoc } = pe;

  // 말풍선 화자 — 나. 클럽 글이면 멤버 중에서 고를 수 있다(클럽 홈과 같은 캐시 키).
  const me = useAuth((s) => s.user);
  const club = useQuery({
    queryKey: ['club', clubId ?? 0],
    queryFn: () => clubApi.home(clubId as number),
    enabled: inClub,
  });
  const members = club.data?.members ?? [];
  const speaker: NoteSpeaker | undefined = members.find((m) => m.isMe)
    ?? (me ? { userId: me.id, nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined);

  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<NoteTool>('hand');
  const [pen, setPen] = useState<PenState>({ color: 'ink', width: 8 });
  const [live, setLive] = useState<LiveStroke | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const listRef = useRef<FlatList<string>>(null);

  const onLayout = (e: LayoutChangeEvent) =>
    setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const stageWidth = stage?.w ?? 0;
  const stageHeight = stage?.h ?? 0;

  // 처음 모습 — 대형노트는 붙인 것들의 가운데(비었으면 종이 한가운데)를 100% 로, 격자·줄노트는 종이 전체.
  const docRef = useRef(editor.doc);
  docRef.current = editor.doc;
  const home = useCallback((): ZoomHome => {
    if (pe.kind !== 'large') return { fit: true };
    const b = contentBounds(docRef.current);
    return { center: b ? [b.x + b.w / 2, b.y + b.h / 2] : [pe.canvas.w / 2, pe.canvas.h / 2] };
  }, [pe.kind, pe.canvas]);
  // 줌 무대 = 페이지 칸 전체. 맞춤은 좌우·위아래 여백과 콘텐츠 최대 폭 안에서. 확대 중 손 도구는 종이를 끈다.
  const zoom = useNoteZoom({
    kind: pe.kind,
    viewport: { w: stageWidth, h: stageHeight },
    fitInset: { x: spacing.lg, y: spacing.lg },
    maxFitWidth: layout.content.maxWidth - spacing.lg * 2,
    alignTop: true,
    panEnabled: tool === 'hand',
    home,
  });
  const pageWidth = zoom.fitWidth;
  const scale = zoom.scale;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const inkTool = tool === 'pen' || tool === 'eraser' ? tool : null;
  const inkGesture = useInkGesture({
    tool: inkTool, scale, pen, apply: editor.apply, endBatch: editor.endBatch, setLive, onLimit: notify,
  });

  const photos = useNotePhotos({
    upload: postApi.uploadImage,
    apply: editor.apply,
    applyTo: pe.applyToPage,
    pageId: pe.pageId,
    canvas: pe.canvas,
    getAnchor: zoom.visibleCenter,
    limit: { max: NOTE_IMAGE_MAX, count: () => imageIdsOf(toDoc()).length },
  });
  // 사진은 고를 때의 페이지에 붙는다 — 화면은 지금 페이지 것만 그린다.
  const pendingHere = photos.pending.filter((p) => p.pageId === undefined || p.pageId === pe.pageId);

  const openEditorRef = useRef<(elementId: string) => void>(() => {});
  const selection = useNoteSelection({ editor, scaleRef, tool, onEdit: (elementId) => openEditorRef.current(elementId) });
  const openQuotes = useCallback(() => {
    if (quoteIdsOf(toDoc()).length >= POST_QUOTE_MAX) {
      notify(`오려둔 문장은 ${POST_QUOTE_MAX}개까지 붙일 수 있어요.`);
      return;
    }
    setQuotesOpen(true);
  }, [toDoc]);
  const inserts = useNoteInserts({
    editor, me: speaker, setTool, select: selection.select, pickPhoto: photos.pick, openQuotes, getAnchor: zoom.visibleCenter,
  });
  openEditorRef.current = inserts.openEditor;

  const pickQuote = (quote: BookQuote) => {
    setQuotesOpen(false);
    const ids = quoteIdsOf(toDoc());
    if (!ids.includes(quote.id) && ids.length >= POST_QUOTE_MAX) {
      notify(`오려둔 문장은 ${POST_QUOTE_MAX}개까지 붙일 수 있어요.`);
      return;
    }
    inserts.pickQuote({
      quoteId: quote.id,
      text: quote.content,
      page: quote.page,
      bookTitle: quote.bookTitle,
      // 남이 오려 둔 문장이면 누구의 것인지 밝힌다.
      author: quote.mine ? undefined : quote.authorNickname,
    });
  };

  // ────────────────────────────── 페이지 ──────────────────────────────

  const { select } = selection;
  const { goHome } = zoom;
  // 페이지가 바뀌면 선택을 풀고 처음 모습으로. goHome 은 뷰포트가 바뀌면 새로 만들어지지만 그땐 줌이 스스로 처음 모습을 얹는다.
  const goHomeRef = useRef(goHome);
  goHomeRef.current = goHome;
  useEffect(() => {
    select(null);
    goHomeRef.current();
  }, [pe.pageId, select]);

  useEffect(() => {
    if (stageWidth > 0) listRef.current?.scrollToIndex({ index: pe.pageIndex, animated: true });
  }, [pe.pageIndex, pe.pageCount, stageWidth]);

  const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (stageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / stageWidth);
    if (next !== pe.pageIndex) pe.goTo(next);
  };
  // 웹(react-native-web)은 onMomentumScrollEnd 를 내지 않는다 — 스크롤이 멈추면(잠깐 조용하면) 같은 계산을 한다.
  // goTo 는 범위 밖·같은 페이지를 스스로 거르므로 늦게 불려도 안전하다.
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (webSettle.current) clearTimeout(webSettle.current);
  }, []);
  const { goTo } = pe;
  const onWebScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (webSettle.current) clearTimeout(webSettle.current);
    webSettle.current = setTimeout(() => {
      if (stageWidth > 0) goTo(Math.round(x / stageWidth));
    }, 150);
  };

  const addPage = () => {
    if (!pe.addPage()) notify('노트는 6페이지까지예요.');
  };
  const deletePage = async () => {
    if (!pe.canDeletePage) return;
    if (!(await confirmAsync('이 페이지를 지울까요? 그린 것과 붙인 것이 모두 사라져요.', '지우기'))) return;
    photos.removeForPage(pe.pageId);
    pe.deletePage();
  };

  const leave = async () => {
    if (pe.dirty && !(await confirmAsync('작성 중인 노트를 버릴까요?', '버리기'))) return;
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  // ────────────────────────────── 올리기 ──────────────────────────────

  const picker = useBookPicker({ initial: initialBook });
  const book = picker.selected;
  // 책이 있던 글은 바꿀 수만 있고 뺄 수 없다(서버 규칙) — 텍스트 모드와 같다.
  const bookLocked = editingPost && post.bookId != null;
  const [title, setTitle] = useState(post?.title ?? '');
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? defaultVisibility(inClub));

  const submit = useMutation({
    mutationFn: () => {
      const doc = toDoc();
      // 노트 속 글은 이어 붙여 bodyMd 로 보낸다 — 서버가 발췌·검색에 쓴다. 사진·밑줄은 문서에서 뽑는다.
      const body = {
        bookId: book?.bookId,
        title: title.trim(),
        bodyMd: plainTextOf(doc),
        visibility,
        tags: [],
        imageIds: imageIdsOf(doc),
        quoteIds: quoteIdsOf(doc),
        document: serializePostNoteDoc(doc),
      };
      return editingPost
        ? postApi.update(post.id, body)
        : postApi.create({ ...body, readingRecordId: book?.recordId, format: 'NOTE', clubId });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(postKey(saved.id), saved);
      invalidatePostLists(queryClient);
      pe.markClean();
      setPublishOpen(false);
      // 고치기는 상세에서 들어왔다 — 텍스트 모드처럼 되돌아가 상세가 두 겹 쌓이지 않게 한다.
      if (!editingPost) router.replace(`/post/${saved.id}`);
      else if (router.canGoBack()) router.back();
      else router.replace(`/post/${saved.id}`);
    },
  });

  /** '다음' — 빈 노트는 올리지 않는다. */
  const openPublish = () => {
    selection.select(null);
    if (toDoc().pages.every((p) => p.elements.length === 0)) {
      notify('노트가 비어 있어요 · 글이나 사진을 하나라도 붙여 보세요.');
      return;
    }
    submit.reset();
    setPublishOpen(true);
  };
  const publish = () => {
    if (postNoteDocBytes(toDoc()) > NOTE_DOC_MAX_BYTES) {
      notify('노트가 너무 커요 · 그린 획이나 페이지를 조금 줄여 주세요.');
      return;
    }
    submit.mutate();
  };

  const snapshot = publishOpen ? toDoc() : null;
  const summary = snapshot
    ? [
        `노트 ${snapshot.pages.length}쪽`,
        `사진 ${imageIdsOf(snapshot).length}장`,
        `문장 ${quoteIdsOf(snapshot).length}개`,
      ].join(' · ')
    : '';
  const publishNotice = photos.busy
    ? '사진이 올라가는 중이에요 · 끝나면 올릴 수 있어요'
    : photos.pending.length > 0
      ? '올리지 못한 사진은 빼고 올라가요'
      : null;
  const canSubmit = title.trim().length > 0 && !photos.busy && !submit.isPending;
  const submitError = submit.isError
    ? submit.error instanceof ApiError ? submit.error.message : '올리지 못했어요 · 다시 시도'
    : null;

  // ────────────────────────────── 렌더 ──────────────────────────────

  const selecting = tool === 'select';
  const { preview, handlers } = selection;
  const renderElement = useCallback((el: PlacedElement, s: number) => (
    <EditableElementView key={el.id} element={applyPreview(el, preview, s, pe.canvas)} scale={s} editable={selecting} handlers={handlers} />
  ), [preview, selecting, handlers, pe.canvas]);

  const selected = selection.selected;
  const renderPage = ({ index: i }: { item: string; index: number }) => (
    <View style={[styles.slide, { width: stageWidth, height: stageHeight }]}>
      {i === pe.pageIndex ? (
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
                    if (tool === 'hand') setTool('select');
                  }}
                />
              }
              renderElement={renderElement}
            >
              <InkGestureLayer gesture={inkGesture} active={inkTool !== null} />
              <PendingPhotos items={pendingHere} scale={scale} onRetry={photos.retry} onRemove={photos.remove} />
              {selected ? (
                <SelectionFrame
                  element={applyPreview(selected, preview, scale, pe.canvas)}
                  scale={scale}
                  height={selection.selectedHeight}
                  onPreview={handlers.onPreview}
                  onCommit={selection.commit}
                  onDelete={selection.remove}
                  onFront={selection.front}
                  onEdit={selected.type === 'text' || selected.type === 'speech' ? () => inserts.openEditor(selected.id) : undefined}
                />
              ) : null}
            </NoteCanvas>
          )}
        </ZoomStage>
      ) : (
        <NoteCanvas doc={pe.pageDoc(i)} width={pageWidth} />
      )}
    </View>
  );

  return (
    <PaperScreen>
      <SubHeader
        category={editingPost ? '노트 고치기' : '노트 독후감'}
        onBack={() => void leave()}
        right={
          <View style={styles.headerRight}>
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
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="페이지 메뉴 열기"
              style={({ pressed }) => [styles.iconButton, pressed ? pressedStyle : null]}
            >
              <ToolIcon icon={Menu} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={openPublish}
              accessibilityRole="button"
              accessibilityLabel="다음 — 책·제목·공개 범위 고르기"
              style={({ pressed }) => [styles.next, pressed ? pressedStyle : null]}
            >
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다음</Text>
            </Pressable>
          </View>
        }
      />

      <PageStrip
        index={pe.pageIndex}
        count={pe.pageCount}
        onPrev={() => pe.goTo(pe.pageIndex - 1)}
        onNext={() => pe.goTo(pe.pageIndex + 1)}
        onAdd={addPage}
        canAdd={pe.canAddPage}
      />
      <View style={styles.stage} onLayout={onLayout}>
        {stageWidth > 0 && pageWidth > 0 ? (
          <FlatList
            ref={listRef}
            key={stageWidth}
            data={pe.pageIds}
            horizontal
            pagingEnabled
            keyExtractor={(pageId) => pageId}
            renderItem={renderPage}
            extraData={[editor.doc, pe.pageIndex, tool, live, preview, pendingHere, zoom.scale, zoom.window, selected]}
            getItemLayout={(_, i) => ({ length: stageWidth, offset: stageWidth * i, index: i })}
            initialScrollIndex={pe.pageIndex}
            scrollEnabled={tool === 'hand' && !zoom.isZoomed}
            onMomentumScrollEnd={onSwipeEnd}
            onScroll={Platform.OS === 'web' ? onWebScroll : undefined}
            scrollEventThrottle={Platform.OS === 'web' ? 32 : undefined}
            showsHorizontalScrollIndicator={false}
            windowSize={3}
            initialNumToRender={1}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          />
        ) : null}
        <ZoomControls zoom={zoom} style={styles.zoomControls} />
      </View>
      <NoteToolbar
        tool={tool}
        onTool={setTool}
        pen={pen}
        onPen={(patch) => setPen((prev) => ({ ...prev, ...patch }))}
        onInsert={inserts.insert}
        photoDisabled={photos.disabled}
        inserts={NOTE_INSERTS}
      />

      <TextEditorSheet element={inserts.editing} members={members} onPatch={inserts.patchEditing} onClose={inserts.closeEditor} />
      <StickerSheet
        visible={inserts.stickerOpen}
        onPick={inserts.pickSticker}
        onPickCard={inserts.pickCard}
        onClose={inserts.closeSticker}
      />
      <PageMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        pageLabel={`${pe.pageIndex + 1} / ${pe.pageCount}쪽`}
        canAdd={pe.canAddPage}
        onAdd={addPage}
        canDelete={pe.canDeletePage}
        onDelete={() => void deletePage()}
      />
      {quotesOpen ? (
        <QuoteAttachSheet
          book={book}
          selectedIds={quoteIdsOf(toDoc())}
          onPick={pickQuote}
          onClose={() => setQuotesOpen(false)}
          max={POST_QUOTE_MAX}
        />
      ) : null}
      {publishOpen ? (
        <NotePublishSheet
          picker={picker}
          bookLocked={bookLocked}
          title={title}
          onTitle={setTitle}
          visibility={visibility}
          onVisibility={setVisibility}
          inClub={inClub}
          currentVisibility={post?.visibility}
          summary={summary}
          notice={publishNotice}
          error={submitError}
          editing={editingPost}
          submitting={submit.isPending}
          canSubmit={canSubmit}
          onSubmit={publish}
          onClose={() => setPublishOpen(false)}
        />
      ) : null}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconDisabled: { opacity: 0.35 },
  // 웹은 hitSlop 을 무시하므로 여백으로 44px 상자를 만든다.
  next: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.sm },
  stage: { flex: 1 },
  list: { flex: 1 },
  // 이웃 페이지 미리보기가 줌 무대의 맞춤 모습(위쪽 여유 PAN_PAD = lg)과 같은 자리에 서게.
  slide: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.lg },
  zoomControls: { position: 'absolute', right: spacing.lg, bottom: spacing.sm },
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
