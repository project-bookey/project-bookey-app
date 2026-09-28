import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

export type ClubTabKey = 'home' | 'chat' | 'meetings' | 'posts' | 'notebook';

const TABS: { key: ClubTabKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'chat', label: '채팅' },
  { key: 'meetings', label: '약속' },
  { key: 'posts', label: '토론' },
  { key: 'notebook', label: '노트' },
];

/**
 * 모임 탭 — 홈 · 채팅 · 약속 · 토론 · 노트. 모임 화면들 헤더 바로 아래에 같은 줄이 놓여 한 모임 안을 오가는 느낌을 준다.
 * 활성 탭은 잉크 글자 + 2px 민트 표식(구역 네비와 같은 규칙). 홈으로는 navigate(스택에 있으면 되돌아감),
 * 하위 화면끼리는 replace 로 옮겨 뒤로 가기가 항상 모임 홈으로 떨어지게 한다.
 */
export function ClubTabs({ clubId, active }: { clubId: number; active: ClubTabKey }) {
  const router = useRouter();
  const { colors } = useTheme();
  // 약속 화면은 host 파라미터를 읽으므로 모임 홈 캐시에서 내 역할을 꺼낸다(홈을 거쳐 왔으면 이미 있다).
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId), staleTime: 60_000 });
  const isHost = club.data?.myRole === 'HOST';
  const id = String(clubId);

  const hrefOf = (key: ClubTabKey): Href => {
    switch (key) {
      case 'home': return `/club/${clubId}`;
      case 'chat': return `/club/${clubId}/chat`;
      case 'meetings': return { pathname: '/club/[id]/meetings', params: { id, host: isHost ? '1' : '0' } };
      case 'posts': return `/club/${clubId}/posts`;
      case 'notebook': return { pathname: '/club/[id]/notebook', params: { id } };
    }
  };
  const go = (key: ClubTabKey) => {
    if (key === active) return;
    if (key === 'home') router.navigate(hrefOf('home'));
    else if (active === 'home') router.push(hrefOf(key));
    else router.replace(hrefOf(key));
  };

  return (
    <View style={[styles.bar, { borderBottomColor: colors.line }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => go(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.tab, pressed && !on ? pressedStyle : null]}
          >
            <Text style={[typeScale.label, { color: on ? colors.ink : colors.textMuted }]}>{t.label}</Text>
            <View style={[styles.marker, { backgroundColor: on ? colors.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...layout.content,
    flexDirection: 'row',
    borderBottomWidth: hairline,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm },
  marker: { alignSelf: 'stretch', height: 2 },
});
