import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandHeader, PaperScreen } from '@/components/collage';
import { ChatList } from '@/components/messenger/ChatList';
import { PostcardList } from '@/components/messenger/PostcardList';
import { Segmented } from '@/components/ui';
import { layout, spacing } from '@/theme';

/** 메신저의 칸 — 엽서함 두 상자와 채팅을 한 줄로 편다(엽서 → 답장 → 맞팔로우 → 채팅 순서 그대로). */
type Pane = 'inbox' | 'sent' | 'chats';
const PANES: { value: Pane; label: string }[] = [
  { value: 'inbox', label: '받은 엽서' },
  { value: 'sent', label: '보낸 엽서' },
  { value: 'chats', label: '채팅' },
];
const isPane = (v: unknown): v is Pane => v === 'inbox' || v === 'sent' || v === 'chats';

/**
 * 메신저 구역 — 엽서함(받은·보낸)과 채팅을 하단 탭 하나로 묶는다.
 * 전엔 헤더 왼쪽의 엽서함·채팅 아이콘 둘로 각각 들어갔는데, 사람 사이 오가는 글은 한 자리에
 * 있어야 한다는 요청(2026-09-08)으로 구역이 됐다. 옛 경로 `/postcards`·`/chats` 는 여기로
 * 리다이렉트된다(`?pane=` 로 칸을 지정).
 */
export default function MessengerScreen() {
  const params = useLocalSearchParams<{ pane?: string }>();
  const [pane, setPane] = useState<Pane>(isPane(params.pane) ? params.pane : 'inbox');

  // 이미 이 구역에 서 있을 때 리다이렉트로 다른 칸이 지정돼 들어오면 그 칸을 편다.
  useEffect(() => {
    if (isPane(params.pane)) setPane(params.pane);
  }, [params.pane]);

  return (
    <PaperScreen withTopInset>
      <BrandHeader />
      <View style={styles.panes}>
        <Segmented options={PANES} value={pane} onChange={setPane} />
      </View>
      {pane === 'chats' ? <ChatList /> : <PostcardList box={pane === 'inbox' ? 'INBOX' : 'SENT'} />}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  panes: { ...layout.content, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
});
