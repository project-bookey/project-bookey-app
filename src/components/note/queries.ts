import { useQuery } from '@tanstack/react-query';

import { clubNoteApi } from '@/api/endpoints';

/** 노트북 쿼리 키 — 모임 키 아래에 둔다(clubLogKeys 와 같은 관례). 페이지 저장 뒤엔 list 만 무효화한다. */
export const clubNoteKeys = {
  all: (clubId: number) => ['club', clubId, 'notebook'] as const,
  list: (clubId: number) => ['club', clubId, 'notebook', 'list'] as const,
  page: (clubId: number, pageId: number) => ['club', clubId, 'notebook', 'page', pageId] as const,
};

export function useNotebook(clubId: number) {
  return useQuery({ queryKey: clubNoteKeys.list(clubId), queryFn: () => clubNoteApi.notebook(clubId) });
}

export function useNotePageQuery(clubId: number, pageId: number | null) {
  return useQuery({
    queryKey: clubNoteKeys.page(clubId, pageId ?? 0),
    queryFn: () => clubNoteApi.page(clubId, pageId as number),
    enabled: pageId !== null,
    // 다른 멤버의 저장을 보려면 다시 열 때 새로 받는다 — 편집 중엔 useNotePage 가 dirty 로 막는다.
    staleTime: 0,
  });
}
