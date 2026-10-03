import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { clubApi, libraryApi } from '@/api/endpoints';
import type { ClubHome, ClubLogDay } from '@/api/types';
import { addDays, todayKst } from './dates';

/** 읽기로그 캐시 키 — 조각을 남기면 이 셋과 클럽 홈을 함께 무효화한다. */
export const clubLogKeys = {
  all: (clubId: number) => ['club', clubId, 'log'] as const,
  day: (clubId: number, date: string) => ['club', clubId, 'log', 'day', date] as const,
  days: (clubId: number, from: string) => ['club', clubId, 'log', 'days', from] as const,
  /** 소식 피드 — all() 아래라 조각을 남기거나 반응하면 함께 다시 받는다. */
  feed: (clubId: number) => ['club', clubId, 'log', 'feed'] as const,
  readingNow: (clubId: number) => ['club', clubId, 'log', 'readingNow'] as const,
  week: (clubId: number, monday: string) => ['club', clubId, 'log', 'week', monday] as const,
  /** 조각 한 장 — 한 마디까지 붙어 오는 상세. all() 아래가 아니라서 따로 무효화한다. */
  scrap: (clubId: number, postId: number) => ['club', clubId, 'post', postId] as const,
};

/** 날짜별 조각 수를 한 번에 물을 수 있는 최대 기간(서버 상한 14일). */
const WINDOW_DAYS = 14;
/** 한 페이지를 채우려고 거슬러 올라가는 최대 구간 수 — 조각이 없는 기간이 길어도 요청이 끝없이 늘지 않게. */
const MAX_WINDOWS_PER_PAGE = 6;
/** 모집 기간(시작일 전)에 남긴 조각까지 보이도록 시작일보다 더 거슬러 올라가는 날수. */
const BEFORE_START_DAYS = 28;

export type ClubLogFeedPage = {
  /** 조각이 있는 날만, 최근 날부터. */
  days: ClubLogDay[];
  /** 다음 페이지가 볼 구간의 끝 날짜 — 없으면 처음까지 다 봤다. */
  nextTo?: string;
};

/**
 * 소식 피드 — 조각이 있는 날을 최근부터 이어 붙인다. 조각만 따로 내려 주는 목록 API 가 없어서
 * 날짜별 조각 수(logDays, 14일씩)로 조각이 있는 날을 찾고, 그날 보드(logs)를 함께 받는다.
 * 한 페이지는 조각이 있는 첫 14일 구간 하나다.
 */
export function useClubLogFeed(clubId: number, startsOn: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: clubLogKeys.feed(clubId),
    enabled: enabled && startsOn != null,
    initialPageParam: todayKst(),
    queryFn: async ({ pageParam }): Promise<ClubLogFeedPage> => {
      const today = todayKst();
      const start = startsOn! < today ? startsOn! : today;
      const floor = addDays(start, -BEFORE_START_DAYS);
      let to = pageParam;
      for (let i = 0; i < MAX_WINDOWS_PER_PAGE && to >= floor; i++) {
        const from = addDays(to, -(WINDOW_DAYS - 1)) > floor ? addDays(to, -(WINDOW_DAYS - 1)) : floor;
        const counts = await clubApi.logDays(clubId, from, to);
        const dates = counts.filter((c) => c.logCount > 0).map((c) => c.date).sort().reverse();
        to = addDays(from, -1);
        if (dates.length > 0) {
          const days = await Promise.all(dates.map((date) => clubApi.logs(clubId, date)));
          return { days, nextTo: to >= floor ? to : undefined };
        }
      }
      return { days: [], nextTo: to >= floor ? to : undefined };
    },
    getNextPageParam: (last) => last.nextTo,
  });
}

/**
 * 이 클럽 책의 내 독서 기록 — '합류'·'한 조각 남기기'가 타이머와 현재 쪽을 알아야 해서 찾는다.
 * 클럽 홈 응답에는 기록 id 가 없으므로 서재에서 같은 책의 열린 기록을 고른다.
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
