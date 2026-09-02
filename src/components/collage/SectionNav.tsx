import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/home/NotificationBell';
import { useTheme } from '@/theme';
import { hairline, spacing, typeScale } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'me';

/** 4구역 — 라벨과 경로는 한 곳에서만 정의한다. */
const SECTIONS: { key: SectionKey; label: string; path: string }[] = [
  { key: 'shelf', label: '서가', path: '/home' },
  { key: 'explore', label: '탐색', path: '/search' },
  { key: 'plaza', label: '광장', path: '/plaza' },
  { key: 'me', label: '나', path: '/profile' },
];

/** 로고 마크(북마크 B) — 다크는 흰 B, 라이트는 남색 B. */
const LOGO = {
  dark: require('../../../assets/logo-dark.png'),
  light: require('../../../assets/logo.png'),
} as const;

/**
 * 상단 텍스트 라벨 네비 — 왼쪽 로고 마크, 이어서 활자 구역 라벨, 오른쪽 종.
 * 네이티브 헤더가 없는 화면 최상단에 놓이므로 세이프에어리어를 직접 처리한다.
 */
export function SectionNav({ active }: { active: SectionKey }) {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      // 배경을 깔지 않는다 — PaperScreen 의 도트 그리드가 네비 아래로 이어져야 한다.
      style={[styles.bar, { paddingTop: insets.top, borderBottomColor: colors.line }]}
    >
      <View style={styles.row}>
        <View style={styles.lead}>
          {/* 마크를 누르면 서가로 — 이미 서가면 아무 일도 하지 않는다. */}
          <Pressable
            onPress={() => {
              if (active !== 'shelf') router.replace('/home');
            }}
            accessibilityRole="button"
            accessibilityLabel="bookey 서가"
            hitSlop={6}
            style={styles.markWrap}
          >
            <Image source={LOGO[mode]} style={styles.mark} resizeMode="contain" />
          </Pressable>
          <View style={styles.tabs} accessibilityRole="tablist">
          {SECTIONS.map((section) => {
            const selected = section.key === active;
            return (
              <Pressable
                key={section.key}
                // 현재 구역을 다시 누르면 아무 일도 하지 않는다(스택 중복 방지).
                onPress={() => {
                  if (!selected) router.replace(section.path);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={6}
              >
                <Text
                  style={[
                    selected
                      ? [typeScale.titleSerif, styles.activeLabel, { color: colors.text }]
                      : [typeScale.label, styles.label, { color: colors.textMuted }],
                  ]}
                >
                  {section.label}
                </Text>
                <View
                  style={[
                    styles.underline,
                    { backgroundColor: selected ? colors.accent : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
          </View>
        </View>
        {/* 종도 마크와 같은 높이·같은 바닥선에 — 헤더 양끝이 한 줄로 읽힌다. */}
        <View style={styles.bellWrap}>
          <NotificationBell />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: hairline },
  // 위 18 · 아래 12 — 8/8 이던 때 답답하다는 피드백으로 키웠다(라벨 줄 포함 약 60px).
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: spacing.md,
  },
  lead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  // 마크 22px 를 라벨 글자 상자(24, 밑줄 위 6px) 중심보다 3px 아래에 — 정중앙(7)은 떠 보인다는 피드백.
  markWrap: { marginBottom: 4 },
  mark: { width: 22, height: 22 },
  bellWrap: { marginBottom: 4 },
  tabs: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  // 활성 라벨은 titleSerif 를 19로 줄여 쓴다 — 네비에서 표제만큼 커지면 무겁다.
  activeLabel: { fontSize: 19, lineHeight: 24, paddingBottom: 4 },
  label: { lineHeight: 24, paddingBottom: 4 },
  underline: { height: 2 },
});
