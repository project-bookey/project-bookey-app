import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/**
 * 상단 텍스트 라벨 네비 — 아이콘 탭바 대신 활자로 구역을 나눈다.
 * 네이티브 헤더가 없는 화면 최상단에 놓이므로 세이프에어리어를 직접 처리한다.
 */
export function SectionNav({ active }: { active: SectionKey }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, borderBottomColor: colors.line, backgroundColor: colors.bg },
      ]}
    >
      <View style={styles.row}>
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
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tabs: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  // 활성 라벨은 titleSerif 를 19로 줄여 쓴다 — 네비에서 표제만큼 커지면 무겁다.
  activeLabel: { fontSize: 19, lineHeight: 24, paddingBottom: 4 },
  label: { lineHeight: 24, paddingBottom: 4 },
  underline: { height: 2 },
});
