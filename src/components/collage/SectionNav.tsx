import { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import {
  Animated, type GestureResponderEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { hairline, iconStroke, pressedStyle, sans, spacing } from '@/theme/tokens';

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
  const visualIndexRef = useRef(activeIndex);
  const requestedIndexRef = useRef(activeIndex);
  const trackRef = useRef<View>(null);
  const trackLeft = useRef(0);
  const trackWidthRef = useRef(0);
  const draggedIndex = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragFrame = useRef<number | null>(null);
  const nextDragPosition = useRef(activeIndex);
  const translateX = useRef(new Animated.Value(lastTabIndex)).current;
  const pagerTranslateX = pagerPosition && pagerOffset
    ? Animated.add(pagerPosition, pagerOffset)
    : translateX;
  const dragPosition = useRef(new Animated.Value(activeIndex)).current;
  const dragBlend = useRef(new Animated.Value(0)).current;
  const dragStretch = useRef(new Animated.Value(1)).current;
  const liveTranslateX = Animated.add(
    Animated.multiply(pagerTranslateX, Animated.add(1, Animated.multiply(dragBlend, -1))),
    Animated.multiply(dragPosition, dragBlend),
  );

  useEffect(() => {
    if (!isDragging.current) {
      setVisualIndex(activeIndex);
      visualIndexRef.current = activeIndex;
      requestedIndexRef.current = activeIndex;
      dragPosition.setValue(activeIndex);
    }
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
  }, [activeIndex, dragPosition, pagerPosition, translateX]);

  const tabWidth = trackWidth > 0 ? (trackWidth - 8) / SECTIONS.length : 0;
  // 표식은 아이콘+라벨 묶음을 감싼다 — 탭 폭에서 양옆 2pt 씩만 남긴다.
  const markerWidth = Math.max(tabWidth - 4, 44);
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  const selectIndex = (index: number) => {
    const section = SECTIONS[index];
    if (!section || index === requestedIndexRef.current) return;
    requestedIndexRef.current = index;
    visualIndexRef.current = index;
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
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackLeft.current = x + 4;
      trackWidthRef.current = Math.max(width - 8, 0);
    });
  };

  const scrubTo = (event: GestureResponderEvent) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const relativeX = Math.max(0, Math.min(event.nativeEvent.pageX - trackLeft.current, width - 1));
    const continuousIndex = Math.max(
      0,
      Math.min((relativeX / width) * SECTIONS.length - 0.5, SECTIONS.length - 1),
    );
    nextDragPosition.current = continuousIndex;
    if (dragFrame.current === null) {
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = null;
        dragPosition.setValue(nextDragPosition.current);
      });
    }
    const index = Math.max(0, Math.min(Math.floor((relativeX / width) * SECTIONS.length), SECTIONS.length - 1));
    if (draggedIndex.current === index) return;
    draggedIndex.current = index;
    visualIndexRef.current = index;
    setVisualIndex(index);
  };
  const scrubResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderGrant: (event) => {
      measureTrack();
      isDragging.current = true;
      draggedIndex.current = null;
      dragPosition.setValue(visualIndexRef.current);
      dragBlend.setValue(1);
      Animated.spring(dragStretch, {
        toValue: 1.16,
        useNativeDriver: true,
        stiffness: 420,
        damping: 32,
        mass: 0.55,
      }).start();
      scrubTo(event);
    },
    onPanResponderMove: scrubTo,
    onPanResponderRelease: () => {
      const destination = draggedIndex.current ?? visualIndexRef.current;
      if (dragFrame.current !== null) {
        cancelAnimationFrame(dragFrame.current);
        dragFrame.current = null;
      }
      draggedIndex.current = null;
      isDragging.current = false;
      selectIndex(destination);
      Animated.parallel([
        Animated.spring(dragPosition, {
          toValue: destination,
          useNativeDriver: true,
          stiffness: 420,
          damping: 32,
          mass: 0.62,
        }),
        Animated.spring(dragStretch, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 360,
          damping: 24,
          mass: 0.7,
        }),
      ]).start(() => dragBlend.setValue(0));
    },
    onPanResponderTerminate: () => {
      if (dragFrame.current !== null) {
        cancelAnimationFrame(dragFrame.current);
        dragFrame.current = null;
      }
      draggedIndex.current = null;
      isDragging.current = false;
      visualIndexRef.current = activeIndex;
      requestedIndexRef.current = activeIndex;
      setVisualIndex(activeIndex);
      dragPosition.setValue(activeIndex);
      dragBlend.setValue(0);
      dragStretch.setValue(1);
    },
    onPanResponderTerminationRequest: () => false,
  });

  const tabs = (
    <View
      ref={trackRef}
      style={styles.track}
      onLayout={(event) => {
        setTrackWidth(event.nativeEvent.layout.width);
        requestAnimationFrame(measureTrack);
      }}
      {...scrubResponder.panHandlers}
      accessibilityRole="tablist"
    >
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.marker,
            {
              width: markerWidth,
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.68)',
              borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)',
              transform: [{
                translateX: Animated.add(
                  Animated.multiply(liveTranslateX, tabWidth),
                  Math.max((tabWidth - markerWidth) / 2, 0),
                ),
              }, { scaleX: dragStretch }],
            },
          ]}
        />
      ) : null}
      {SECTIONS.map((section, index) => {
        const selected = section.key === active || (active === 'explore' && section.key === 'shelf');
        const visuallySelected = index === visualIndex;
        // 선택은 잉크로 — 악센트는 화면 안의 CTA 몫(UX 철칙 Von Restorff).
        const tint = visuallySelected ? colors.ink : colors.textMuted;
        return (
          <Pressable
            key={section.key}
            onPress={() => {
              if (selected) return;
              selectIndex(index);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={section.label}
            hitSlop={6}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <SectionIcon name={section.key} color={tint} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color: tint }]}>
              {section.label}
            </Text>
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
  const size = 24;

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
  // 활성 표식도 유리 안에서 움직이는 작은 캡슐로 두어 현재 위치를 명확히 한다. 폭은 탭 폭에 맞춰 그린다.
  marker: {
    position: 'absolute',
    left: 4,
    top: 4,
    height: 50,
    borderRadius: 25,
    borderWidth: hairline,
  },
  // 아이콘만으로는 '광장·서가' 같은 이 앱만의 구역을 알아보기 어렵다 — 라벨을 함께 둔다(UX 철칙 Jakob).
  tab: {
    flex: 1,
    minWidth: 0,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  label: { fontFamily: sans.semiBold, fontSize: 10, lineHeight: 12 },
  pressed: pressedStyle,
});
