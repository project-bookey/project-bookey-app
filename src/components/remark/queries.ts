import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookApi, libraryApi } from '@/api/endpoints';
import type { Remark } from '@/api/types';

/** 한 마디 길이 상한 — 서버(BookRemark.MAX_LENGTH)와 같다. 도서 상세에서 두세 줄 안에 읽히는 한 문장. */
export const REMARK_MAX = 60;

/** 도서 상세에서 돌리는 한 마디 — ['book', bookId] 아래라 도서 상세를 무효화하면 함께 새로 받는다. */
export const bookRemarksKey = (bookId: number) => ['book', bookId, 'remarks'] as const;
/** 이 읽기 기록에 남긴 내 한 마디 — ['library'] 아래라 서재가 바뀌면 함께 새로 받는다. */
export const myRemarkKey = (rid: number | null) => ['library', 'record', rid, 'remark'] as const;
/** 광장 피드 — 홈 '오늘의 글'의 완독 자랑 조각이 그 회차의 완독 한 마디를 보여 준다. */
const PLAZA_KEY = ['plaza'] as const;

export function useBookRemarks(bookId: number) {
  return useQuery({
    queryKey: bookRemarksKey(bookId),
    queryFn: () => bookApi.remarks(bookId),
    enabled: Number.isFinite(bookId),
  });
}

export function useMyRemark(rid: number | null) {
  return useQuery({
    queryKey: myRemarkKey(rid),
    queryFn: () => libraryApi.remark(rid!),
    enabled: rid != null,
  });
}

/** 남기기·고치기 — 받은 한 마디를 내 것 캐시에 바로 앉히고, 도서 상세의 돌아가는 목록과 홈 완독 자랑을 새로 받는다. */
export function useSaveRemark(rid: number | null, bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => libraryApi.saveRemark(rid!, body),
    onSuccess: (saved: Remark) => {
      queryClient.setQueryData(myRemarkKey(rid), saved);
      queryClient.invalidateQueries({ queryKey: bookRemarksKey(bookId) });
      queryClient.invalidateQueries({ queryKey: PLAZA_KEY });
    },
  });
}

export function useDeleteRemark(rid: number | null, bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => libraryApi.deleteRemark(rid!),
    onSuccess: () => {
      queryClient.setQueryData(myRemarkKey(rid), null);
      queryClient.invalidateQueries({ queryKey: bookRemarksKey(bookId) });
      queryClient.invalidateQueries({ queryKey: PLAZA_KEY });
    },
  });
}
