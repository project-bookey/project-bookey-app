import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { hairline, iconStroke, layout, pressedStyle, sans, spacing } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'clubs' | 'messenger' | 'me';

/**
 * 하단 구역 네비. 탐색은 서가의 검색 진입점이라 탭으로 두지 않는다.
 * 경로는 한 곳에서만 정의한다.
 * 메신저(엽서함·채팅)는 헤더 아이콘 둘이던 것을 사람 사이 글끼리 한 구역으로 묶은 것 — 모임 옆에 선다.
 * 설정은 탭이 아니라 '나' 화면 프로필 행의 톱니로 들어가는 서브 화면이다(2026-09-08).
 */
const SECTIONS: { key: SectionKey; label: string; path: string; route: string }[] = [
  { key: 'plaza', label: '광장', path: '/plaza', route: 'plaza' },
  { key: 'shelf', label: '서가', path: '/home', route: 'home' },
  { key: 'clubs', label: '모임', path: '/clubs', route: 'clubs' },
  { key: 'messenger', label: '메신저', path: '/messenger', route: 'messenger' },
  { key: 'me', label: '나', path: '/profile', route: 'profile' },
];

let lastTabIndex = 0;

/**
 * 네이티브 헤더가 없는 메인 화면의 하단 탭.
 * 각 화면이 PaperScreen 안에서 직접 렌더링하므로 세이프에어리어를 직접 처리한다.
 * 종이 아래 끝에 붙은 평평한 바 — 떠 있는 알약이 아니라 괘선 하나로 화면과 나뉘고,
 * 활성 구역은 잉크색 활자 위에 2px 민트 표식(탭 상단)으로만 짚는다.
 */
export function SectionNav({ active, onSelect }: { active: SectionKey; onSelect?: (route: string) => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = useMemo(() => {
    const index = SECTIONS.findIndex((section) => section.key === active);
    return index < 0 ? SECTIONS.findIndex((section) => section.key === 'shelf') : index;
  }, [active]);
  const [visualIndex, setVisualIndex] = useState(activeIndex);
  const translateX = useRef(new Animated.Value(lastTabIndex)).current;

  useEffect(() => {
    setVisualIndex(activeIndex);
    Animated.spring(translateX, {
      toValue: activeIndex,
      useNativeDriver: true,
      stiffness: 260,
      damping: 28,
      mass: 0.8,
    }).start();
    lastTabIndex = activeIndex;
  }, [activeIndex, translateX]);

  const tabWidth = trackWidth > 0 ? trackWidth / SECTIONS.length : 0;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: colors.bg,
          borderTopColor: colors.lineStrong,
        },
      ]}
    >
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="tablist"
      >
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.marker,
              {
                width: tabWidth,
                backgroundColor: colors.accent,
                transform: [{ translateX: Animated.multiply(translateX, tabWidth) }],
              },
            ]}
          />
        ) : null}
        {SECTIONS.map((section, index) => {
          const selected = section.key === active || (active === 'explore' && section.key === 'shelf');
          const visuallySelected = index === visualIndex;
          return (
            <Pressable
              key={section.key}
              onPress={() => {
                if (selected) return;
                setVisualIndex(index);
                Animated.spring(translateX, {
                  toValue: index,
                  useNativeDriver: true,
                  stiffness: 320,
                  damping: 32,
                  mass: 0.7,
                }).start();
                lastTabIndex = index;
                if (onSelect) onSelect(section.route);
                else router.replace(section.path);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              hitSlop={6}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <SectionIcon name={section.key} color={visuallySelected ? colors.text : colors.textFaint} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  styles.label,
                  { color: visuallySelected ? colors.text : colors.textFaint },
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

function SectionIcon({ name, color }: { name: SectionKey; color: string }) {
  const stroke = { stroke: color, ...iconStroke };

  switch (name) {
    case 'plaza':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10.5 12 5l8 5.5" {...stroke} />
          <Path d="M6.5 10v8.5h11V10" {...stroke} />
          <Path d="M9 18.5v-5h6v5" {...stroke} />
        </Svg>
      );
    case 'shelf':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M5 6.5h5.5A2.5 2.5 0 0 1 13 9v9.5a2.5 2.5 0 0 0-2.5-2.5H5z" {...stroke} />
          <Path d="M19 6.5h-3.5A2.5 2.5 0 0 0 13 9v9.5a2.5 2.5 0 0 1 2.5-2.5H19z" {...stroke} />
        </Svg>
      );
    case 'clubs':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={8} cy={8.5} r={2.5} {...stroke} />
          <Circle cx={16} cy={8.5} r={2.5} {...stroke} />
          <Path d="M4.5 18c.6-2.5 2-4 3.5-4s2.9 1.5 3.5 4" {...stroke} />
          <Path d="M12.5 18c.6-2.5 2-4 3.5-4s2.9 1.5 3.5 4" {...stroke} />
        </Svg>
      );
    case 'messenger':
      // 말풍선 — 헤더에 있던 채팅 아이콘과 같은 꼴을 탭 크기(22)로.
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M5 6.5h14v8.5h-8.5L7 18.5V15H5z" {...stroke} />
        </Svg>
      );
    case 'me':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.25} {...stroke} />
          <Path d="M5.5 19c1-3.5 3.3-5.25 6.5-5.25S17.5 15.5 18.5 19" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    borderTopWidth: hairline,
  },
  track: {
    ...layout.content,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 활성 표식 — 탭 상단에 붙는 2px 민트 선. 스프링으로 옆 탭까지 미끄러진다.
  marker: {
    position: 'absolute',
    left: 0,
    top: -hairline,
    height: 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  pressed: pressedStyle,
  label: { fontFamily: sans.semiBold, fontSize: 10, lineHeight: 13, textAlign: 'center' },
});
