import { PaperScreen } from '@/components/collage';
import { PostFeed } from '@/components/post/PostFeed';

/**
 * 구역 3. 광장 — 다른 독자들의 독후감이 모이는 곳 (시안 2d).
 * 클럽은 상단 구역 탭으로 올라가 여기엔 없다.
 *
 * 광장은 독후감만 보여 준다 — '완독 자랑' 탭은 걷어내고 홈 '오늘의 글'(HomeScraps)에서
 * 독후감과 번갈아 돌린다(사용자 결정 2026-10-05). 피드 위 제목·'+ 독후감' 줄도 걷어냈다 —
 * 독후감 쓰기는 광장이 보이는 동안 하단 바 옆에 서는 연필 단추가 맡는다(SectionNav, B안).
 */
export default function PlazaScreen() {
  return (
    <PaperScreen>
      <PostFeed />
    </PaperScreen>
  );
}
