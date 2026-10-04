import { useLocalSearchParams } from 'expo-router';

import { ReturnToClubHome } from '@/components/club';

/** 옛 클럽 노트 페이지 링크 — 페이지는 더 없으니 클럽 홈으로 보낸다. */
export default function ClubNotePageRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReturnToClubHome clubId={id} />;
}
