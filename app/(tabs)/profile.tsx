import { PaperScreen } from '@/components/collage';
import { MyPage } from '@/components/profile/MyPage';
import { useAuth } from '@/store/auth';

/**
 * 구역 4. 나 — 내 마이페이지. 판은 다른 사람의 페이지(/user/[id])와 같은 MyPage 를 쓰고,
 * 지갑·출석·설정·팔로우 목록처럼 나에게만 있는 칸은 MyPage 가 mine 으로 가른다.
 */
export default function ProfileScreen() {
  const myId = useAuth((s) => s.user?.id);
  return (
    <PaperScreen>
      <MyPage userId={myId} mine />
    </PaperScreen>
  );
}
