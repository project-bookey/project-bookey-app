import { PaperScreen } from '@/components/collage';
import { PostcardList } from '@/components/messenger/PostcardList';

/**
 * 엽서 구역(키 messenger, 하단 탭 편지지 아이콘) — 받은 엽서와 보낸 엽서를 한 목록으로 모은다.
 * 예전엔 받은 엽서 · 보낸 엽서 · 채팅 세 칸을 오갔는데, 2026-10-05 사용자 결정으로 두 엽서함을 합치고,
 * 채팅은 다섯 구역 헤더 왼쪽 말풍선(BrandHeader → /chats)으로 옮겼다. 줄은 메신저형으로, 받은 엽서는 닫힌·열린 봉투,
 * 보낸 엽서는 종이비행기로 그리고, 누르면 엽서 화면(/postcard/[id])에서 열고 답장한다(같은 날 사용자 결정).
 * 옛 경로 `/postcards` 와 엽서 알림은 openSection 으로 이 구역을 연다.
 */
export default function MessengerScreen() {
  return (
    <PaperScreen>
      <PostcardList />
    </PaperScreen>
  );
}
