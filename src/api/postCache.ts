import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Page, Post } from '@/api/types';

/**
 * 독후감 캐시 — 같은 글이 다섯 곳에 산다.
 *
 * 광장 독후감 무한 피드 · 홈 스포트라이트 · 책별 목록 · 내 독후감(무한 목록과 최신 한 건) · 상세.
 * 좋아요·댓글 수가 바뀌면 다섯 곳을 한 번에 손봐야 화면끼리 어긋나지 않는다.
 * 키와 패치를 여기 한 곳에 둔다(밑줄의 quoteCache 와 같은 꼴).
 */
export const postFeedKey = ['posts', 'feed'] as const;
/** 홈 '오늘의 글' 스포트라이트의 독후감 몫(HomeScraps) — 피드와 갈라 둔 키(Page 하나). */
export const POST_HOME_KEY = ['posts', 'home'] as const;
/** 책별 독후감(도서 상세 독후감 탭). */
export const bookPostsKey = (bookId: number) => ['posts', 'book', bookId] as const;
/** 내 독후감 무한 목록. MY_POSTS_LATEST_KEY 가 이 키를 접두사로 쓴다. */
export const myPostsKey = ['posts', 'mine'] as const;
/** 내 최신 독후감 한 건(프로필) — Page 하나. */
export const MY_POSTS_LATEST_KEY = ['posts', 'mine', 'latest'] as const;
export const postKey = (postId: number) => ['post', postId] as const;

export type PostListCache = InfiniteData<Page<Post>>;

/**
 * 무한 목록의 페이지들을 한 배열로 편다(광장 피드·내 독후감이 같이 쓴다).
 * 페이지 사이에 새 글이 끼면 같은 글이 두 페이지에 걸쳐 오므로 id 로 한 번 거른다 — 키 충돌 방지.
 */
export function flattenPosts(pages: Page<Post>[] | undefined): Post[] {
  const seen = new Set<number>();
  const list: Post[] = [];
  for (const post of pages?.flatMap((p) => p.content ?? []) ?? []) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    list.push(post);
  }
  return list;
}

/** 다섯 캐시가 공통으로 가진 반응 필드 — 패치는 이것만 건드린다. */
export type PostReaction = { likedByMe?: boolean; likeCount?: number; commentCount?: number };
export type PostPatch =
  | Partial<PostReaction>
  | ((current: PostReaction) => Partial<PostReaction>);

/** 항목 스스로의 현재 상태를 뒤집는다 — 캐시마다 값이 달라도 각자 일관되게 움직인다. */
export function toggleLikePatch(current: PostReaction): Partial<PostReaction> {
  const liked = !(current.likedByMe ?? false);
  return {
    likedByMe: liked,
    likeCount: Math.max(0, (current.likeCount ?? 0) + (liked ? 1 : -1)),
  };
}

/** 댓글 수를 delta 만큼 옮긴다(0 아래로는 안 내려간다). */
export function bumpCommentPatch(delta: number) {
  return (current: PostReaction): Partial<PostReaction> => ({
    commentCount: Math.max(0, (current.commentCount ?? 0) + delta),
  });
}

function resolve(patch: PostPatch, current: PostReaction): Partial<PostReaction> {
  return typeof patch === 'function' ? patch(current) : patch;
}

/** 한 글을 다섯 캐시에서 찾아 같은 패치를 적용한다. 없는 캐시는 건너뛴다. */
export function patchPostEverywhere(queryClient: QueryClient, postId: number, patch: PostPatch) {
  const patchPost = (post: Post): Post =>
    post.id === postId ? { ...post, ...resolve(patch, post) } : post;
  const patchPage = (page: Page<Post>): Page<Post> =>
    ({ ...page, content: (page.content ?? []).map(patchPost) });
  const patchInfinite = (old: PostListCache | undefined): PostListCache | undefined =>
    old ? { ...old, pages: old.pages.map(patchPage) } : old;

  queryClient.setQueryData<PostListCache>(postFeedKey, patchInfinite);
  queryClient.setQueryData<Page<Post>>(POST_HOME_KEY, (old) => (old ? patchPage(old) : old));
  queryClient.setQueriesData<PostListCache>({ queryKey: ['posts', 'book'] }, patchInfinite);
  // 내 독후감은 무한 목록(myPostsKey)과 최신 한 건(MY_POSTS_LATEST_KEY)이 같은 접두사라
  // 한 번에 걸린다 — 'pages' 유무로 InfiniteData / Page 를 가른다.
  queryClient.setQueriesData<PostListCache | Page<Post>>({ queryKey: ['posts', 'mine'] }, (old) =>
    old ? ('pages' in old ? patchInfinite(old) : patchPage(old)) : old,
  );
  queryClient.setQueryData<Post>(postKey(postId), (old) => (old ? patchPost(old) : old));
}

/** 독후감이 생기거나 지워지거나 고쳐졌을 때 — 목록 캐시를 전부 다시 받게 한다. */
export function invalidatePostLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['posts'] });
}
