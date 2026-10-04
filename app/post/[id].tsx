import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postApi } from '@/api/endpoints';
import { invalidatePostLists, postKey, syncViewCount } from '@/api/postCache';
import type { Post } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardScroll } from '@/components/keyboard';
import { LikeAction } from '@/components/post/LikeAction';
import { PostBody } from '@/components/post/PostBody';
import { PostByline } from '@/components/post/PostByline';
import { PostPhoto, type PhotoSource } from '@/components/post/PostPhoto';
import { photoIdsIn, type PhotoRef } from '@/components/post/postPhotos';
import { postBodyOf } from '@/components/post/postQuotes';
import { useLikePost } from '@/components/post/useLikePost';
import { PostcardComposer } from '@/components/social/PostcardComposer';
import { EmptyState, FootAction, TextLink, linkLabel } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 독후감 상세 — 광장 독후감 카드·책 상세·내 독후감에서 들어온다.
 * 글 한 편(표지·제목·바이라인·사진·본문·액션 행)만 펼친다. 노트 독후감은 사진·본문 자리에 페이지 넘김 뷰어가 선다.
 * 댓글은 없다 — 독후감의 상호작용은 좋아요와 엽서뿐이다(§14.1, v1.2 확정).
 */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressLike = useLikePost();
  const [postcardOpen, setPostcardOpen] = useState(false);

  const post = useQuery({
    queryKey: postKey(postId),
    queryFn: async () => {
      const fresh = await postApi.get(postId);
      syncViewCount(queryClient, fresh);
      return fresh;
    },
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

  // 본인 글에만 '고치기' — 작성 화면을 수정 모드로 연다. 헤더가 아니라 '삭제' 옆(글 푸터)에 둔다:
  // 내 글을 다루는 두 동작이 화면 양 끝으로 갈라져 있었다(UX 철칙 Proximity).
  const openEdit = () => router.push({ pathname: '/post/new', params: { id: String(postId) } });

  const header = post.data ? (
    <PostArticle
      post={post.data}
      confirming={confirming}
      error={removeError}
      onLike={() => pressLike(postId)}
      onDelete={post.data.mine ? pressDeletePost : undefined}
      onEdit={post.data.mine ? openEdit : undefined}
      postcardOpen={postcardOpen}
      onTogglePostcard={post.data.mine ? undefined : () => setPostcardOpen((open) => !open)}
      onClosePostcard={() => setPostcardOpen(false)}
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
          <Pressable
            onPress={() => post.refetch()}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            style={({ pressed }) => [styles.retry, pressed ? pressedStyle : null]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
          </Pressable>
        }
      />
    )
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="독후감" />
      {/* 맨 끝 엽서 쓰기가 키보드에 묻히지 않게 — 칸을 누르면 '엽서 보내기'까지 키보드 위로 올라온다. */}
      <KeyboardScroll contentContainerStyle={styles.screenBody}>
        {placeholder ?? header}
      </KeyboardScroll>
    </PaperScreen>
  );
}

/**
 * 글 한 편 — 표제(책 · 제목) · 바이라인 · 본문 · 액션 행.
 * 카드에 넣지 않고 종이 위에 반듯하게 펼친다 — 긴 글이라 상자보다 지면이 읽기 편하다. 기울이는 것은 없다.
 * 사진은 따로 모아 두지 않는다 — 글을 쓰다 올린 자리(본문의 사진 줄)에 그대로 선다.
 */
function PostArticle({ post, confirming, error, onLike, onDelete, onEdit, postcardOpen, onTogglePostcard, onClosePostcard }: {
  post: Post;
  /** 삭제 재확인 상태 — 라벨이 '한 번 더'로 바뀐다. */
  confirming: boolean;
  /** 삭제 실패 안내. */
  error: string | null;
  onLike: () => void;
  /** 본인 글에서만 넘긴다. */
  onDelete?: () => void;
  /** 본인 글에서만 넘긴다 — 삭제 옆에 고치기를 둔다. */
  onEdit?: () => void;
  postcardOpen: boolean;
  /** 남의 글에서만 넘긴다. */
  onTogglePostcard?: () => void;
  onClosePostcard: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  // 옛 글이 밑줄로 엮어 둔 문장(표시 자리·글 끝)도 본문의 문장 조각으로 그린다 — 밑줄 상세로 가는 길은 없다.
  const body = useMemo(() => postBodyOf(post).text, [post]);
  // 본문의 사진 줄이 가리키는 사진과, 본문에 자리가 없는 사진(사진을 따로 붙이던 옛 글).
  const { photoOf, loose } = useMemo(() => {
    const byId = new Map(post.images.map((image) => [image.id, image] as const));
    const placed = new Set(photoIdsIn(body));
    return {
      photoOf: (ref: PhotoRef): PhotoSource | null => {
        const image = ref.kind === 'image' ? byId.get(ref.id) : undefined;
        return image ? { uri: image.url, width: image.width, height: image.height } : null;
      },
      loose: post.images.filter((image) => !placed.has(image.id)),
    };
  }, [post.images, body]);

  return (
    <View style={styles.article}>
      {/* ① 표제 — 책으로 가는 길을 제목 위에 한 줄로, 그 아래 제목 */}
      <View style={styles.heading}>
        {post.bookId != null ? (
          <Pressable
            onPress={() => router.push(`/book/${post.bookId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${post.bookTitle ?? '책'} 상세`}
            style={({ pressed }) => [styles.inlineLink, pressed ? pressedStyle : null]}
          >
            <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.accent }]}>
              {linkLabel(post.bookTitle ?? '책')}
            </Text>
          </Pressable>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
      </View>

      {/* ② 바이라인 — 작성자 · 올린 때 · 조회. 공개 범위도 메타에 붙인다:
          클럽만 글은 누가 보든 밝히고(보는 사람도 그 클럽 멤버다), 비공개·링크는 본인에게만. 내 이름은 누르지 않는다. */}
      <PostByline
        post={post}
        showViews
        showVisibility={post.mine || post.visibility === 'CLUB'}
        onPress={post.mine ? undefined : () => router.push(`/user/${post.authorId}`)}
      />

      {/* 클럽 독후감이면 어느 클럽의 글인지 — 앱 공용 글자 링크로, 누르면 그 클럽 홈으로 */}
      {post.clubId != null && post.clubName ? (
        <TextLink
          label={`클럽 · ${post.clubName}`}
          onPress={() => router.push({ pathname: '/club/[id]', params: { id: String(post.clubId) } })}
          accessibilityLabel={`${post.clubName} 클럽으로 가기`}
          numberOfLines={1}
          hitSlop={null}
          style={styles.inlineLink}
        />
      ) : null}

      {/* ③ 본문 앞 사진 — 본문에 자리가 없는 사진만(사진을 따로 붙이던 옛 글). 예전처럼 본문 앞에 둔다 */}
      {loose.length > 0 ? (
        <View style={styles.loose}>
          {loose.map((image, i) => (
            <PostPhoto
              key={image.id}
              source={{ uri: image.url, width: image.width, height: image.height }}
              label={`사진 ${i + 1}/${loose.length}`}
            />
          ))}
        </View>
      ) : null}

      {/* ④ 본문 — 글 사이에 사진과 옮겨 적은 문장 조각이 쓴 자리 그대로 끼어든다 */}
      <PostBody md={body} photoOf={photoOf} />

      {/* ⑤ 액션 행 — 왼쪽 좋아요(카드 발치와 같은 하트), 오른쪽 이 글로 할 일. 조회는 바이라인에 있다. 댓글은 없다(§14.1) */}
      <View style={styles.footRow}>
        <LikeAction count={post.likeCount} liked={post.likedByMe} onPress={onLike} />
        {/* 엽서 칸이 열리면 그 안의 '엽서 보내기'가 주요 버튼이다 — 같은 라벨이 둘 보이지 않게 여기는 '닫기'로. */}
        {onTogglePostcard ? (
          <View style={styles.footRight}>
            <FootAction
              label={postcardOpen ? '엽서 닫기' : '엽서 보내기'}
              onPress={onTogglePostcard}
              tone={postcardOpen ? 'muted' : 'accent'}
              accessibilityLabel={postcardOpen ? '엽서 쓰기 닫기' : `${post.authorNickname}에게 엽서 보내기`}
            />
          </View>
        ) : null}
        {onDelete || onEdit ? (
          <View style={styles.footRight}>
            {onEdit ? (
              <FootAction label="고치기" onPress={onEdit} accessibilityLabel="독후감 고치기" />
            ) : null}
            {/* 삭제는 앱 어디서나 같은 말·같은 모양 — '삭제' → '한 번 더'(엽서·채팅·알림과 같은 FootAction). */}
            {onDelete ? (
              <FootAction
                label={confirming ? '한 번 더' : '삭제'}
                onPress={onDelete}
                tone={confirming ? 'danger' : 'faint'}
                accessibilityLabel={confirming ? '독후감 삭제 확인' : '독후감 삭제'}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
      {postcardOpen ? (
        <PostcardComposer
          toUserId={post.authorId}
          toNickname={post.authorNickname}
          postId={post.id}
          postTitle={post.title}
          onDone={onClosePostcard}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 본문 폭은 작성 화면·목록과 같다 — 태블릿·웹에서 글이 화면 끝까지 퍼지지 않게.
  screenBody: { ...layout.content, padding: spacing.lg, paddingBottom: spacing.xxl },
  skeleton: { height: 240, borderRadius: radius.md },

  article: { gap: spacing.lg },
  // 책 링크와 제목은 한 묶음 — 그 사이는 묶음 안 간격.
  heading: { gap: spacing.xs },
  title: { ...typeScale.displaySerif, fontSize: 26, lineHeight: 34 },
  // 모노 한 줄 링크(책·클럽) — 11px 활자라 글자 상자만으로는 손가락이 닿지 않는다. 44pt 상자로 키우고
  // 같은 만큼 음수 마진으로 되돌려 둘레의 리듬은 그대로 둔다.
  inlineLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginVertical: -spacing.md },
  // 본문 앞 사진끼리는 본문 블록 사이와 같은 간격.
  loose: { gap: spacing.md },

  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  // 고치기·삭제 — 둘 다 내 글을 다루는 동작이라 한자리에. 테두리 버튼(FootAction)은 옆으로 넓어지지 않아 sm 간격이면 떨어진다.
  footRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // 오류 상태의 다시 시도 — 웹은 hitSlop 을 무시하므로 여백으로 44pt 상자를 만든다.
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
