import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey } from '@/api/postCache';
import type { BookQuote, Post, PostVisibility } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import type { PickedBook } from '@/components/book/BookPicker';
import { PaperScreen, SubHeader } from '@/components/collage';
import { PhotoStrip } from '@/components/post/PhotoStrip';
import { PostBody } from '@/components/post/PostBody';
import { QuoteAttachSheet } from '@/components/post/QuoteAttachSheet';
import { insertQuoteMarkers, parseQuoteIds } from '@/components/post/quoteMarkers';
import { POST_IMAGE_MAX, usePhotoUploads } from '@/components/post/usePhotoUploads';
import { Card, EmptyState, Eyebrow, Field, Segmented } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 글 하나에 엮을 수 있는 밑줄 수 — 서버 상한과 같은 값. */
const POST_QUOTE_MAX = 10;
/** 제목 길이 상한 — 서버 계약과 같은 값. */
const TITLE_MAX = 300;
/** 하단 '오려둔 문장' 띠의 대략 높이(36px 터치 상자 + 위아래 여백) — 본문 아래 여백을 이만큼 더 준다. */
const QUOTE_BAR_HEIGHT = 60;

const VISIBILITY_CAPTION: Record<PostVisibility, string> = {
  PUBLIC: '광장·책 상세에 실립니다',
  PRIVATE: '나만 봅니다',
  LINK: '링크로만 볼 수 있어요',
};

/**
 * 독후감 쓰기·고치기 — 광장 `+ 독후감`(빈 글), 책 상세(`bookId`, 그 책이 골라진 글), 상세 `고치기`(`id`)에서 들어온다.
 *
 * 폼 상태는 안쪽 PostForm 이 마운트될 때 한 번에 시드한다 — 그래서 이 바깥 화면은 고칠 글·책을 먼저 받아
 * 오고 나서야 폼을 세운다(useBookPicker 의 initial 도 마운트 때 한 번만 읽힌다). 로딩·404·남의 글은 여기서 거른다.
 */
export default function PostEditorScreen() {
  const { id, bookId } = useLocalSearchParams<{ id?: string; bookId?: string }>();
  const { colors } = useTheme();
  const postId = id ? Number(id) : NaN;
  const editing = Number.isFinite(postId);
  const bookParam = bookId ? Number(bookId) : NaN;
  const fromBook = !editing && Number.isFinite(bookParam);
  const category = editing ? '독후감 고치기' : '독후감 쓰기';

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
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
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
        <EmptyState title="고칠 수 없는 글입니다" description="내가 쓴 글만 고칠 수 있어요." />
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

  return <PostForm key={editing ? `edit-${postId}` : 'new'} post={loaded} initialBook={initialBook} />;
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

/** 폼 본체 — `post` 가 있으면 고치기. 시드는 마운트 때 한 번(부모가 key 로 다시 세운다). */
function PostForm({ post, initialBook }: { post?: Post; initialBook?: PickedBook | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const editing = post != null;

  const picker = useBookPicker({ initial: initialBook });
  const book = picker.selected;
  // 수정 중인 글에 책이 있으면 바꿀 수만 있고 없앨 수 없다(서버 규칙) — '책 빼기'를 두지 않는다.
  const bookLocked = editing && post.bookId != null;

  const [title, setTitle] = useState(post?.title ?? '');
  // 표시 없이 엮여만 있던 밑줄은 본문 끝으로 옮겨 둔다 — 초안을 만들 때 한 번만(마운트 시드).
  const [seed] = useState(() => seedBody(post?.bodyMd ?? '', post?.quotes ?? []));
  const [bodyMd, setBodyMd] = useState(seed.text);
  const [mode, setMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? 'PUBLIC');
  // 아는 밑줄 보관함 — 본문 표시가 가리키는 조각을 미리보기에서 그리려면 id 말고 객체가 있어야 한다.
  // 첨부 자체는 본문 표시에서 파생하므로 여기서 빼지 않는다. 책과 무관하다(책을 바꿔도 남는다).
  const [quotes, setQuotes] = useState<BookQuote[]>(post?.quotes ?? []);
  const [picking, setPicking] = useState(false);
  // 표시를 넣을 자리 — 본문 칸에서 마지막으로 커서가 있던 곳. 기본은 글 끝이다.
  const [caret, setCaret] = useState<number | null>(null);
  // 표시를 넣은 직후 한 번만 실제 캐럿을 옮기려고 잡아 두는 자리. 평소에는 null(비제어)이다.
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);
  const uploads = usePhotoUploads(post?.images ?? [], POST_IMAGE_MAX);

  // 첨부는 본문 표시에서 뽑는다 — 표시를 지우면 첨부도 풀린다.
  const bodyQuoteIds = parseQuoteIds(bodyMd);
  // 그중 화면이 실체를 아는 밑줄만 보낸다 — 서버는 남의 밑줄도 받지만 없는 밑줄은 거부하므로, 이미 지워진
  // 밑줄을 가리키는 표시를 그대로 보내면 저장이 400 으로 막힌다. 손으로 써 넣은 표시만이 아니라,
  // 글에 붙인 밑줄을 밑줄 화면에서 지운 뒤 고치기로 여는 정상 경로에서도 그렇게 된다.
  // 걸러진 표시는 사용자가 쓴 글이라 본문에 그대로 둔다 — 상세·미리보기에서 그 자리만 빈다.
  const knownQuoteIds = new Set(quotes.map((quote) => quote.id));
  const attachQuoteIds = bodyQuoteIds.filter((id) => knownQuoteIds.has(id));
  // 상한 판정·표기도 실제로 보낼 수와 같은 기준으로 센다 — 화면 숫자와 저장 결과가 어긋나지 않게.
  const overQuoteMax = attachQuoteIds.length > POST_QUOTE_MAX;

  // 시트에서 고른 밑줄 하나를 커서 자리에 넣는다 — 넣기만 있다. 빼기는 본문에서 그 표시 줄을 지우는 것뿐이다.
  const insertQuote = (quote: BookQuote) => {
    setQuotes((prev) => (
      // 아는 밑줄이면 새로 받은 객체로 갈아 끼우고(순서는 그대로), 모르는 밑줄만 뒤에 더한다.
      // 시트가 모르는 밑줄(고치기로 들어온 것)은 그대로 남는다 — 보관함에서는 아무것도 빼지 않는다.
      prev.some((known) => known.id === quote.id)
        ? prev.map((known) => (known.id === quote.id ? quote : known))
        : [...prev, quote]
    ));
    // 이미 본문에 있으면 두 번 넣지 않는다 — 시트가 막지만, 보관함만 갱신하고 조용히 지나간다.
    if (!bodyQuoteIds.includes(quote.id)) {
      const { text, cursor } = insertQuoteMarkers(bodyMd, caret ?? bodyMd.length, [quote.id]);
      setBodyMd(text);
      setCaret(cursor);
      // 본문을 갈아 끼우면 실제 캐럿은 글 끝으로 튄다 — 넣은 자리로 되돌려 다음에 넣을 자리를 화면과 맞춘다.
      setPendingSelection({ start: cursor, end: cursor });
    }
    // 닫기는 여기서 한다 — 열림 상태를 이 화면이 쥐고 있고, 넣기와 닫기가 한 흐름이라 한자리에서 끝낸다.
    setPicking(false);
  };

  // 올라가는 중인 사진만 붙잡는다 — 실패한 타일까지 막으면 저장소가 꺼진 동안 글을 아예 못 올린다.
  // 실패한 사진은 imageIds 에 안 들어가므로 그대로 올리면 사진 없이 실린다.
  const canSubmit = title.trim().length > 0 && bodyMd.trim().length > 0 && !uploads.busy && !overQuoteMax;

  const submit = useMutation({
    mutationFn: () => {
      // 공개 범위는 늘 명시한다 — 서버 기본값에 기대지 않는다.
      const base = {
        bookId: book?.bookId,
        title: title.trim(),
        bodyMd,
        visibility,
        tags: [],
        imageIds: uploads.imageIds,
        quoteIds: attachQuoteIds,
      };
      return editing
        ? postApi.update(post.id, base)
        : postApi.create({ ...base, readingRecordId: book?.recordId });
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
  const disabled = !canSubmit || submit.isPending;
  const errorMessage = submit.isError && !submit.isPending
    ? submit.error instanceof ApiError ? submit.error.message : '올리지 못했어요 · 다시 시도'
    : null;

  const visibilityOptions: { value: PostVisibility; label: string }[] = [
    { value: 'PUBLIC', label: '공개' },
    { value: 'PRIVATE', label: '비공개' },
    // 링크 공개는 앱에서 새로 고르지 않는다 — 이미 링크 공개인 글을 고칠 때만 그대로 둘 수 있게 보인다.
    ...(editing && post.visibility === 'LINK' ? [{ value: 'LINK' as const, label: '링크' }] : []),
  ];

  const submitLabel = editing ? '저장' : '올리기';
  const submitPill = (
    <Pressable
      onPress={() => submit.mutate()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={submitLabel}
      accessibilityState={{ disabled }}
      style={[styles.submit, { backgroundColor: colors.accent, opacity: disabled ? 0.35 : 1 }]}
    >
      <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
        {submit.isPending ? (editing ? '저장 중…' : '올리는 중…') : submitLabel}
      </Text>
    </Pressable>
  );

  return (
    <PaperScreen>
      <SubHeader category={editing ? '독후감 고치기' : '독후감 쓰기'} right={submitPill} />
      {errorMessage ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.warn }]}>{errorMessage}</Text>
      ) : null}
      {overQuoteMax ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.warn }]}>
          오려둔 문장은 {POST_QUOTE_MAX}개까지 넣을 수 있어요 · 지금 {attachQuoteIds.length}개
        </Text>
      ) : null}

      {/* 오프셋 없음 — 헤더가 없어 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(모임 토론과 같은 이유). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          {/* ① 책 — 없어도 된다. 책과 밑줄은 무관하다. */}
          <View style={styles.section}>
            <Eyebrow>책</Eyebrow>
            <BookPicker picker={picker} />
            {book == null ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>책 없이 써도 돼요</Text>
            ) : !bookLocked ? (
              <Pressable
                onPress={() => picker.pick(null)}
                accessibilityRole="button"
                accessibilityLabel="책 빼기"
                style={styles.unpick}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>책 빼기 ×</Text>
              </Pressable>
            ) : null}
          </View>

          {/* ② 제목 */}
          <Field
            label="제목"
            value={title}
            onChangeText={setTitle}
            placeholder="한 줄로 남기는 제목"
            maxLength={TITLE_MAX}
            accessibilityLabel="제목"
          />

          {/* ③ 본문 — 쓰기 / 미리보기 */}
          <View style={styles.section}>
            <Eyebrow>본문</Eyebrow>
            <Segmented
              options={[{ value: 'WRITE', label: '쓰기' }, { value: 'PREVIEW', label: '미리보기' }]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'WRITE' ? (
              <>
                {/*
                  selection 은 표시를 넣은 직후에만 준다 — 늘 물고 있으면 한글 조합(IME)이
                  글자마다 확정돼 끊기고, 되돌리기 자리도 어긋난다. 캐럿이 한 번 옮겨 가면
                  (onSelectionChange) 곧바로 놓아 비제어로 돌아간다. 사용자가 바로 타이핑해
                  그 알림이 오지 않는 경우를 대비해 onChangeText 에서도 놓아 준다.
                */}
                <TextInput
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
                  placeholder="이 책을 읽고 남은 생각을 적어 보세요. 마크다운을 쓸 수 있어요."
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="본문"
                  style={[styles.bodyInput, {
                    backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
                  }]}
                />
                {/* 옛 글을 열었을 때만 — 아래에 모아 두던 밑줄을 본문 끝으로 옮겼다고 알린다. */}
                {seed.moved > 0 ? (
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                    아래 모아 두었던 문장 {seed.moved}개를 본문 끝으로 옮겼어요 · 원하는 자리로 옮겨 보세요
                  </Text>
                ) : null}
                {/* 첨부는 본문 표시에서 파생한다 — 시트에 '떼기'가 없으니 빼는 길을 짚어 준다. 넣은 게 있을 때만. */}
                {bodyQuoteIds.length > 0 ? (
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                    문장을 빼려면 본문에서 그 줄을 지우세요
                  </Text>
                ) : null}
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  **굵게** · _기울임_ · # 제목 · - 목록 · {'>'} 인용
                </Text>
              </>
            ) : (
              <Card>
                {bodyMd.trim() ? (
                  <PostBody md={bodyMd} quotes={quotes} />
                ) : (
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>미리볼 내용이 없어요</Text>
                )}
              </Card>
            )}
          </View>

          {/* ④ 사진 */}
          <View style={styles.section}>
            <Eyebrow>사진 {uploads.photos.length}/{POST_IMAGE_MAX}</Eyebrow>
            <PhotoStrip
              photos={uploads.photos}
              onPick={uploads.pick}
              onRetry={uploads.retry}
              onRemove={uploads.remove}
              max={POST_IMAGE_MAX}
              disabled={uploads.picking || !uploads.retryable}
              retryable={uploads.retryable}
              notice={uploads.notice}
            />
          </View>

          {/* ⑤ 공개 범위 */}
          <View style={styles.section}>
            <Eyebrow>공개 범위</Eyebrow>
            <Segmented options={visibilityOptions} value={visibility} onChange={setVisibility} />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>{VISIBILITY_CAPTION[visibility]}</Text>
          </View>
        </ScrollView>

        {/*
          커서 자리에 밑줄을 끼워 넣는 띠 — 댓글 입력 바와 같은 자리(ScrollView 의 형제)라
          키보드가 뜨면 그 위에 붙고, 글이 길어져도 늘 손에 닿는다. 뗄 때는 본문에서 그 줄을 지운다.
          미리보기에는 넣을 커서가 없으니 쓰기일 때만 그린다.
        */}
        {mode === 'WRITE' ? (
          <View style={[styles.quoteBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
            <Pressable
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel="오려둔 문장 넣기"
              style={styles.insertQuote}
            >
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 오려둔 문장</Text>
            </Pressable>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {attachQuoteIds.length}/{POST_QUOTE_MAX}
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {picking ? (
        <QuoteAttachSheet
          book={book}
          selectedIds={attachQuoteIds}
          onPick={insertQuote}
          onClose={() => setPicking(false)}
          max={POST_QUOTE_MAX}
        />
      ) : null}
    </PaperScreen>
  );
}

/**
 * 고치기 시드 — 본문에 표시가 없는 첨부를 본문 끝에 표시로 옮긴다(원래 순서 그대로).
 *
 * 표시가 곧 첨부라, 표시 없이 `quoteIds` 로만 엮여 있던 옛 글은 그대로 저장하면 첨부가 통째로 풀린다.
 * 옮긴 수를 함께 돌려줘 화면이 한 줄로 알린다. 새 글은 첨부가 없어 늘 그대로 지나간다.
 */
function seedBody(bodyMd: string, quotes: BookQuote[]): { text: string; moved: number } {
  const inBody = new Set(parseQuoteIds(bodyMd));
  const missing = quotes.filter((quote) => !inBody.has(quote.id)).map((quote) => quote.id);
  if (missing.length === 0) return { text: bodyMd, moved: 0 };
  return { text: insertQuoteMarkers(bodyMd, bodyMd.length, missing).text, moved: missing.length };
}

const styles = StyleSheet.create({
  // 아래 여백은 띠 높이만큼 더 둔다 — 키보드가 올라와 보이는 자리가 줄어도 마지막 칸을 띠 위로 밀어 올릴 수 있게.
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + QUOTE_BAR_HEIGHT },
  section: { gap: spacing.md },
  // 하단 고정 띠 — 댓글 입력 바와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  quoteBar: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  // 헤더 우측 제출 알약 — 광장 컴포저의 오려두기 알약과 같은 만듦새.
  submit: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  error: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  // 본문 칸 — 오려두기의 문장 칸과 같은 활자(quote 토큰 15/25), 길게 쓰는 글이라 높이만 키운다.
  bodyInput: {
    minHeight: 220,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typeScale.quote,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  // 모노 한 줄 — 여백으로 터치 상자를 키우고 같은 만큼 음수 마진으로 리듬은 그대로 둔다.
  unpick: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginVertical: -spacing.xs },
  // 10px 모노 라벨이라 글자 상자만으로는 손가락이 닿지 않는다 — 웹은 hitSlop 을 무시하므로 여백으로 키운다.
  insertQuote: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
  skeleton: { ...layout.content, padding: spacing.lg },
  skeletonBlock: { height: 240, borderRadius: radius.md },
});
