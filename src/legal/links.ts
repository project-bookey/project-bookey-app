import { Linking } from 'react-native';

/** 웹 정책 페이지 — 원문은 서버 API 에서 불러 그린다(앱 가입 화면과 같은 글). */
export const LEGAL_URL = 'https://api.bookey.site/legal/index.html';

/** 페이지 안의 섹션 앵커. 설정·구매 화면의 정책 링크가 같은 방식으로 연다(Jakob — 같은 동작은 같은 방식). */
export type LegalSection = 'privacy' | 'terms' | 'refund' | 'deletion';

export function openLegal(section: LegalSection) {
  void Linking.openURL(`${LEGAL_URL}#${section}`);
}
