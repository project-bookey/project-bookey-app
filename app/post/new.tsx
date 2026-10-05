import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey } from '@/api/postCache';
import type { Post, PostVisibility } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import type { PickedBook } from '@/components/book/BookPicker';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { NoteSheet } from '@/components/note/NoteSheet';
import { PhotoStrip } from '@/components/post/PhotoStrip';
import { PostBody } from '@/components/post/PostBody';
import type { PhotoSource } from '@/components/post/PostPhoto';
import {
  POST_TITLE_MAX, defaultVisibility, visibilityCaption, visibilityOptions,
} from '@/components/post/postFormat';
import {
  finalizePhotoLines, photoMarker, placeLoosePhotos, removePhotoLines, type PhotoRef,
} from '@/components/post/postPhotos';
import { insertBlock, pageSource, postBodyOf, quoteBlock } from '@/components/post/postQuotes';
import { useQuoteDraft } from '@/components/post/QuoteDraftFields';
import { QuoteInsertSheet } from '@/components/post/QuoteInsertSheet';
import { POST_IMAGE_MAX, usePhotoUploads } from '@/components/post/usePhotoUploads';
import { Button, Card, EmptyState, Eyebrow, FootAction, linkLabel } from '@/components/ui';
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 제목 길이 상한 — 서버 계약과 같은 값. */
const TITLE_MAX = POST_TITLE_MAX;
/** 공개 범위 칩(겉모습 34pt)의 위아래 터치 확장 — Button sm 과 같은 몫. */
const CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };
/** 종이 괘선 간격 = 본문 줄 높이. 글줄이 괘선 위에 앉는다. */
const BODY_LINE = 26;
/** 글이 짧아도 종이는 이만큼의 줄을 편다 — 빈 종이가 '여기 쓰면 된다'를 말한다. */
const MIN_BODY_LINES = 10;

/** 종이 머리의 날짜 — '2026.10.4'. 고치는 글은 처음 쓴 날, 새 글은 오늘. */
function paperDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/**
 * 독후감 쓰기·고치기 — 광장 헤더의 연필(빈 글), 책 상세(`bookId`, 그 책이 골라진 글),
 * 상세 `고치기`(`id`)에서 들어온다.
 *
 * 폼 상태는 안쪽 PostForm 이 마운트될 때 한 번에 시드한다 — 그래서 이 바깥 화면은 고칠 글·책을 먼저 받아
 * 오고 나서야 폼을 세운다(useBookPicker 의 initial 도 마운트 때 한 번만 읽힌다). 로딩·404·남의 글은 여기서 거른다.
 */
export default function PostEditorScreen() {
  const { id, bookId, clubId } = useLocalSearchParams<{
    id?: string; bookId?: string; clubId?: string;
  }>();
  const { colors } = useTheme();
  const postId = id ? Number(id) : NaN;
  const editing = Number.isFinite(postId);
  const bookParam = bookId ? Number(bookId) : NaN;
  const fromBook = !editing && Number.isFinite(bookParam);
  const category = editing ? '독후감 고치기' : '독후감 쓰기';
  const clubParam = clubId ? Number(clubId) : NaN;

  // 꺼진 쿼리에도 키는 있어야 한다 — NaN 을 키에 넣으면 서로 다른 화면이 한 자리를 나눠 쓰게 되므로 자리 키를 둔다.
  const post = useQuery({
    queryKey: editing ? postKey(postId) : ['post', 'pending'],
    queryFn: () => postApi.get(postId),
    enabled: editing,
  });
  // 책 상세와 같은 키 — 거기서 받아 둔 책이면 다시 부르지 않는다.
  const book = useQuery({
    queryKey: fromBook ? ['book', bookParam] : ['book', 'pending'],
    queryFn: () => bookApi.detail(bookParam),
    enabled: fromBook,
  });

  if ((editing && post.isLoading) || (fromBook && book.isLoading)) {
    return (
      <Shell category={category}>
        <View style={styles.skeleton}>
          <View style={[styles.skeletonBlock, { backgroundColor: colors.surface }]} />
        </View>
      </Shell>
    );
  }
  // 쿼리 객체 너머로는 좁혀지지 않아 한 번 꺼내 둔다 — 아래 분기가 전부 이 값으로 판단한다.
  const loaded = post.data;
  if (editing && !loaded) {
    // 지워졌거나 남의 글인 것(404·403)과 그냥 못 받은 것은 다른 이야기다 — 뒤엣것에는 다시 시도를 준다.
    const gone = post.error instanceof ApiError && (post.error.status === 404 || post.error.status === 403);
    return (
      <Shell category={category}>
        {gone ? (
          <EmptyState title="독후감을 불러오지 못했어요" description="지워졌거나 볼 수 없는 글이에요." />
        ) : (
          <EmptyState
            title="독후감을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={(
              <Pressable
                onPress={() => post.refetch()}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                style={styles.retry}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
              </Pressable>
            )}
          />
        )}
      </Shell>
    );
  }
  if (loaded && !loaded.mine) {
    return (
      <Shell category={category}>
        <EmptyState title="고칠 수 없는 글이에요" description="내가 쓴 글만 고칠 수 있어요." />
      </Shell>
    );
  }

  // 수정: 글의 책(없으면 '책 없음') · 책 상세에서: 그 책 · 그 밖: 기본값(읽는 중인 첫 책). 책 상세를 못 받았으면 기본값으로 간다.
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

  // 클럽 글인지 — 고치기는 글의 클럽(바꿀 수 없다), 새 글은 파라미터.
  const formClubId = loaded ? loaded.clubId : Number.isFinite(clubParam) ? clubParam : undefined;

  return (
    <PostForm key={editing ? `edit-${postId}` : 'new'} post={loaded} initialBook={initialBook} clubId={formClubId} />
  );
}

/** 폼 앞뒤의 셸 — 로딩·빈 상태도 같은 헤더 아래 놓인다. */
function Shell({ category, children }: { category: string; children: ReactNode }) {
  return (
    <PaperScreen>
      <SubHeader category={category} />
      {children}
    </PaperScreen>
  );
}

/**
 * 폼 본체 — `post` 가 있으면 고치기. 시드는 마운트 때 한 번(부모가 key 로 다시 세운다).
 * clubId 가 있으면 클럽 독후감 — 공개 범위가 클럽만·광장에도 둘이 되고, 새 글은 clubId 를 싣는다.
 */
function PostForm({ post, initialBook, clubId }: { post?: Post; initialBook?: PickedBook | null; clubId?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const editing = post != null;

  const picker = useBookPicker({ initial: initialBook });
  const book = picker.selected;
  // 수정 중인 글에 책이 있으면 바꿀 수만 있고 없앨 수 없다(서버 규칙) — '책 빼기'를 두지 않는다.
  const bookLocked = editing && post.bookId != null;

  const [title, setTitle] = useState(post?.title ?? '');
  // 옛 글은 밑줄 표시와 표시 없이 엮여만 있던 밑줄을 문장 조각 글로 바꿔 시작한다 — 초안을 만들 때 한 번만(마운트 시드).
  // 저장하면 밑줄 연결은 풀리고(quoteIds 빈 목록) 문장은 본문의 글로 남는다.
  // 사진을 따로 붙이던 옛 글은 그 사진을 글 맨 앞의 사진 줄로 넣어 시작한다 — 상세가 본문 앞에 그리던 자리와 같다.
  const [seed] = useState(() => {
    const quotes = post ? postBodyOf(post) : { text: '', moved: 0 };
    const photos = post ? placeLoosePhotos(quotes.text, post.images) : { text: quotes.text, placed: 0 };
    return { text: photos.text, moved: quotes.moved, placedPhotos: photos.placed };
  });
  const [bodyMd, setBodyMd] = useState(seed.text);
  const [mode, setMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const inClub = clubId != null;
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? defaultVisibility(inClub));
  const [quoting, setQuoting] = useState(false);
  // 문장 넣기 초안 — 시트 밖에 둬서, 바탕을 잘못 눌러 시트가 닫혀도 다시 열면 쓰던 문장이 그대로 있다.
  const quoteDraft = useQuoteDraft();
  // 문장을 넣을 자리 — 본문 칸에서 마지막으로 커서가 있던 곳. 기본은 글 끝이다.
  const [caret, setCaret] = useState<number | null>(null);
  // 문장을 넣은 직후 한 번만 실제 캐럿을 옮기려고 잡아 두는 자리. 평소에는 null(비제어)이다.
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const uploads = usePhotoUploads(post?.images ?? [], POST_IMAGE_MAX);
  const [bookSheet, setBookSheet] = useState(false);
  const [visibilitySheet, setVisibilitySheet] = useState(false);
  const [dateLabel] = useState(() => paperDate(post?.createdAt));
  const bodyRef = useRef<TextInput>(null);

  // 책 시트 — 열 때 지금 보이는 책(기본값 포함)을 고른 것으로 굳힌다. 시트에서 검색어를 치는 동안
  // 기본값이 풀려 뒤의 책 줄이 비어 버리지 않게. 닫을 때 검색어를 비워 다음에 열면 내 서재부터 보인다.
  const openBookSheet = () => {
    picker.pick(picker.selected);
    setBookSheet(true);
  };
  const closeBookSheet = () => {
    picker.setKeyword('');
    setBookSheet(false);
  };
  // 시트 안에서 책을 누르면 그걸로 끝 — 고르기 한 번에 닫힌다(UX 철칙 Hick).
  const sheetPicker = {
    ...picker,
    pick: (next: PickedBook | null) => {
      picker.pick(next);
      closeBookSheet();
    },
  };

  // 사진 고르기는 비동기다 — 창이 닫힌 뒤에도 최신 본문·커서에 넣도록 ref 로 본다.
  const latest = useRef({ bodyMd, caret });
  latest.current = { bodyMd, caret };

  // 커서 자리에 묶음(문장 조각·사진 줄)을 넣는다. 본문을 갈아 끼우면 실제 캐럿은 글 끝으로 튄다 —
  // 넣은 묶음 다음 자리로 되돌려 이어 쓰기와 다음에 넣을 자리를 화면과 맞춘다.
  const insertAtCaret = (block: string) => {
    const { bodyMd: current, caret: at } = latest.current;
    const { text, cursor } = insertBlock(current, at ?? current.length, block);
    setBodyMd(text);
    setCaret(cursor);
    setPendingSelection({ start: cursor, end: cursor });
  };

  // 시트에서 옮겨 적은 문장을 커서 자리에 조각 글(`>` 묶음)로 넣는다 — 그다음부터는 본문의 글이라 고치기·빼기도 본문에서 한다.
  const insertQuote = () => {
    insertAtCaret(quoteBlock(quoteDraft.body, pageSource(quoteDraft.pageValue)));
    quoteDraft.setContent('');
    quoteDraft.setPageText('');
    // 닫기는 여기서 한다 — 열림 상태를 이 화면이 쥐고 있고, 넣기와 닫기가 한 흐름이라 한자리에서 끝낸다.
    setQuoting(false);
  };

  // 사진을 골라 커서 자리에 사진 줄로 넣는다 — 상세에서도 그 자리에 선다. 올라가기를 기다리지 않고 자리부터 잡는다.
  const insertPhotos = async () => {
    const keys = await uploads.pick();
    if (keys.length === 0) return;
    insertAtCaret(keys.map((key) => photoMarker({ kind: 'upload', key })).join('\n\n'));
  };

  // 사진을 떼면 본문의 그 사진 줄도 함께 걷는다 — 올라가는 중(`upload:`)이든 이미 붙어 있던 사진(`image:`)이든.
  const removePhoto = (key: string) => {
    const id = uploads.photos.find((photo) => photo.key === key)?.image?.id;
    uploads.remove(key);
    setBodyMd((md) => removePhotoLines(md, (ref) => (ref.kind === 'upload' ? ref.key === key : ref.id === id)));
  };

  // 미리보기의 사진 줄 → 타일. 올라가는 중이면 고른 파일을, 올라갔으면 서버 사진을 그린다.
  const photoOf = (ref: PhotoRef): PhotoSource | null => {
    const photo = uploads.photos.find((p) => (ref.kind === 'upload' ? p.key === ref.key : p.image?.id === ref.id));
    const uri = photo?.image?.url ?? photo?.localUri;
    if (!photo || !uri) return null;
    return { uri, width: photo.image?.width ?? photo.width, height: photo.image?.height ?? photo.height };
  };
  // 고르기 창이 떠 있거나, 서버가 사진을 못 받거나, 장수가 찼으면 '+ 사진'을 잠근다.
  const photoLocked = uploads.picking || !uploads.retryable || uploads.photos.length >= POST_IMAGE_MAX;

  // 올라가는 중인 사진만 붙잡는다 — 실패한 타일까지 막으면 저장소가 꺼진 동안 글을 아예 못 올린다.
  // 실패한 사진은 imageIds 에 안 들어가므로 그대로 올리면 사진 없이 실린다.
  const canSubmit = title.trim().length > 0 && bodyMd.trim().length > 0 && !uploads.busy;

  const submit = useMutation({
    mutationFn: () => {
      // 공개 범위는 늘 명시한다 — 서버 기본값에 기대지 않는다.
      // 밑줄은 엮지 않는다 — 문장은 본문의 글이다. 고치기에서도 빈 목록을 보내 옛 글의 밑줄 연결을 푼다.
      // 사진 줄은 서버 사진 id 로 굳히고, 사진은 본문에 나온 차례대로 붙인다(첫 사진이 카드 포스터가 된다).
      const photos = finalizePhotoLines(bodyMd, uploads.photos);
      const base = {
        bookId: book?.bookId,
        title: title.trim(),
        bodyMd: photos.bodyMd,
        visibility,
        tags: [],
        imageIds: photos.imageIds,
        quoteIds: [],
      };
      return editing
        ? postApi.update(post.id, base)
        : postApi.create({ ...base, readingRecordId: book?.recordId, clubId });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(postKey(saved.id), saved);
      invalidatePostLists(queryClient);
      if (!editing) {
        router.replace(`/post/${saved.id}`);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/post/${post.id}`);
      }
    },
  });
  const errorMessage = submit.isError && !submit.isPending
    ? submit.error instanceof ApiError ? submit.error.message : '올리지 못했어요 · 다시 시도'
    : null;

  const visibilityChoices = visibilityOptions(inClub, post?.visibility);
  const visibilityLabel = visibilityChoices.find((option) => option.value === visibility)?.label ?? '공개';

  const submitLabel = editing ? '저장' : '올리기';
  // 종이 위 글자는 종이 잉크(onMemoPad)의 농담으로만 — 테마가 바뀌어도 종이는 종이색이다.
  const paperFaint = `${colors.onMemoPad}80`;
  const paperRule = `${colors.onMemoPad}1F`;

  return (
    <PaperScreen>
      <SubHeader
        category={editing ? '독후감 고치기' : '독후감 쓰기'}
        right={(
          <View style={styles.modeToggle}>
            <FootAction
              label={mode === 'WRITE' ? '미리보기' : '쓰기'}
              onPress={() => setMode(mode === 'WRITE' ? 'PREVIEW' : 'WRITE')}
              accessibilityLabel={mode === 'WRITE' ? '미리보기' : '계속 쓰기'}
            />
          </View>
        )}
      />

      <KeyboardArea>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          {/* ① 책 — 표지·제목 한 줄. 누르면 시트에서 바꾼다. 없어도 된다. */}
          <BookLine book={book} onPress={openBookSheet} />

          {mode === 'WRITE' ? (
            // ② 종이 한 장 — 입력 상자 없이 괘선 메모지에 제목과 본문을 바로 쓴다.
            <View style={[styles.paper, { backgroundColor: colors.memoPad, borderColor: colors.lineStrong }]}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="제목"
                placeholderTextColor={paperFaint}
                maxLength={TITLE_MAX}
                returnKeyType="next"
                onSubmitEditing={() => bodyRef.current?.focus()}
                accessibilityLabel="제목"
                style={[styles.titleInput, { color: colors.onMemoPad }]}
              />
              <Text style={[typeScale.monoLabel, { color: paperFaint }]}>{dateLabel}</Text>
              <View style={[styles.paperRule, { backgroundColor: `${colors.onMemoPad}47` }]} />
              <RuledBody color={paperRule}>
                {/*
                  selection 은 문장을 넣은 직후에만 준다 — 늘 물고 있으면 한글 조합(IME)이
                  글자마다 확정돼 끊기고, 되돌리기 자리도 어긋난다. 캐럿이 한 번 옮겨 가면
                  (onSelectionChange) 곧바로 놓아 비제어로 돌아간다. 사용자가 바로 타이핑해
                  그 알림이 오지 않는 경우를 대비해 onChangeText 에서도 놓아 준다.
                */}
                <TextInput
                  ref={bodyRef}
                  value={bodyMd}
                  selection={pendingSelection ?? undefined}
                  onChangeText={(text) => {
                    setBodyMd(text);
                    setPendingSelection(null);
                  }}
                  onSelectionChange={(e) => {
                    setCaret(e.nativeEvent.selection.start);
                    setPendingSelection(null);
                  }}
                  multiline
                  // 문법 안내는 빈 종이일 때만 — 쓰기 시작하면 사라져 종이를 어지럽히지 않는다.
                  placeholder={'이 책을 읽고 남은 생각을 적어 보세요.\n**굵게** · # 소제목 · - 목록 · > 문장'}
                  placeholderTextColor={paperFaint}
                  accessibilityLabel="본문"
                  style={[styles.bodyInput, { color: colors.onMemoPad }]}
                />
              </RuledBody>
            </View>
          ) : (
            // 미리보기 — 종이가 아니라 올린 뒤 보일 모습 그대로(화면 바탕 위 카드).
            <Card style={styles.preview}>
              {title.trim() ? (
                <Text style={[typeScale.titleSerif, { color: colors.text }]}>{title.trim()}</Text>
              ) : null}
              {bodyMd.trim() ? (
                <PostBody md={bodyMd} photoOf={photoOf} />
              ) : (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>미리 볼 내용이 없어요</Text>
              )}
            </Card>
          )}

          {/* 옛 글을 열었을 때만 — 아래에 모아 두던 밑줄을 본문 끝으로 옮겼다고 알린다. */}
          {seed.moved > 0 ? (
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              아래 모아 두었던 문장 {seed.moved}개를 본문 끝으로 옮겼어요 · 원하는 자리로 옮겨 보세요
            </Text>
          ) : null}
          {/* 사진을 따로 붙이던 옛 글을 열었을 때만 — 그 사진을 사진 줄로 글 맨 앞에 넣었다고 알린다. */}
          {seed.placedPhotos > 0 ? (
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              사진 {seed.placedPhotos}장을 본문 맨 앞에 넣었어요 · 원하는 자리로 옮겨 보세요
            </Text>
          ) : null}

          {/* ③ 사진 — 넣기는 하단 띠의 '+ 사진'(커서 자리)이 맡는다. 여기는 붙은 사진의 올라가는 상태·다시·떼기를
              보는 자리라, 붙은 사진도 알릴 것도 없으면 숨긴다. 떼면 본문의 사진 줄도 함께 빠진다. */}
          {uploads.photos.length > 0 || uploads.notice ? (
            <View style={styles.section}>
              <Eyebrow>사진 {uploads.photos.length}/{POST_IMAGE_MAX}</Eyebrow>
              <PhotoStrip
                photos={uploads.photos}
                onRetry={uploads.retry}
                onRemove={removePhoto}
                max={POST_IMAGE_MAX}
                retryable={uploads.retryable}
                notice={uploads.notice}
              />
            </View>
          ) : null}
        </ScrollView>

        {/*
          하단 띠 — 댓글 입력 바와 같은 자리(ScrollView 의 형제)라 키보드가 뜨면 그 위에 붙고,
          글이 길어져도 늘 손에 닿는다. 제출은 엄지가 닿는 여기 오른쪽에 둔다(UX 철칙 Fitts).
          '+ 문장'·'+ 사진'은 커서 자리에 문장 조각·사진을 끼워 넣는다 — 미리보기에는 넣을 커서가 없으니 쓰기일 때만 그린다.
          공개 범위는 올릴 때 정하는 것이라 '올리기' 바로 옆 칩으로 둔다(UX 철칙 Proximity).
          실패 안내도 제출 버튼 바로 위에 붙인다.
        */}
        <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          {errorMessage ? (
            <Text style={[typeScale.caption, { color: colors.danger }]}>{errorMessage}</Text>
          ) : null}
          <View style={styles.bottomRow}>
            {mode === 'WRITE' ? (
              <View style={styles.tools}>
                <FootAction label="+ 문장" onPress={() => setQuoting(true)} accessibilityLabel="문장 넣기" />
                <FootAction label="+ 사진" onPress={insertPhotos} disabled={photoLocked} accessibilityLabel="사진 넣기" />
              </View>
            ) : null}
            <View style={styles.submitGroup}>
              <Pressable
                onPress={() => setVisibilitySheet(true)}
                hitSlop={CHIP_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`공개 범위, ${visibilityLabel}`}
                style={({ pressed }) => [styles.visibilityChip, { borderColor: colors.control }, pressed ? pressedStyle : null]}
              >
                <Text style={[typeScale.label, { color: colors.text }]}>{visibilityLabel}</Text>
                <ChevronDown size={14} color={colors.textMuted} {...iconStroke} />
              </Pressable>
              <Button
                label={submitLabel}
                onPress={() => submit.mutate()}
                disabled={!canSubmit}
                loading={submit.isPending}
              />
            </View>
          </View>
        </KeyboardDock>
      </KeyboardArea>

      {quoting ? <QuoteInsertSheet draft={quoteDraft} onInsert={insertQuote} onClose={() => setQuoting(false)} /> : null}

      {/* 책 고르기 시트 — 내 서재의 책을 누르거나 검색해 고른다. 고르면 바로 닫힌다. */}
      {bookSheet ? (
        <NoteSheet visible title="책" onClose={closeBookSheet} scroll>
          <BookPicker picker={sheetPicker} />
          {/* 고치는 글에 책이 있으면 바꿀 수만 있고 뺄 수 없다(서버 규칙). 빼기는 고르기와 떨어진 맨 아래. */}
          {book != null && !bookLocked ? (
            <Pressable
              onPress={() => sheetPicker.pick(null)}
              accessibilityRole="button"
              accessibilityLabel="책 빼기"
              style={({ pressed }) => [styles.unpick, pressed ? pressedStyle : null]}
            >
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>책 없이 쓰기</Text>
            </Pressable>
          ) : null}
        </NoteSheet>
      ) : null}

      {/* 공개 범위 시트 — 고르면 바로 닫힌다. 고른 것은 잉크 라디오. */}
      {visibilitySheet ? (
        <NoteSheet visible title="공개 범위" onClose={() => setVisibilitySheet(false)}>
          {visibilityChoices.map((option) => {
            const on = option.value === visibility;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setVisibility(option.value);
                  setVisibilitySheet(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={option.label}
                style={({ pressed }) => [styles.option, pressed ? pressedStyle : null]}
              >
                <View style={[styles.radio, { borderColor: on ? colors.ink : colors.lineStrong }]}>
                  {on ? <View style={[styles.radioDot, { backgroundColor: colors.ink }]} /> : null}
                </View>
                <View style={styles.optionText}>
                  <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{option.label}</Text>
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>{visibilityCaption(option.value, inClub)}</Text>
                </View>
              </Pressable>
            );
          })}
        </NoteSheet>
      ) : null}
    </PaperScreen>
  );
}

/** 책 한 줄 — 작은 표지 · 제목 · 저자. 줄 전체가 눌려 책 시트를 연다(UX 철칙 Fitts). */
function BookLine({ book, onPress }: { book: PickedBook | null; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = book ? [book.author, book.recordId != null ? '내 서재' : null].filter(Boolean).join(' · ') : '책 없이 써도 돼요';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={book ? `책 바꾸기, ${book.title}` : '책 고르기'}
      style={({ pressed }) => [styles.bookLine, pressed ? pressedStyle : null]}
    >
      {book ? (
        <TiltCover uri={book.coverUrl} title={book.title} width={30} tilt={-3} entering={false} />
      ) : (
        <View style={[styles.emptyCover, { borderColor: colors.lineStrong }]} />
      )}
      <View style={styles.bookText}>
        <Text numberOfLines={1} style={[typeScale.label, { color: book ? colors.text : colors.textMuted }]}>
          {book ? book.title : '책 고르기'}
        </Text>
        {meta ? <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textFaint }]}>{meta}</Text> : null}
      </View>
      <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{book ? '바꾸기' : '고르기'}</Text>
    </Pressable>
  );
}

/**
 * 괘선 본문 — 줄 높이(BODY_LINE)마다 머리카락 선을 그어 글줄이 선 위에 앉게 한다.
 * 칸 높이를 재서 그만큼만 긋고, 선은 입력 뒤에 깔려 터치를 그대로 통과시킨다.
 */
function RuledBody({ color, children }: { color: string; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const count = Math.floor(height / BODY_LINE);
  return (
    <View style={styles.ruled} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.ruleLine, { top: (i + 1) * BODY_LINE - hairline, backgroundColor: color }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow — 글이 짧아도 종이가 하단 띠 바로 위까지 내려온다. 띠는 스크롤의 형제라 그 몫의 여백은 따로 두지 않는다.
  container: {
    ...layout.content,
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: { gap: spacing.md },
  // 책 한 줄 — 44pt 이상 높이(표지 45)라 줄 전체가 손가락 상자다.
  bookLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  emptyCover: { width: 30, height: 45, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.sm },
  bookText: { flex: 1, gap: 2 },
  // 종이 — 괘선 메모지 한 장(카드 모서리, 머리카락 테두리). 미리보기의 카드와 같은 폭.
  paper: {
    flexGrow: 1,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingTop: spacing.lg + spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  titleInput: {
    padding: 0,
    fontFamily: serif.extraBold,
    fontSize: 23,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  // 제목과 본문 사이 굵은 괘선 하나 — 위 날짜 줄과는 붙고, 본문과는 한 줄만큼 띄운다.
  paperRule: { height: hairline, marginTop: spacing.md, marginBottom: spacing.sm },
  ruled: { flexGrow: 1, minHeight: BODY_LINE * MIN_BODY_LINES },
  ruleLine: { position: 'absolute', left: 0, right: 0, height: hairline },
  // 본문 — 줄 높이를 괘선 간격과 맞춘다. 안쪽 여백을 없애야 첫 줄이 첫 괘선 위에 앉는다.
  bodyInput: {
    flexGrow: 1,
    minHeight: BODY_LINE * MIN_BODY_LINES,
    padding: 0,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: BODY_LINE,
    textAlignVertical: 'top',
  },
  preview: { gap: spacing.md },
  // 하단 고정 띠 — 댓글 입력 바와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  // 공개 범위 칩 + 제출 — 띠 오른쪽 끝에 붙인다. 칩과 버튼은 함께 쓰는 동작이라 붙여 둔다.
  submitGroup: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // 칩 — 겉모습 34pt(Button sm 과 같다), 위아래 hitSlop 으로 44pt 이상 눌린다.
  visibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 34,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: hairline,
    borderRadius: radius.sm,
  },
  // 커서 자리에 넣는 도구 둘 — 작은 테두리 버튼(FootAction). 터치 상자는 위아래로만 넓어지니 sm 간격이면 떨어진다.
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // 헤더 오른쪽 '미리보기' — 44pt 상자 안의 작은 테두리 버튼.
  modeToggle: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  // 시트 맨 아래 '책 없이 쓰기' — 모노 한 줄을 44pt 상자로.
  unpick: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  // 공개 범위 한 줄 — 라디오 · 이름 · 설명. 줄 전체가 눌린다.
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  radio: { width: 20, height: 20, borderRadius: radius.round, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radius.round },
  optionText: { flex: 1, gap: 2 },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 44pt 상자를 만든다.
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  skeleton: { ...layout.content, padding: spacing.lg },
  skeletonBlock: { height: 240, borderRadius: radius.md },
});
