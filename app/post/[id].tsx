import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey } from '@/api/postCache';
import type { Post } from '@/api/types';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { PostBody, usedQuoteIds } from '@/components/post/PostBody';
import { VISIBILITY_LABEL } from '@/components/post/PostCard';
import { useLikePost } from '@/components/post/useLikePost';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { EmptyState, Eyebrow, FootAction, Tag, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 독후감 상세 — 광장 독후감 카드·책 상세·내 독후감에서 들어온다.
 * 글 한 편(표지·제목·바이라인·사진·본문·엮은 밑줄·액션 행)만 펼친다.
 * 댓글은 없다 — 독후감의 상호작용은 좋아요와 엽서뿐이다(§14.1, v1.2 확정).
 */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressLike = useLikePost();

  const post = useQuery({
    queryKey: postKey(postId),
    queryFn: () => postApi.get(postId),
    enabled: Number.isFinite(postId),
  });

  // 글 삭제 재확인 — 글 전용 타이머다. 댓글 삭제는 스레드가 자기 타이머로 따로 확인한다.
  const { confirm, arm, disarm } = useDeleteConfirm<'post'>();
  const confirming = confirm === 'post';

  const [removeError, setRemoveError] = useState<string | null>(null);
  const removePost = useMutation({
    mutationFn: () => postApi.remove(postId),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      invalidatePostLists(queryClient);
      queryClient.removeQueries({ queryKey: postKey(postId), exact: true });
      if (router.canGoBack()) router.back();
      else router.replace('/plaza');
    },
    onError: (error) => {
      setRemoveError(error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도');
    },
  });
  const pressDeletePost = () => {
    if (confirming) {
      disarm();
      removePost.mutate();
      return;
    }
    arm('post');
  };

  // 본인 글에만 '고치기' — 작성 화면을 수정 모드로 연다.
  const editAction = post.data?.mine ? (
    <Pressable
      onPress={() => router.push({ pathname: '/post/new', params: { id: String(postId) } })}
      accessibilityRole="button"
      accessibilityLabel="독후감 고치기"
      style={styles.edit}
    >
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>고치기</Text>
    </Pressable>
  ) : undefined;

  const header = post.data ? (
    <PostArticle
      post={post.data}
      confirming={confirming}
      error={removeError}
      onLike={() => pressLike(postId)}
      onDelete={post.data.mine ? pressDeletePost : undefined}
    />
  ) : null;

  // 글을 아직 못 받았을 때만 목록 자리를 대신한다 — 받고 나면 null 을 넘겨 스레드가 자기 빈 문구를 쓴다.
  // 404 와 403(남의 비공개 글)은 같은 안내다 — 있는지 없는지를 굳이 가르지 않는다.
  const placeholder = !Number.isFinite(postId) ? (
    <EmptyState
      title="독후감을 불러오지 못했어요"
      description="지워졌거나 볼 수 없는 글이에요."
    />
  ) : post.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : post.isError ? (
    post.error instanceof ApiError && (post.error.status === 404 || post.error.status === 403) ? (
      <EmptyState
        title="독후감을 불러오지 못했어요"
        description="지워졌거나 볼 수 없는 글이에요."
      />
    ) : (
      <EmptyState
        title="독후감을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Pressable onPress={() => post.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
          </Pressable>
        }
      />
    )
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="독후감" right={editAction} />
      <ScrollView contentContainerStyle={styles.screenBody}>
        {placeholder ?? header}
      </ScrollView>
    </PaperScreen>
  );
}

/** 사진 한 변(px) — 인화지를 가로로 늘어놓은 크기. 확대는 없다. */
const PHOTO = 160;

/**
 * 글 한 편 — 스레드의 header 로 들어간다.
 * 카드에 넣지 않고 종이 위에 바로 펼친다 — 긴 글이라 상자보다 지면이 읽기 편하고, 기울인 표지·사진의 그림자도 잘리지 않는다.
 */
function PostArticle({ post, confirming, error, onLike, onDelete }: {
  post: Post;
  /** 삭제 재확인 상태 — 라벨이 '한 번 더'로 바뀐다. */
  confirming: boolean;
  /** 삭제 실패 안내. */
  error: string | null;
  onLike: () => void;
  /** 본인 글에서만 넘긴다. */
  onDelete?: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const hasBook = post.bookId != null;
  const visibilityLabel = post.visibility === 'PUBLIC' ? null : VISIBILITY_LABEL[post.visibility];

  // 본문 표시가 소비하지 않은 밑줄만 아래에 모은다 — 표시로 넣은 것을 두 번 보여주지 않는다.
  const leftoverQuotes = useMemo(() => {
    const used = usedQuoteIds(post.bodyMd, post.quotes);
    return post.quotes.filter((quote) => !used.has(quote.id));
  }, [post.bodyMd, post.quotes]);

  return (
    <View style={styles.article}>
      {/* ① 히어로 — 책에 매인 글은 표지를 세우고 제목 아래 책으로 가는 길을 둔다 */}
      <View style={styles.hero}>
        {hasBook ? (
          <TiltCover uri={post.bookCoverUrl} title={post.bookTitle} width={72} tilt={-3} entering={false} />
        ) : null}
        <View style={styles.heroText}>
          <Text numberOfLines={3} style={[styles.title, { color: colors.text }]}>{post.title}</Text>
          {hasBook ? (
            <Pressable
              onPress={() => router.push(`/book/${post.bookId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${post.bookTitle} 상세`}
              style={styles.bookLink}
            >
              <Text numberOfLines={1} style={[typeScale.monoLabel, styles.bookLinkText, { color: colors.accent }]}>
                {post.bookTitle} →
              </Text>
            </Pressable>
          ) : (
            <Text style={[typeScale.monoLabel, styles.bookLinkText, { color: colors.textFaint }]}>책 없음</Text>
          )}
        </View>
      </View>

      {/* ② 바이라인 — 작성자 · 올린 때 · 조회. 본인의 비공개·링크 글에는 공개 범위를 밝힌다 */}
      <View style={styles.byline}>
        <QuoteAvatar uri={post.authorAvatarUrl} nickname={post.authorNickname} />
        <View style={styles.bylineText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {post.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
            {formatRelative(post.publishedAt ?? post.createdAt)} · 조회 {post.viewCount}
          </Text>
        </View>
        {post.mine && visibilityLabel ? <Tag label={visibilityLabel} /> : null}
      </View>

      {/* ③ 사진 — 인화지를 가로로 늘어놓는다. 번갈아 살짝 기울여 붙인 티를 낸다 */}
      {post.images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {post.images.map((image, i) => (
            <Image
              key={image.id}
              source={{ uri: image.url }}
              resizeMode="cover"
              accessibilityLabel={`사진 ${i + 1}/${post.images.length}`}
              style={[
                styles.photo,
                { borderColor: colors.line, transform: [{ rotate: `${i % 2 === 0 ? -1.5 : 1.5}deg` }] },
              ]}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* ④ 본문 — 표시가 있는 자리에 오려둔 문장이 들어간다 */}
      <PostBody
        md={post.bodyMd}
        quotes={post.quotes}
        onPressQuote={(quoteId) => router.push(`/quote/${quoteId}`)}
      />

      {/* ⑤ 본문에 넣지 않은 밑줄 — 표시 없이 엮기만 하던 옛 글을 위해 남긴다 */}
      {leftoverQuotes.length > 0 ? (
        <View style={styles.quotes}>
          <Eyebrow plain>오려둔 문장 {leftoverQuotes.length}</Eyebrow>
          {leftoverQuotes.map((quote, i) => (
            <QuoteScrap
              key={quote.id}
              quote={quote}
              rotate={i % 2 === 0 ? -1 : 1}
              // 본문 안 조각과 같은 규칙 — 글쓴이 것이 아니면 누가 오려뒀는지 밝힌다.
              showAuthor
              onPress={() => router.push(`/quote/${quote.id}`)}
            />
          ))}
        </View>
      ) : null}

      {/* ⑥ 액션 행 — 독후감 카드 푸터와 같은 배치. 댓글은 없다(§14.1) */}
      <View style={styles.footRow}>
        <FootAction label={`좋아요 ${post.likeCount}`} onPress={onLike} selected={post.likedByMe} />
        <FootAction label={`조회 ${post.viewCount}`} />
        {onDelete ? (
          <View style={styles.footRight}>
            <FootAction
              label={confirming ? '한 번 더' : '삭제'}
              onPress={onDelete}
              tone={confirming ? 'danger' : 'faint'}
              accessibilityLabel={confirming ? '삭제 확인' : '삭제'}
            />
          </View>
        ) : null}
      </View>
      {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenBody: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeleton: { height: 240, borderRadius: radius.md },
  // 헤더 우측 슬롯 — 웹은 hitSlop 을 무시하므로 여백으로 44px 상자를 만든다.
  edit: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },

  article: { gap: spacing.lg },
  // 기울인 표지가 왼쪽·위로 삐져나오는 만큼 숨을 둔다.
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg, paddingLeft: spacing.xs, paddingTop: spacing.xs },
  heroText: { flex: 1, gap: spacing.xs },
  title: { ...typeScale.displaySerif, fontSize: 24, lineHeight: 30 },
  // 모노 한 줄 — 10px 활자라 글자 상자만으로는 손가락이 닿지 않는다. 여백으로 36px 까지 넓히고
  // 같은 만큼 음수 마진으로 되돌려 히어로의 리듬은 그대로 둔다(푸터 액션과 같은 규율).
  bookLink: { alignSelf: 'flex-start', paddingVertical: spacing.md, marginVertical: -spacing.sm },
  bookLinkText: { fontSize: 10, letterSpacing: 0.6 },

  byline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bylineText: { flex: 1 },
  nickname: { fontSize: 12 },
  meta: { fontSize: 9, letterSpacing: 0.4, marginTop: 2 },

  // 기울인 인화지 모서리가 잘리지 않게 사방으로 숨을 둔다.
  photos: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  photo: { width: PHOTO, height: PHOTO, borderRadius: radius.sm, borderWidth: hairline },

  quotes: { gap: spacing.md },

  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footRight: { marginLeft: 'auto' },
});
