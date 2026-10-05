import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { chatApi } from '@/api/endpoints';
import { BrandWordmark } from '@/components/BrandWordmark';
import { ICON_SIZE, IconButton } from '@/components/collage/IconButton';
import { NotificationBell } from '@/components/home/NotificationBell';
import { useTourTarget } from '@/components/tour/TourTarget';
import { HeaderWallet } from '@/components/wallet/HeaderWallet';
import { iconStroke, spacing, useTheme } from '@/theme';

/**
 * 구역 화면 공통 헤더 — 왼쪽에 채팅 말풍선, 가운데 워드마크, 오른쪽에 지갑·알림 종.
 * 지갑은 아이콘 하나로 두고 누르면 그 자리에서 카드가 커지며 책갈피·엽서·우표를 보여 준다(HeaderWallet, 2026-10-05 사용자 결정).
 * 채팅은 하단 구역이 아니라 이 말풍선으로 어느 구역에서든 연다(2026-10-05, 사용자 결정 — 엽서 구역은 엽서만).
 * 워드마크는 절대 위치로 가운데에 서므로 양옆 폭이 달라도 자리가 흔들리지 않는다.
 * 광장 독후감 쓰기는 헤더가 아니라 하단 바 옆 단추다(SectionNav 의 dock).
 */
export function BrandHeader() {
  return (
    <View style={styles.wrap}>
      <ChatButton />
      <View pointerEvents="none" style={styles.wordmarkOverlay}>
        <BrandWordmark width={104} />
      </View>
      <View style={[styles.side, styles.right]}>
        <HeaderWallet />
        <NotificationBell />
      </View>
    </View>
  );
}

/**
 * 채팅 말풍선 — 안 읽은 메시지가 있으면 초록 점(개수는 접근성 라벨에만, 2026-10-05 시안 B), 누르면 채팅 목록(/chats).
 * 말풍선은 옆의 종·지갑처럼 각진 획으로 직접 그린다. 목록 화면과 같은 쿼리(['chats'])라 캐시를 함께 쓰고,
 * 채팅방을 읽으면 그쪽 무효화로 점이 사라진다.
 */
function ChatButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: ['chats'], queryFn: () => chatApi.list(), refetchInterval: 15_000 });
  const unread = data?.content.reduce((sum, chat) => sum + chat.unreadCount, 0) ?? 0;
  const tourRef = useTourTarget('header-chat');

  return (
    <View ref={tourRef} collapsable={false} style={styles.chat}>
      <IconButton
        dot={unread > 0}
        onPress={() => router.push('/chats')}
        accessibilityLabel={unread > 0 ? `채팅, 안 읽은 메시지 ${unread}개` : '채팅'}
      >
        <ChatGlyph color={colors.text} />
      </IconButton>
    </View>
  );
}

/** 각진 말풍선 — 꼬리는 왼쪽 아래. */
function ChatGlyph({ color }: { color: string }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M4 4.5h16v11.5H10.5L6 20v-4H4z" stroke={color} {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  // 말풍선은 터치 상자(44) 안에서 가운데라, 상자를 왼쪽으로 내밀어 아이콘을 화면 여백 선에 맞춘다(SubHeader 뒤로와 같다).
  chat: { zIndex: 2, marginLeft: -(44 - ICON_SIZE) / 2 },
  side: { width: 118, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  right: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
  wordmarkOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
