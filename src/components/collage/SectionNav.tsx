import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { hairline, layout, radius, spacing, typeScale } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'clubs' | 'me' | 'social' | 'settings';

/**
 * 하단 구역 네비. 탐색은 서가의 검색 진입점이라 탭으로 두지 않는다.
 * 경로는 한 곳에서만 정의한다.
 */
const SECTIONS: { key: SectionKey; label: string; path: string }[] = [
  { key: 'plaza', label: '광장', path: '/plaza' },
  { key: 'shelf', label: '서가', path: '/home' },
  { key: 'clubs', label: '모임', path: '/clubs' },
  { key: 'me', label: '나', path: '/profile' },
  { key: 'social', label: '소셜', path: '/social' },
  { key: 'settings', label: '설정', path: '/settings' },
];

let lastTabIndex = 0;

/**
 * 네이티브 헤더가 없는 메인 화면의 하단 탭.
 * 각 화면이 PaperScreen 안에서 직접 렌더링하므로 세이프에어리어를 직접 처리한다.
 */
export function SectionNav({ active }: { active: SectionKey }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = useMemo(() => {
    const index = SECTIONS.findIndex((section) => section.key === active);
    return index < 0 ? SECTIONS.findIndex((section) => section.key === 'shelf') : index;
  }, [active]);
  const translateX = useRef(new Animated.Value(lastTabIndex)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeIndex,
      useNativeDriver: true,
      stiffness: 260,
      damping: 28,
      mass: 0.8,
    }).start();
    lastTabIndex = activeIndex;
  }, [activeIndex, translateX]);

  const tabWidth = trackWidth / SECTIONS.length;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      <View
        style={[
          styles.track,
          {
            borderColor: colors.lineStrong,
            backgroundColor: colors.surfaceRaised,
            shadowColor: colors.text,
          },
        ]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="tablist"
      >
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: tabWidth,
                backgroundColor: colors.accentSoft,
                transform: [{ translateX: Animated.multiply(translateX, tabWidth) }],
              },
            ]}
          />
        ) : null}
        {SECTIONS.map((section) => {
          const selected = section.key === active || (active === 'explore' && section.key === 'shelf');
          return (
            <Pressable
              key={section.key}
              onPress={() => {
                if (!selected) router.replace(section.path);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              hitSlop={6}
              style={styles.tab}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  typeScale.label,
                  styles.label,
                  { color: selected ? colors.accent : colors.textMuted },
                ]}
              >
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
      bottom: 0,
      zIndex: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  track: {
    ...layout.content,
    minHeight: 64,
    borderRadius: radius.pill,
    borderWidth: hairline,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  label: { lineHeight: 18, textAlign: 'center' },
});
