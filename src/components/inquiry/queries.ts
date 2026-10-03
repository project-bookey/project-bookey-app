import { useQuery } from '@tanstack/react-query';

import { inquiryApi } from '@/api/endpoints';

/** 내 문의 목록(무한 스크롤) — 문의를 보내거나 지우면 무효화한다. */
export const inquiriesKey = ['inquiries'] as const;
export const inquiryKey = (inquiryId: number) => ['inquiry', inquiryId] as const;
export const faqsKey = ['faqs'] as const;
export const inquiryCategoriesKey = ['inquiry-categories'] as const;

/** 한 번에 받아오는 내 문의 수 — 훑어 내리는 목록이라 넉넉히. */
export const INQUIRY_PAGE_SIZE = 20;
/** 문의 하나에 붙일 수 있는 사진 — 서버 상한(InquiryRules.MAX_IMAGES)과 같은 값. */
export const INQUIRY_IMAGE_MAX = 3;
/** 본문 길이 — 서버 상한과 같은 값(둘 다 UTF-16 길이로 센다). */
export const INQUIRY_BODY_MAX = 2000;

/**
 * 문의 유형 — 서버가 순서와 라벨을 내려준다(앱을 다시 내보내지 않고도 유형을 바꿀 수 있게).
 * 거의 바뀌지 않으므로 한 번 받으면 앱이 켜져 있는 동안 다시 묻지 않는다.
 */
export function useInquiryCategories() {
  return useQuery({
    queryKey: inquiryCategoriesKey,
    queryFn: inquiryApi.categories,
    staleTime: Infinity,
  });
}
