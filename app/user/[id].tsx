import { Redirect, useLocalSearchParams } from 'expo-router';

import { PaperScreen, SubHeader } from '@/components/collage';
import { MyPage } from '@/components/profile/MyPage';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/store/auth';

/**
 * 다른 사람의 마이페이지 (§14.3) — 작성자 이름·팔로우 목록에서 들어온다. '나' 탭과 같은 판(MyPage)을 쓰고,
 * 팔로우·채팅·엽서는 여기서 한다. 방문하면 방문 기록이 남는다. 내 id 로 들어오면 '나' 탭으로 돌린다.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const myId = useAuth((s) => s.user?.id);

  if (myId != null && userId === myId) {
    return <Redirect href="/profile" />;
  }

  return (
    <PaperScreen>
      <SubHeader category="마이페이지" />
      {Number.isInteger(userId) ? (
        <MyPage userId={userId} mine={false} />
      ) : (
        <EmptyState title="독자를 찾을 수 없습니다" description="잘못된 주소입니다." />
      )}
    </PaperScreen>
  );
}
