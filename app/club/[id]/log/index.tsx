import { Redirect, useLocalSearchParams } from 'expo-router';

/** 읽기로그 보드는 모임 홈으로 합쳐졌다 — 예전 링크·딥링크는 홈으로 보낸다. */
export default function ClubLogBoardRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/club/${id}`} />;
}
