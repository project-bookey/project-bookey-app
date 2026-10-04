import { router } from 'expo-router';
import { useEffect } from 'react';

import { PaperScreen } from '@/components/collage';
import type { ClubTabKey } from './ClubTabs';

/**
 * 클럽 홈으로 돌려보낸다 — 옛 클럽 경로(읽기로그·모임·노트북)와, 호스트 전용 화면에 멤버가 들어왔을 때 쓴다.
 *
 * `<Redirect>` 는 이 화면을 새 클럽 홈으로 바꿔서, 클럽 홈 위에서 들어오면 클럽 홈이 한 벌 더 쌓였다(뒤로 가면 같은 홈).
 * dismissTo 로 아래에 있는 클럽 홈까지 걷어 돌아가고, 없으면 이 화면을 클럽 홈으로 바꾼다. 걷히는 동안은 빈 종이만 그린다.
 * tab 을 주면 그 탭을 연다(클럽 홈은 ?tab= 이 바뀌면 그 탭으로 옮긴다).
 */
export function ReturnToClubHome({ clubId, tab }: { clubId: string | number; tab?: ClubTabKey }) {
  useEffect(() => {
    const id = String(clubId);
    router.dismissTo({ pathname: '/club/[id]', params: tab ? { id, tab } : { id } });
  }, [clubId, tab]);
  return <PaperScreen>{null}</PaperScreen>;
}
