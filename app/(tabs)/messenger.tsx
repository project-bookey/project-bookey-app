import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PaperScreen } from '@/components/collage';
import { ChatList } from '@/components/messenger/ChatList';
import { PostcardList } from '@/components/messenger/PostcardList';
import { CapsuleTabs } from '@/components/CapsuleTabs';
import { layout, spacing } from '@/theme';
import { TourTarget } from '@/components/tour/TourTarget';
import { SwipeableTabs } from '@/components/SwipeableTabs';

/** 메신저의 칸 — 엽서함 두 상자와 채팅을 한 줄로 편다(엽서 → 답장 → 채팅 순서 그대로). */
type Pane = 'inbox' | 'sent' | 'chats';
const PANES: { value: Pane; label: string }[] = [
  { value: 'inbox', label: '받은 엽서' },
  { value: 'sent', label: '보낸 엽서' },
  { value: 'chats', label: '채팅' },
];
const PANE_VALUES: readonly Pane[] = ['inbox', 'sent', 'chats'];
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

  // 알림(openSection)·옛 경로로 칸이 지정돼 들어오면 그 칸을 편다. 편 뒤에는 주소에서 지운다 —
  // 직접 다른 칸으로 옮긴 뒤 같은 칸을 가리키는 알림이 또 와도 값이 바뀌어 다시 펴지게.
  useEffect(() => {
    if (!isPane(params.pane)) return;
    setPane(params.pane);
    router.setParams({ pane: undefined });
  }, [params.pane]);

  return (
    <PaperScreen>
      <View style={styles.panes}>
        <TourTarget id="messenger-panes">
          <CapsuleTabs items={PANES} value={pane} onChange={setPane} />
        </TourTarget>
      </View>
      <SwipeableTabs values={PANE_VALUES} value={pane} onChange={setPane}>
        {pane === 'chats' ? <ChatList /> : <PostcardList box={pane === 'inbox' ? 'INBOX' : 'SENT'} />}
      </SwipeableTabs>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  panes: {
    ...layout.content,
    padding: spacing.lg,
  },
});
