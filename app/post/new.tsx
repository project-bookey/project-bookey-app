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
import { PostMarkdown } from '@/components/post/PostMarkdown';
import { QuoteAttachSheet } from '@/components/post/QuoteAttachSheet';
import { POST_IMAGE_MAX, usePhotoUploads } from '@/components/post/usePhotoUploads';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { Card, EmptyState, Eyebrow, Field, FootAction, Segmented } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 글 하나에 엮을 수 있는 밑줄 수 — 서버 상한과 같은 값. */
const POST_QUOTE_MAX = 10;
/** 제목 길이 상한 — 서버 계약과 같은 값. */
const TITLE_MAX = 300;

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

  const post = useQuery({ queryKey: postKey(postId), queryFn: () => postApi.get(postId), enabled: editing });
  // 책 상세와 같은 키 — 거기서 받아 둔 책이면 다시 부르지 않는다.
  const book = useQuery({ queryKey: ['book', bookParam], queryFn: () => bookApi.detail(bookParam), enabled: fromBook });

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
    return (
      <Shell category={category}>
        <EmptyState title="독후감을 불러오지 못했습니다" description="지워졌거나 볼 수 없는 글입니다." />
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
  const [bodyMd, setBodyMd] = useState(post?.bodyMd ?? '');
  const [mode, setMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility ?? 'PUBLIC');
  // 엮은 밑줄 — id 만이 아니라 객체를 들고 있어야 시트 밖에서 조각을 그린다. 책과 무관하다(책을 바꿔도 남는다).
  const [quotes, setQuotes] = useState<BookQuote[]>(post?.quotes ?? []);
  const [picking, setPicking] = useState(false);
  const uploads = usePhotoUploads(post?.images ?? [], POST_IMAGE_MAX);

  const attach = (nextIds: number[], known: BookQuote[]) => {
    setQuotes((prev) => {
      // 시트가 모르는 밑줄(고치기로 들어온 것)은 이미 갖고 있던 객체로 채운다.
      const byId = new Map([...prev, ...known].map((quote) => [quote.id, quote] as const));
      return nextIds.flatMap((id) => { const q = byId.get(id); return q ? [q] : []; });
    });
  };
  const detach = (quoteId: number) => setQuotes((prev) => prev.filter((quote) => quote.id !== quoteId));

  const canSubmit =
    title.trim().length > 0 && bodyMd.trim().length > 0 && !uploads.photos.some((p) => p.status !== 'done');

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
        quoteIds: quotes.map((quote) => quote.id),
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
                <TextInput
                  value={bodyMd}
                  onChangeText={setBodyMd}
                  multiline
                  placeholder="이 책을 읽고 남은 생각을 적어 보세요. 마크다운을 쓸 수 있어요."
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="본문"
                  style={[styles.bodyInput, {
                    backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
                  }]}
                />
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  **굵게** · _기울임_ · # 제목 · - 목록 · {'>'} 인용
                </Text>
              </>
            ) : (
              <Card>
                {bodyMd.trim() ? (
                  <PostMarkdown md={bodyMd} />
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
            />
          </View>

          {/* ⑤ 오려둔 문장 — 조각은 누르지 않고(상세로 가지 않는다) 옆의 '떼기'만 있다 */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Eyebrow>오려둔 문장 {quotes.length}/{POST_QUOTE_MAX}</Eyebrow>
              <Pressable
                onPress={() => setPicking(true)}
                accessibilityRole="button"
                accessibilityLabel="밑줄 고르기"
                style={styles.pickQuotes}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>고르기 →</Text>
              </Pressable>
            </View>
            {quotes.map((quote, i) => (
              <QuoteScrap
                key={quote.id}
                quote={quote}
                rotate={i % 2 === 0 ? -1 : 1}
                trailing={<FootAction label="떼기" onPress={() => detach(quote.id)} accessibilityLabel="밑줄 떼기" />}
              />
            ))}
          </View>

          {/* ⑥ 공개 범위 */}
          <View style={styles.section}>
            <Eyebrow>공개 범위</Eyebrow>
            <Segmented options={visibilityOptions} value={visibility} onChange={setVisibility} />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>{VISIBILITY_CAPTION[visibility]}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {picking ? (
        <QuoteAttachSheet
          book={book}
          selectedIds={quotes.map((quote) => quote.id)}
          onChange={attach}
          onClose={() => setPicking(false)}
          max={POST_QUOTE_MAX}
        />
      ) : null}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  pickQuotes: { minHeight: 36, justifyContent: 'center', paddingLeft: spacing.md },
  skeleton: { ...layout.content, padding: spacing.lg },
  skeletonBlock: { height: 240, borderRadius: radius.md },
});
