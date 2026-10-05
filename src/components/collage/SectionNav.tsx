import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import {
  Animated, Easing, type GestureResponderEvent, PanResponder, Platform, Pressable, StyleSheet, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useKeyboardOpen } from '@/components/keyboard';
import { useTourTarget } from '@/components/tour/TourTarget';
import { useTheme } from '@/theme';
import { hairline, iconStroke, motion, pressedStyle, spacing } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'clubs' | 'messenger' | 'me';

/**
 * 하단 구역 네비. 탐색은 홈의 검색 진입점이라 탭으로 두지 않는다.
 * 경로는 한 곳에서만 정의한다.
 * 홈(내 책 · key shelf)은 가운데에 두고 집 아이콘을 쓴다(광장은 펼친 책).
 * 메신저(엽서함·채팅)는 헤더 아이콘 둘이던 것을 사람 사이 글끼리 한 구역으로 묶은 것.
 * 설정은 탭이 아니라 '나' 화면 프로필 행의 톱니로 들어가는 서브 화면이다(2026-09-08).
 */
const SECTIONS: { key: SectionKey; label: string; path: string; route: string }[] = [
  { key: 'plaza', label: '광장', path: '/plaza', route: 'plaza' },
  { key: 'clubs', label: '클럽', path: '/clubs', route: 'clubs' },
  { key: 'shelf', label: '홈', path: '/home', route: 'home' },
  { key: 'messenger', label: '메신저', path: '/messenger', route: 'messenger' },
  { key: 'me', label: '나', path: '/profile', route: 'profile' },
];

/**
 * 구역 화면 목록 끝에 두는 하단 여백 — 떠 있는 유리 바(60)와 바닥 띄움 아래로 마지막 항목이 숨지 않게 한다.
 * 구역 화면은 모두 이 값 하나를 쓴다.
 */
export const NAV_CLEARANCE = 104;

/** 떠 있는 유리 바의 높이 — 바 바로 위에 붙는 것(둘러보기 카드)이 같은 값을 쓴다. */
export const NAV_BAR_HEIGHT = 60;

let lastTabIndex = SECTIONS.findIndex((section) => section.key === 'shelf');

/**
 * 광장 쓰기 버튼(dock) — 광장에서만 바 오른쪽에 바와 같은 높이의 둥근 유리 단추를 세우고, 그만큼 바를 줄인다
 * (사용자 결정 2026-10-05, B안 · 움직임 ③ '스와이프를 따라').
 *
 * 줄어든 바: 왼쪽 끝 36 → 16, 오른쪽 끝 36 → 16 + 60(단추) + 8(틈) = 84. 화면 폭과 상관없이 같은 값이다.
 *
 * 바의 **레이아웃 폭은 그대로** 두고 transform 으로만 줄인다. 활성 표식은 trackWidth(onLayout)로 잰 탭 폭 ×
 * 페이저 값(네이티브)으로 움직이는데, 폭을 레이아웃으로 바꾸면 프레임마다 onLayout → 다시 그리기가 돌아 표식이
 * 어긋나고 흔들린다. 그래서 줄어든 정도(dock, 0~1) 하나로 유리는 옮기고 좁히고(scaleX), 그 안의 탭 줄은 역배율로
 * 늘어나지 않게 한 뒤 아이콘·표식만 가운데 쪽으로 모은다 — 모두 네이티브 드라이버라 넘기는 손가락을 그대로 따른다.
 */
const PLAZA_INDEX = SECTIONS.findIndex((section) => section.key === 'plaza');
const DOCK_SIZE = NAV_BAR_HEIGHT;
/** 왼쪽 끝이 바깥으로 나가는 거리(36 → 16). */
const DOCK_LEFT_OUT = spacing.xxl - spacing.lg;
/** 오른쪽 끝이 안으로 들어오는 거리(36 → 84). */
const DOCK_RIGHT_IN = spacing.lg + DOCK_SIZE + spacing.sm - spacing.xxl;
/** 줄어드는 폭(28)과 가운데가 왼쪽으로 옮겨 가는 거리(34). */
const DOCK_SHRINK = DOCK_RIGHT_IN - DOCK_LEFT_OUT;
const DOCK_SHIFT = (DOCK_LEFT_OUT + DOCK_RIGHT_IN) / 2;
/** 탭 한 칸이 좁아지는 양 — 아이콘은 가운데 칸을 기준으로 이만큼씩 모인다. */
const TAB_PULL = DOCK_SHRINK / SECTIONS.length;
const TAB_CENTER = (SECTIONS.length - 1) / 2;
/** 탭 줄 좌우 안쪽 여백(styles.track) — 표식·탭 칸 계산에 쓴다. */
const TRACK_INSET = spacing.xs;
/** 탭 칸 높이(styles.tab) — 유리(60) 안에서 위아래 1씩 남는다. */
const TAB_HEIGHT = 58;

/**
 * 네이티브 헤더가 없는 메인 화면의 하단 탭.
 * 각 화면이 PaperScreen 안에서 직접 렌더링하므로 세이프에어리어를 직접 처리한다.
 * 화면 위에 떠 있는 유리 아일랜드. iOS 26에서는 네이티브 Liquid Glass를 쓰고,
 * 그 외 환경에서는 BlurView + 반투명 면으로 같은 형태와 대비를 유지한다.
 */
export function SectionNav({
  active, onSelect, pagerPosition, pagerOffset, onCompose,
}: {
  active: SectionKey;
  onSelect?: (route: string) => void;
  pagerPosition?: Animated.Value;
  pagerOffset?: Animated.Value;
  /** 있으면 광장에서 바 옆에 독후감 쓰기 단추를 세운다(위 dock 주석). */
  onCompose?: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // 키보드가 떠 있는 동안은 숨는다(표준 탭 바와 같은 동작) — 답장·엽서 칸 바로 위에 떠서 입력과 보내기 버튼을 덮지 않게.
  // 부품은 그대로 두고 그리기만 거둬, 유리 효과·선택 위치가 다시 잡히지 않는다.
  const keyboardOpen = useKeyboardOpen();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = useMemo(() => {
    const index = SECTIONS.findIndex((section) => section.key === active);
    return index < 0 ? SECTIONS.findIndex((section) => section.key === 'shelf') : index;
  }, [active]);
  const [visualIndex, setVisualIndex] = useState(activeIndex);
  const visualIndexRef = useRef(activeIndex);
  const requestedIndexRef = useRef(activeIndex);
  const barRef = useRef<View>(null);
  const trackLeft = useRef(0);
  const trackWidthRef = useRef(0);
  const draggedIndex = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragFrame = useRef<number | null>(null);
  const nextDragPosition = useRef(activeIndex);
  const translateX = useRef(new Animated.Value(lastTabIndex)).current;
  const pagerTranslateX = useMemo(
    () => (pagerPosition && pagerOffset ? Animated.add(pagerPosition, pagerOffset) : translateX),
    [pagerPosition, pagerOffset, translateX],
  );
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

  const tabWidth = trackWidth > 0 ? (trackWidth - TRACK_INSET * 2) / SECTIONS.length : 0;

  // ── 광장 쓰기 단추(dock) ──
  const docks = onCompose != null;
  const onPlaza = activeIndex === PLAZA_INDEX;
  // 탭을 눌러 옮길 때만 쓰는 시간 몫. 페이저 값은 탭에서 한 번에 건너뛰므로 그때는 0.25초에 걸쳐 따라가게 섞는다.
  const tapDock = useRef(new Animated.Value(onPlaza ? 1 : 0)).current;
  const tapBlend = useRef(new Animated.Value(0)).current;
  /** 줄어든 정도 — 넘기는 동안은 페이저 위치를 그대로 따르고(광장 1, 옆 구역 0), 탭으로 옮길 땐 시간 몫으로 바뀐다. */
  const dock = useMemo(() => {
    // 광장이 맨 앞이면 그 왼쪽으로 당기는 되튐(overdrag)에서도 줄어든 채로 둔다 — 왼쪽엔 구역이 없다.
    const follow = pagerTranslateX.interpolate({
      inputRange: [PLAZA_INDEX - 1, PLAZA_INDEX, PLAZA_INDEX + 1],
      outputRange: [PLAZA_INDEX === 0 ? 1 : 0, 1, 0],
      extrapolate: 'clamp',
    });
    return Animated.add(
      Animated.multiply(follow, Animated.add(1, Animated.multiply(tapBlend, -1))),
      Animated.multiply(tapDock, tapBlend),
    );
  }, [pagerTranslateX, tapBlend, tapDock]);
  // 유리는 옮기고 좁히고, 탭 줄은 역배율로 되돌린다. 폭을 재기 전(첫 그리기)에는 아무것도 걸지 않는다.
  const dockTransforms = useMemo(() => {
    if (!docks || trackWidth <= 0) return null;
    const glassScale = Animated.add(1, Animated.multiply(dock, -DOCK_SHRINK / (trackWidth + hairline * 2)));
    return {
      glass: [{ translateX: Animated.multiply(dock, -DOCK_SHIFT) }, { scaleX: glassScale }],
      track: [{ scaleX: Animated.divide(1, glassScale) }],
      button: { opacity: dock, transform: [{ scale: Animated.add(0.85, Animated.multiply(dock, 0.15)) }] },
    };
  }, [docks, trackWidth, dock]);

  /** 탭으로 광장에 들고 날 때 — 지금 값에서 목표까지 시간으로 옮긴 뒤 다시 페이저 값을 따르게 한다. */
  const easeDock = (index: number) => {
    if (!docks || !pagerPosition) return;
    const from = onPlaza ? 1 : 0;
    const to = index === PLAZA_INDEX ? 1 : 0;
    if (from === to) return;
    tapDock.setValue(from);
    tapBlend.setValue(1);
    Animated.timing(tapDock, {
      toValue: to,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 끝나면 페이저도 목표 구역에 와 있어 두 값이 같다 — 이음매 없이 다시 손가락을 따른다.
      if (finished) tapBlend.setValue(0);
    });
  };

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
    easeDock(index);
    if (onSelect) onSelect(section.route);
    else router.replace(section.path);
  };

  // 바 상자(변형 없음)에서 재고 탭 줄 자리는 계산한다 — 유리·탭 줄은 광장에서 transform 으로 줄어 있어,
  // 직접 재면 변형을 넣어 재는지가 플랫폼마다 갈린다. 끌기는 구역이 멈춰 있을 때 시작하므로 그때의 모양으로 센다.
  const measureTrack = () => {
    barRef.current?.measureInWindow((x, _y, width) => {
      const shrunk = docks && onPlaza;
      trackLeft.current = x + spacing.xxl - (shrunk ? DOCK_LEFT_OUT : 0) + TRACK_INSET;
      trackWidthRef.current = Math.max(width - spacing.xxl * 2 - (shrunk ? DOCK_SHRINK : 0) - TRACK_INSET * 2, 0);
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

  // 표식 자리 — 광장에서 아이콘이 가운데 쪽으로 모인 만큼(−TAB_PULL·(L−2)·dock) 함께 옮긴다.
  const markerX = Animated.add(
    Animated.multiply(liveTranslateX, tabWidth),
    Math.max((tabWidth - 44) / 2, 0),
  );
  const tabs = (
    <Animated.View
      style={[styles.track, dockTransforms && { transform: dockTransforms.track }]}
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
              backgroundColor: colors.accent,
              borderColor: colors.accent,
              transform: [{
                translateX: dockTransforms
                  ? Animated.add(
                    markerX,
                    Animated.multiply(dock, Animated.multiply(Animated.add(liveTranslateX, -TAB_CENTER), -TAB_PULL)),
                  )
                  : markerX,
              }, { scaleX: dragStretch }],
            },
          ]}
        />
      ) : null}
      {SECTIONS.map((section, index) => {
        const selected = section.key === active || (active === 'explore' && section.key === 'shelf');
        return (
          <SectionTab
            key={section.key}
            section={section}
            selected={selected}
            visuallySelected={index === visualIndex}
            shift={dockTransforms ? Animated.multiply(dock, -(index - TAB_CENTER) * TAB_PULL) : undefined}
            tourTarget={!docks}
            onPress={() => {
              if (selected) return;
              selectIndex(index);
            }}
          />
        );
      })}
    </Animated.View>
  );

  const bottom = Math.max(insets.bottom, spacing.md);
  const display = keyboardOpen ? 'none' : 'flex';
  // 둘러보기가 탭 아이콘을 비출 자리 — 광장에서는 아이콘이 transform 으로 옮겨 있어(네이티브 드라이버 값은
  // 재는 쪽에서 안 보일 수 있다) 레이아웃으로 같은 자리에 둔 보이지 않는 칸을 대신 잰다.
  const shrunkNow = docks && onPlaza;
  const anchorTab = tabWidth > 0 ? tabWidth - (shrunkNow ? TAB_PULL : 0) : 0;
  const anchorLeft = spacing.xxl - (shrunkNow ? DOCK_LEFT_OUT : 0) + TRACK_INSET;

  return (
    <>
      <View ref={barRef} style={[styles.bar, { bottom, display }]}>
        <Animated.View style={dockTransforms && { transform: dockTransforms.glass }}>
          <NavGlass style={styles.glass} interactive>{tabs}</NavGlass>
        </Animated.View>
      </View>
      {docks ? (
        // 바와 같은 상자(여백 없음) — 쓰기 단추와 둘러보기 자리만 얹고 나머지 터치는 아래로 흘린다.
        <View pointerEvents="box-none" style={[styles.dockLayer, { bottom, display }]}>
          {anchorTab > 0
            ? SECTIONS.map((section, index) => (
              <TabAnchor
                key={section.key}
                route={section.route}
                left={anchorLeft + index * anchorTab}
                width={anchorTab}
              />
            ))
            : null}
          <Animated.View
            pointerEvents={onPlaza ? 'auto' : 'none'}
            aria-hidden={!onPlaza}
            accessibilityElementsHidden={!onPlaza}
            importantForAccessibility={onPlaza ? 'auto' : 'no-hide-descendants'}
            style={[styles.dock, dockTransforms ? dockTransforms.button : { opacity: onPlaza ? 1 : 0 }]}
          >
            <ComposeDock onPress={onCompose} />
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

/** 바와 쓰기 단추가 함께 쓰는 유리 — iOS 26 은 네이티브 Liquid Glass, 그 밖은 BlurView + 반투명 면. */
function NavGlass({ style, interactive = false, children }: {
  style: StyleProp<ViewStyle>;
  interactive?: boolean;
  children: ReactNode;
}) {
  const { colors, mode } = useTheme();
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  if (nativeGlass) {
    return (
      <GlassView
        isInteractive={interactive}
        glassEffectStyle="clear"
        colorScheme="auto"
        tintColor={mode === 'dark' ? 'rgba(20,22,21,0.42)' : 'rgba(255,255,255,0.34)'}
        style={[style, { borderColor: mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)' }]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView
      intensity={92}
      tint={colors.bg === '#0c0e0d' ? 'dark' : 'light'}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
      style={[
        style,
        {
          backgroundColor: mode === 'dark' ? 'rgba(19,22,20,0.7)' : 'rgba(250,250,248,0.66)',
          borderColor: mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
        },
      ]}
    >
      {children}
    </BlurView>
  );
}

/** 광장 독후감 쓰기 단추 — 바와 같은 유리 원에 초록 연필. 둘러보기 광장 단계가 이 단추를 비춘다. */
function ComposeDock({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const tourRef = useTourTarget('plaza-compose');
  return (
    <NavGlass style={styles.dockFace}>
      <Pressable
        ref={tourRef}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="독후감 쓰기"
        style={({ pressed }) => [styles.dockPress, pressed && styles.pressed]}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          <Path d="M5 18.5 6.2 14 15.8 4.4a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L10 17.8z" stroke={colors.accent} {...iconStroke} />
          <Path d="m14.5 5.8 3.7 3.7" stroke={colors.accent} {...iconStroke} />
        </Svg>
      </Pressable>
    </NavGlass>
  );
}

/** 둘러보기가 재는 탭 자리(보이지 않음) — `nav-<구역>` 대상. */
function TabAnchor({ route, left, width }: { route: string; left: number; width: number }) {
  const ref = useTourTarget(`nav-${route}`);
  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="none"
      style={[styles.anchor, { left, width }]}
    />
  );
}

/**
 * 탭 하나 — 둘러보기가 이 아이콘을 비출 수 있게 `nav-<구역>` 대상으로 올린다(아이콘만 있는 탭의 이름을 익히는 자리).
 * 쓰기 단추가 서는 바에서는 아이콘이 transform 으로 옮겨 다니므로 그 대상은 TabAnchor 가 맡는다(tourTarget=false).
 */
function SectionTab({ section, selected, visuallySelected, shift, tourTarget, onPress }: {
  section: (typeof SECTIONS)[number];
  selected: boolean;
  visuallySelected: boolean;
  /** 광장에서 가운데 쪽으로 모이는 거리(네이티브 값). */
  shift?: Animated.AnimatedMultiplication<number>;
  tourTarget: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tourRef = useTourTarget(tourTarget ? `nav-${section.route}` : '');
  return (
    <Animated.View style={[styles.tabSlot, shift && { transform: [{ translateX: shift }] }]}>
      <Pressable
        ref={tourTarget ? tourRef : undefined}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={section.label}
        hitSlop={6}
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      >
        <SectionIcon name={section.key} color={visuallySelected ? colors.onAccent : colors.textMuted} />
      </Pressable>
    </Animated.View>
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
    height: NAV_BAR_HEIGHT,
    borderRadius: 30,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  // 쓰기 단추 층 — 바(styles.bar)와 같은 상자인데 안쪽 여백이 없어 오른쪽 16 이 곧 화면 여백이다.
  dockLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 21,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    height: NAV_BAR_HEIGHT,
  },
  // 바의 그림자와 같은 떠 있는 유리(사용자 결정 — 하단 바의 캡슐·그림자 예외를 이 단추까지 넓힌다).
  dock: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    width: DOCK_SIZE,
    height: DOCK_SIZE,
    // 그림자가 원을 따르게 — 웹은 상자 모서리로 그림자를 그려, 둥글리지 않으면 네모 그림자가 진다.
    borderRadius: DOCK_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 14,
  },
  dockFace: {
    width: DOCK_SIZE,
    height: DOCK_SIZE,
    borderRadius: DOCK_SIZE / 2,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  dockPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  anchor: { position: 'absolute', top: (NAV_BAR_HEIGHT - TAB_HEIGHT) / 2, height: TAB_HEIGHT },
  track: {
    height: TAB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TRACK_INSET,
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
  tabSlot: { flex: 1, minWidth: 0 },
  tab: {
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  pressed: pressedStyle,
});
