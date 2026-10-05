import { useEffect } from 'react';

import { PaperScreen } from '@/components/collage';
import { openSection } from '@/components/pager/sectionPager';

/**
 * 엽서함은 하단 '엽서' 구역(키 messenger)이 됐다 — 옛 경로로 들어오면 그 구역을 연다.
 * Redirect 로 보내면 이 화면이 새 메인 탭으로 바뀌어, 앱이 떠 있을 때 옛 링크로 들어오면 메인 탭이 한 벌 더 쌓였다.
 */
export default function PostcardsRedirect() {
  useEffect(() => {
    openSection('messenger');
  }, []);
  return <PaperScreen>{null}</PaperScreen>;
}
