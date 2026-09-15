import { useQuery } from '@tanstack/react-query';

import { libraryApi } from '@/api/endpoints';
import type { ClubHome } from '@/api/types';

/** 읽기로그 캐시 키 — 조각을 남기면 이 셋과 모임 홈을 함께 무효화한다. */
export const clubLogKeys = {
  all: (clubId: number) => ['club', clubId, 'log'] as const,
  day: (clubId: number, date: string) => ['club', clubId, 'log', 'day', date] as const,
  days: (clubId: number, from: string) => ['club', clubId, 'log', 'days', from] as const,
  readingNow: (clubId: number) => ['club', clubId, 'log', 'readingNow'] as const,
  week: (clubId: number, monday: string) => ['club', clubId, 'log', 'week', monday] as const,
  /** 조각 한 장 — 한 마디까지 붙어 오는 상세. all() 아래가 아니라서 따로 무효화한다. */
  scrap: (clubId: number, postId: number) => ['club', clubId, 'post', postId] as const,
};

/**
 * 이 모임 책의 내 독서 기록 — '합류'·'한 조각 남기기'가 타이머와 현재 쪽을 알아야 해서 찾는다.
 * 모임 홈 응답에는 기록 id 가 없으므로 서재에서 같은 책의 열린 기록을 고른다.
 */
export function useMyClubRecord(club?: ClubHome) {
  const bookId = club?.book?.id;
  const library = useQuery({
    queryKey: ['library', 'all'],
    queryFn: () => libraryApi.list(),
    enabled: bookId != null,
  });
  const records = (library.data?.content ?? []).filter((r) => r.book?.id === bookId);
  return records.find((r) => r.status !== 'FINISHED' && r.status !== 'ABANDONED') ?? records[0];
}
