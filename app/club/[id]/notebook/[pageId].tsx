import { Redirect, useLocalSearchParams } from 'expo-router';

/** 옛 모임 노트 페이지 링크 — 페이지는 더 없으니 모임 홈의 독후감 탭으로 보낸다. */
export default function ClubNotePageRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'reviews' } }} />;
}
