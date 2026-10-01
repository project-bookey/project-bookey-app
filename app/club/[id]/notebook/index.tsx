import { Redirect, useLocalSearchParams } from 'expo-router';

/** 클럽 노트북은 걷어냈다 — 예전 링크·알림 딥링크는 클럽 홈의 독후감 탭으로 보낸다. */
export default function ClubNotebookRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'reviews' } }} />;
}
