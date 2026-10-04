import { useLocalSearchParams } from 'expo-router';

import { ReturnToClubHome } from '@/components/club';

/** 읽기로그 보드는 클럽 홈으로 합쳐졌다 — 예전 링크·딥링크는 홈으로 보낸다. */
export default function ClubLogBoardRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReturnToClubHome clubId={id} />;
}
