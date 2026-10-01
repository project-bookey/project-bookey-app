import { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { hairline, iconStroke, pressedStyle, spacing } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'clubs' | 'messenger' | 'me';

/**
 * 하단 구역 네비. 탐색은 서가의 검색 진입점이라 탭으로 두지 않는다.
 * 경로는 한 곳에서만 정의한다.
 * 서가는 가운데에 두고 집 아이콘을 쓴다 — 앱의 홈이 서가이기 때문(광장은 펼친 책).
 * 메신저(엽서함·채팅)는 헤더 아이콘 둘이던 것을 사람 사이 글끼리 한 구역으로 묶은 것.
 * 설정은 탭이 아니라 '나' 화면 프로필 행의 톱니로 들어가는 서브 화면이다(2026-09-08).
 */
const SECTIONS: { key: SectionKey; label: string; path: string; route: string }[] = [
  { key: 'plaza', label: '광장', path: '/plaza', route: 'plaza' },
  { key: 'clubs', label: '클럽', path: '/clubs', route: 'clubs' },
  { key: 'shelf', label: '서가', path: '/home', route: 'home' },
  { key: 'messenger', label: '메신저', path: '/messenger', route: 'messenger' },
  { key: 'me', label: '나', path: '/profile', route: 'profile' },
];

let lastTabIndex = SECTIONS.findIndex((section) => section.key === 'shelf');

/**
 * 네이티브 헤더가 없는 메인 화면의 하단 탭.
 * 각 화면이 PaperScreen 안에서 직접 렌더링하므로 세이프에어리어를 직접 처리한다.
 * 화면 위에 떠 있는 유리 아일랜드. iOS 26에서는 네이티브 Liquid Glass를 쓰고,
 * 그 외 환경에서는 BlurView + 반투명 면으로 같은 형태와 대비를 유지한다.
 */
export function SectionNav({
  active, onSelect, pagerPosition, pagerOffset,
}: {
  active: SectionKey;
  onSelect?: (route: string) => void;
  pagerPosition?: Animated.Value;
  pagerOffset?: Animated.Value;
}) {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = useMemo(() => {
    const index = SECTIONS.findIndex((section) => section.key === active);
    return index < 0 ? SECTIONS.findIndex((section) => section.key === 'shelf') : index;
  }, [active]);
  const [visualIndex, setVisualIndex] = useState(activeIndex);
  const translateX = useRef(new Animated.Value(lastTabIndex)).current;
  const liveTranslateX = pagerPosition && pagerOffset
    ? Animated.add(pagerPosition, pagerOffset)
    : translateX;

  useEffect(() => {
    setVisualIndex(activeIndex);
    if (!pagerPosition) {
      Animated.spring(translateX, {
        toValue: activeIndex,
        useNativeDriver: true,
        stiffness: 260,
        damping: 28,
        mass: 0.8,
      }).start();
    }
    lastTabIndex = activeIndex;
  }, [activeIndex, pagerPosition, translateX]);

  const tabWidth = trackWidth > 0 ? (trackWidth - 8) / SECTIONS.length : 0;
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  const tabs = (
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
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.68)',
              borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)',
              transform: [{
                translateX: Animated.add(
                  Animated.multiply(liveTranslateX, tabWidth),
                  Math.max((tabWidth - 44) / 2, 0),
                ),
              }],
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
              if (!pagerPosition) {
                Animated.spring(translateX, {
                  toValue: index,
                  useNativeDriver: true,
                  stiffness: 320,
                  damping: 32,
                  mass: 0.7,
                }).start();
              }
              lastTabIndex = index;
              if (onSelect) onSelect(section.route);
              else router.replace(section.path);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={section.label}
            hitSlop={6}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <SectionIcon name={section.key} color={visuallySelected ? colors.accent : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      {nativeGlass ? (
        <GlassView
          isInteractive
          glassEffectStyle="clear"
          colorScheme="auto"
          tintColor={mode === 'dark' ? 'rgba(20,22,21,0.42)' : 'rgba(255,255,255,0.34)'}
          style={[
            styles.glass,
            { borderColor: mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)' },
          ]}
        >
          {tabs}
        </GlassView>
      ) : (
        <BlurView
          intensity={92}
          tint={colors.bg === '#0c0e0d' ? 'dark' : 'light'}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          style={[
            styles.glass,
            {
              backgroundColor: mode === 'dark' ? 'rgba(19,22,20,0.7)' : 'rgba(250,250,248,0.66)',
              borderColor: mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
            },
          ]}
        >
          {tabs}
        </BlurView>
      )}
    </View>
  );
}

function SectionIcon({ name, color }: { name: SectionKey; color: string }) {
  const stroke = { stroke: color, ...iconStroke };
  const size = 27;

  switch (name) {
    case 'plaza':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 6.5h5.5A2.5 2.5 0 0 1 13 9v9.5a2.5 2.5 0 0 0-2.5-2.5H5z" {...stroke} />
          <Path d="M19 6.5h-3.5A2.5 2.5 0 0 0 13 9v9.5a2.5 2.5 0 0 1 2.5-2.5H19z" {...stroke} />
        </Svg>
      );
    case 'shelf':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10.5 12 5l8 5.5" {...stroke} />
          <Path d="M6.5 10v8.5h11V10" {...stroke} />
          <Path d="M9 18.5v-5h6v5" {...stroke} />
        </Svg>
      );
    case 'clubs':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={8} cy={8.5} r={2.5} {...stroke} />
          <Circle cx={16} cy={8.5} r={2.5} {...stroke} />
          <Path d="M4.5 18c.6-2.5 2-4 3.5-4s2.9 1.5 3.5 4" {...stroke} />
          <Path d="M12.5 18c.6-2.5 2-4 3.5-4s2.9 1.5 3.5 4" {...stroke} />
        </Svg>
      );
    case 'messenger':
      // 말풍선 — 헤더에 있던 채팅 아이콘과 같은 꼴을 탭 크기(22)로.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 6.5h14v8.5h-8.5L7 18.5V15H5z" {...stroke} />
        </Svg>
      );
    case 'me':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
    zIndex: 20,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 14,
  },
  glass: {
    height: 60,
    borderRadius: 30,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  track: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  // 활성 표식도 유리 안에서 움직이는 작은 캡슐로 두어 현재 위치를 명확히 한다.
  marker: {
    position: 'absolute',
    left: 4,
    top: 7,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: hairline,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  pressed: pressedStyle,
});
