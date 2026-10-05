import { PaperScreen } from '@/components/collage';
import { PostcardList } from '@/components/messenger/PostcardList';

/**
 * 엽서 구역(키 messenger, 하단 탭 우표 아이콘) — 받은 엽서와 보낸 엽서를 한 목록으로 모은다.
 * 예전엔 받은 엽서 · 보낸 엽서 · 채팅 세 칸을 오갔는데, 2026-10-05 사용자 결정으로 두 엽서함을 합쳐
 * 카드마다 봉투·종이비행기로 가르고, 채팅은 다섯 구역 헤더 왼쪽 말풍선(BrandHeader → /chats)으로 옮겼다.
 * 옛 경로 `/postcards` 와 엽서 알림은 openSection 으로 이 구역을 연다.
 */
export default function MessengerScreen() {
  return (
    <PaperScreen>
      <PostcardList />
    </PaperScreen>
  );
}
