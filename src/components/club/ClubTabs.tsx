import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

export type ClubTabKey = 'home' | 'chat' | 'meetings' | 'notes' | 'posts' | 'reviews';
export const isClubTabKey = (v: unknown): v is ClubTabKey =>
  v === 'home' || v === 'chat' || v === 'meetings' || v === 'notes' || v === 'posts' || v === 'reviews';
/** ?tab= 값 → 탭. 옛 노트 탭(notebook)은 그 자리를 이은 독후감 탭으로. 모르는 값이면 null. */
export const clubTabOf = (v: unknown): ClubTabKey | null =>
  v === 'notebook' ? 'reviews' : isClubTabKey(v) ? v : null;

const TABS: { key: ClubTabKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'chat', label: '채팅' },
  { key: 'meetings', label: '모임' },
  { key: 'notes', label: '노트' },
  { key: 'posts', label: '토론' },
  { key: 'reviews', label: '독후감' },
];

/**
 * 클럽 탭 — 홈 · 채팅 · 모임 · 노트 · 토론 · 독후감. 클럽 홈에서는 onSelect 로 아래 영역만 바꾸고(화면 이동 없음),
 * 단독 화면에서 쓰면 라우팅으로 옮긴다.
 * 활성 탭은 잉크 글자 + 2px 민트 표식(구역 네비와 같은 규칙). 홈으로는 navigate(스택에 있으면 되돌아감),
 * 하위 화면끼리는 replace 로 옮겨 뒤로 가기가 항상 클럽 홈으로 떨어지게 한다.
 */
export function ClubTabs({ clubId, active, onSelect }: {
  clubId: number;
  active: ClubTabKey;
  /** 주면 화면 이동 대신 이 콜백으로 탭을 바꾼다(클럽 홈의 in-place 탭). */
  onSelect?: (key: ClubTabKey) => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  // 모임 화면은 host 파라미터를 읽으므로 클럽 홈 캐시에서 내 역할을 꺼낸다(홈을 거쳐 왔으면 이미 있다).
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId), staleTime: 60_000 });
  const isHost = club.data?.myRole === 'HOST';
  const id = String(clubId);

  const hrefOf = (key: ClubTabKey): Href => {
    switch (key) {
      case 'home': return `/club/${clubId}`;
      case 'chat': return `/club/${clubId}/chat`;
      case 'meetings': return { pathname: '/club/[id]/meetings', params: { id, host: isHost ? '1' : '0' } };
      case 'posts': return `/club/${clubId}/posts`;
      case 'notes': return { pathname: '/club/[id]', params: { id, tab: 'notes' } };
      case 'reviews': return { pathname: '/club/[id]', params: { id, tab: 'reviews' } };
    }
  };
  const go = (key: ClubTabKey) => {
    if (key === active) return;
    if (onSelect) {
      onSelect(key);
      return;
    }
    // 노트·독후감 탭은 클럽 홈 안의 탭이라 홈과 같이 navigate 로 되돌아간다.
    if (key === 'home' || key === 'notes' || key === 'reviews') router.navigate(hrefOf(key));
    else if (active === 'home') router.push(hrefOf(key));
    else router.replace(hrefOf(key));
  };

  return (
    <View style={[styles.bar, { borderTopColor: colors.line, borderBottomColor: colors.line }]} accessibilityRole="tablist">
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
            <Text style={[styles.label, { color: on ? colors.ink : colors.textMuted }]}>{t.label}</Text>
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
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm },
  // 활자·괘선 판면 — 탭 글자도 모노로(한글 자간은 1 이하).
  label: { ...typeScale.monoLabel, fontSize: 12, letterSpacing: 1 },
  marker: { alignSelf: 'stretch', height: 2 },
});
