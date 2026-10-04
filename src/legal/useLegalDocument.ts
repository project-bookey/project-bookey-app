import { useQuery } from '@tanstack/react-query';

import { legalApi } from '@/api/endpoints';
import type { LegalDocumentKey } from '@/api/types';

/**
 * 약관·정책 원문. 가입 동의는 여기서 받은 version 을 그대로 서버에 돌려준다 — 서버가 지금 버전과 비교한다.
 * 문구는 배포 때만 바뀌므로 한 번 받으면 오래 쓴다.
 */
export function useLegalDocument(key: LegalDocumentKey | null) {
  return useQuery({
    queryKey: ['legal', key],
    queryFn: () => legalApi.get(key as LegalDocumentKey),
    enabled: key != null,
    staleTime: 30 * 60_000,
  });
}
