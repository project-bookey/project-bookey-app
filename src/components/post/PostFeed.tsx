import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { postApi } from '@/api/endpoints';
import { postFeedKey } from '@/api/postCache';
import { PostList } from '@/components/post/PostList';

/** 한 번에 받아오는 독후감 건수 — 광장 피드와 같은 크기. */
const PAGE_SIZE = 10;

/**
 * 독후감 무한 피드 — 광장 '독후감' 탭의 본문.
 *
 * 광장 피드(`/plaza/feed`)와는 다른 API·다른 캐시라 쿼리를 따로 세운다. 탭을 바꿀 때
 * 헤더(칩 행·컴포저)는 그대로여야 하므로 광장이 만든 헤더를 그대로 받아 얹는다.
 * 목록의 뼈대(스켈레톤·빈 상태·무한 스크롤·부분 실패 재시도)는 '내 독후감'과 나눠 쓴다(PostList).
 */
export function PostFeed({ ListHeaderComponent }: { ListHeaderComponent: ReactElement }) {
  const router = useRouter();

  const feed = useInfiniteQuery({
    queryKey: postFeedKey,
    queryFn: ({ pageParam }) => postApi.feed(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  return (
    <PostList
      query={feed}
      ListHeaderComponent={ListHeaderComponent}
      onOpenBook={(bookId) => router.push(`/book/${bookId}`)}
      errorTitle="독후감을 불러오지 못했어요"
      emptyTitle="아직 독후감이 없어요"
      emptyDescription="첫 독후감을 남겨보세요."
    />
  );
}
