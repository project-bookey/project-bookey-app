import { Redirect, useLocalSearchParams } from 'expo-router';

/** 노트는 이제 모임 홈의 탭(3열 격자)이다 — 예전 링크·알림 딥링크는 그 탭으로 보낸다. */
export default function ClubNotebookRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'notebook' } }} />;
}
