import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { PaperScreen, SubHeader } from '@/components/collage';
import { openSection } from '@/components/pager/sectionPager';
import { MyPage } from '@/components/profile/MyPage';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/store/auth';

/**
 * 다른 사람의 마이페이지 (§14.3) — 작성자 이름·팔로우 목록에서 들어온다. '나' 탭과 같은 판(MyPage)을 쓰고,
 * 팔로우·채팅·엽서는 여기서 한다. 방문하면 방문 기록이 남는다. 내 id 로 들어오면 '나' 탭을 연다.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const myId = useAuth((s) => s.user?.id);
  const mine = myId != null && userId === myId;

  // 내 id 면 이 화면을 걷고 원래 메인 탭의 '나'로 간다 — <Redirect href="/profile"> 는 이 화면을
  // 새 메인 탭으로 바꿔 메인 탭이 한 벌 더 쌓였다. 걷히는 동안은 빈 종이만 그린다.
  useEffect(() => {
    if (mine) openSection('profile');
  }, [mine]);

  if (mine) return <PaperScreen>{null}</PaperScreen>;

  return (
    <PaperScreen>
      <SubHeader category="프로필" />
      {Number.isInteger(userId) ? (
        <MyPage userId={userId} mine={false} />
      ) : (
        <EmptyState title="사용자를 찾을 수 없어요" description="주소가 잘못됐어요." />
      )}
    </PaperScreen>
  );
}
