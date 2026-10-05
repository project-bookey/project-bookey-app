import { PaperScreen, SubHeader } from '@/components/collage';
import { ChatList } from '@/components/messenger/ChatList';

/**
 * 채팅 목록 (§14.3) — 다섯 구역 헤더 왼쪽의 말풍선으로 들어오는 전체 화면.
 * 예전엔 메신저 구역의 한 칸이었는데, 엽서 구역은 엽서만 두고 채팅은 어디서든 한 번에 열게 됐다
 * (2026-10-05, 사용자 결정).
 */
export default function ChatsScreen() {
  return (
    <PaperScreen>
      <SubHeader category="채팅" />
      <ChatList />
    </PaperScreen>
  );
}
