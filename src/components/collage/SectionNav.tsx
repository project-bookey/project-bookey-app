import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import {
  Animated, BackHandler, Easing, type GestureResponderEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useKeyboardOpen } from '@/components/keyboard';
import { useTourTarget } from '@/components/tour/TourTarget';
import { useTheme } from '@/theme';
import { hairline, iconStroke, motion, pressedStyle, spacing, typeScale } from '@/theme/tokens';

export type SectionKey = 'shelf' | 'explore' | 'plaza' | 'clubs' | 'messenger' | 'me';

/**
 * 하단 구역 네비. 탐색은 홈의 검색 진입점이라 탭으로 두지 않는다.
 * 경로는 한 곳에서만 정의한다.
 * 홈(내 책 · key shelf)은 가운데에 두고 집 아이콘을 쓴다(광장은 펼친 책).
 * 엽서(키 messenger, 편지지 아이콘)는 받은·보낸 엽서를 한 목록으로 모은 구역 — 채팅은 구역이 아니라
 * 헤더 왼쪽 말풍선(BrandHeader)으로 어디서든 연다(2026-10-05, 사용자 결정).
 * 설정은 탭이 아니라 '나' 화면 프로필 행의 톱니로 들어가는 서브 화면이다(2026-09-08).
 */
const SECTIONS: { key: SectionKey; label: string; path: string; route: string }[] = [
  { key: 'plaza', label: '광장', path: '/plaza', route: 'plaza' },
  { key: 'clubs', label: '클럽', path: '/clubs', route: 'clubs' },
  { key: 'shelf', label: '홈', path: '/home', route: 'home' },
  { key: 'messenger', label: '엽서', path: '/messenger', route: 'messenger' },
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
 * 바 옆 단추(dock) — 광장·클럽에서 바 오른쪽에 바와 같은 높이의 둥근 유리 단추를 세우고, 그만큼 바를 줄인다
 * (사용자 결정 2026-10-05, B안 · 움직임 ③ '스와이프를 따라'). 광장은 독후감 쓰기(연필), 클럽은 만들기·참가
 * 메뉴(＋ — 누르면 화면이 가라앉고 그 위로 유리 알약 둘이 올라온다). 광장 ↔ 클럽 사이에서는 바가 줄어든 채
 * 단추 그림만 바뀐다.
 *
 * 줄어든 바: 왼쪽 끝 36 → 16, 오른쪽 끝 36 → 16 + 60(단추) + 8(틈) = 84. 화면 폭과 상관없이 같은 값이다.
 *
 * 바의 **레이아웃 폭은 그대로** 두고 transform 으로만 줄인다. 활성 표식은 trackWidth(onLayout)로 잰 탭 폭 ×
 * 페이저 값(네이티브)으로 움직이는데, 폭을 레이아웃으로 바꾸면 프레임마다 onLayout → 다시 그리기가 돌아 표식이
 * 어긋나고 흔들린다. 그래서 줄어든 정도(dock, 0~1) 하나로 유리는 옮기고 좁히고(scaleX), 그 안의 탭 줄은 역배율로
 * 늘어나지 않게 한 뒤 아이콘·표식만 가운데 쪽으로 모은다 — 모두 네이티브 드라이버라 넘기는 손가락을 그대로 따른다.
 */
const PLAZA_INDEX = SECTIONS.findIndex((section) => section.key === 'plaza');
const CLUBS_INDEX = SECTIONS.findIndex((section) => section.key === 'clubs');
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
/** 클럽 메뉴가 열리고 닫히는 시간(ms) — 닫힐 땐 조금 빨리. */
const MENU_IN = 220;
const MENU_OUT = 140;

/**
 * 네이티브 헤더가 없는 메인 화면의 하단 탭.
 * 각 화면이 PaperScreen 안에서 직접 렌더링하므로 세이프에어리어를 직접 처리한다.
 * 화면 위에 떠 있는 유리 아일랜드. iOS 26에서는 네이티브 Liquid Glass를 쓰고,
 * 그 외 환경에서는 BlurView + 반투명 면으로 같은 형태와 대비를 유지한다.
 */
export function SectionNav({
  active, onSelect, pagerPosition, pagerOffset, onCompose, onCreateClub, onJoinClub,
}: {
  active: SectionKey;
  onSelect?: (route: string) => void;
  pagerPosition?: Animated.Value;
  pagerOffset?: Animated.Value;
  /** 있으면 광장에서 바 옆에 독후감 쓰기 단추를 세운다(위 dock 주석). */
  onCompose?: () => void;
  /** 둘 다 있으면 클럽에서 바 옆에 만들기·참가 메뉴 단추를 세운다. */
  onCreateClub?: () => void;
  onJoinClub?: () => void;
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

  // ── 바 옆 단추(dock) — 광장은 독후감 쓰기, 클럽은 만들기·참가 메뉴 ──
  const clubMenu = onCreateClub != null && onJoinClub != null;
  const composes = onCompose != null;
  const docks = composes || clubMenu;
  /** 구역마다 단추가 서는지 — '10000' 처럼 한 줄로 두어 아래 계산의 의존성으로 쓴다. */
  const dockedKey = SECTIONS
    .map((_, index) => ((index === PLAZA_INDEX && composes) || (index === CLUBS_INDEX && clubMenu) ? '1' : '0'))
    .join('');
  const dockedNow = dockedKey[activeIndex] === '1';
  // 탭을 눌러 옮길 때만 쓰는 시간 몫. 페이저 값은 탭에서 한 번에 건너뛰므로, 그때는 위치를 0.25초에 걸쳐 옮겨 섞는다.
  const tapPos = useRef(new Animated.Value(activeIndex)).current;
  const tapBlend = useRef(new Animated.Value(0)).current;
  /** 단추·바 모양이 따르는 위치 — 넘기는 동안은 페이저 값 그대로, 탭으로 옮길 땐 시간으로 옮긴 값. */
  const dockPos = useMemo(() => Animated.add(
    Animated.multiply(pagerTranslateX, Animated.add(1, Animated.multiply(tapBlend, -1))),
    Animated.multiply(tapPos, tapBlend),
  ), [pagerTranslateX, tapBlend, tapPos]);
  /**
   * 줄어든 정도 — 단추가 서는 구역에서 1, 아닌 구역에서 0, 그 사이는 넘긴 만큼.
   * 맨 앞 구역의 왼쪽 되튐(overdrag)은 맨 앞 구역 값을 따른다 — 왼쪽엔 구역이 없다.
   */
  const dock = useMemo(() => {
    const flags = dockedKey.split('').map(Number);
    return dockPos.interpolate({
      inputRange: [-1, ...flags.map((_, index) => index)],
      outputRange: [flags[0], ...flags],
      extrapolate: 'clamp',
    });
  }, [dockPos, dockedKey]);
  /** 단추 그림 — 광장(연필)에서 클럽(＋)으로 넘어간 정도. 둘 중 하나만 서면 그 그림만 쓴다. */
  const icons = useMemo(() => {
    const mix = dockPos.interpolate({ inputRange: [PLAZA_INDEX, CLUBS_INDEX], outputRange: [0, 1], extrapolate: 'clamp' });
    return {
      pen: composes ? (clubMenu ? Animated.subtract(1, mix) : 1) : 0,
      plus: clubMenu ? (composes ? mix : 1) : 0,
    };
  }, [dockPos, composes, clubMenu]);
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

  /** 탭으로 옮길 때 — 지금 구역에서 목표 구역까지 시간으로 옮긴 뒤 다시 페이저 값을 따르게 한다. */
  const easeDock = (index: number) => {
    if (!docks || !pagerPosition) return;
    tapPos.setValue(activeIndex);
    tapBlend.setValue(1);
    Animated.timing(tapPos, {
      toValue: index,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 끝나면 페이저도 목표 구역에 와 있어 두 값이 같다 — 이음매 없이 다시 손가락을 따른다.
      if (finished) tapBlend.setValue(0);
    });
  };

  // ── 클럽 메뉴 ──
  const [menuOpen, setMenuOpen] = useState(false);
  /** 닫히는 동안에도 그린다 — 다 닫히면 걷는다. */
  const [menuShown, setMenuShown] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const openMenu = (open: boolean) => {
    setMenuOpen(open);
    if (open) setMenuShown(true);
    Animated.timing(menuAnim, {
      toValue: open ? 1 : 0,
      duration: open ? MENU_IN : MENU_OUT,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMenuShown(false);
    });
  };
  // 구역이 바뀌거나 키보드가 뜨면 닫는다 — 열린 채 다른 화면에 남지 않게.
  useEffect(() => {
    if (menuOpen) openMenu(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, keyboardOpen]);
  // 안드로이드 뒤로 가기는 메뉴부터 닫는다.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      openMenu(false);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);
  const pressDock = () => {
    if (activeIndex === PLAZA_INDEX) onCompose?.();
    else if (activeIndex === CLUBS_INDEX) openMenu(!menuOpen);
  };
  /** 메뉴에서 고르면 닫고 바로 그 화면으로 — 모달이 아니라 화면 전환과 엇갈리지 않는다. */
  const pick = (go?: () => void) => {
    openMenu(false);
    go?.();
  };
  const dockLabel = activeIndex === CLUBS_INDEX
    ? (menuOpen ? '메뉴 닫기' : '클럽 만들기·참가 메뉴 열기')
    : '독후감 쓰기';

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
      const shrunk = dockedNow;
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
  const shrunkNow = dockedNow;
  const anchorTab = tabWidth > 0 ? tabWidth - (shrunkNow ? TAB_PULL : 0) : 0;
  const anchorLeft = spacing.xxl - (shrunkNow ? DOCK_LEFT_OUT : 0) + TRACK_INSET;

  return (
    <>
      <View ref={barRef} style={[styles.bar, { bottom, display }]}>
        <Animated.View style={dockTransforms && { transform: dockTransforms.glass }}>
          <NavGlass style={styles.glass} interactive>{tabs}</NavGlass>
        </Animated.View>
      </View>
      {menuShown ? (
        // 메뉴가 열리면 화면을 덮개로 가라앉힌다 — 하단 바는 덮개 위에 남아 ×·알약과 같은 유리색으로 보인다
        // (사용자 결정 2026-10-05). 덮개를 누르면 닫힌다.
        <Animated.View style={[styles.scrim, { backgroundColor: colors.scrimMenu, opacity: menuAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => openMenu(false)}
            accessibilityRole="button"
            accessibilityLabel="메뉴 닫기"
          />
        </Animated.View>
      ) : null}
      {docks ? (
        // 바와 같은 상자(여백 없음) — 단추와 둘러보기 자리만 얹고 나머지 터치는 아래로 흘린다.
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
            pointerEvents={dockedNow ? 'auto' : 'none'}
            aria-hidden={!dockedNow}
            accessibilityElementsHidden={!dockedNow}
            importantForAccessibility={dockedNow ? 'auto' : 'no-hide-descendants'}
            style={[styles.dock, dockTransforms ? dockTransforms.button : { opacity: dockedNow ? 1 : 0 }]}
          >
            <DockButton
              label={dockLabel}
              expanded={activeIndex === CLUBS_INDEX ? menuOpen : undefined}
              onPress={pressDock}
              pen={icons.pen}
              plus={icons.plus}
              turn={menuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] })}
            />
          </Animated.View>
        </View>
      ) : null}
      {menuShown ? (
        // 단추 바로 위로 올라오는 유리 알약 둘 — 세로로 쌓을 땐 주요 동작(만들기)이 위(앱 공통 규칙).
        <View
          pointerEvents={menuOpen ? 'box-none' : 'none'}
          style={[styles.menuLayer, { bottom: bottom + DOCK_SIZE + spacing.md }]}
        >
          <MenuPill label="클럽 만들기" icon="create" anim={menuAnim} range={[0.25, 1]} onPress={() => pick(onCreateClub)} />
          <MenuPill label="코드로 참가" icon="join" anim={menuAnim} range={[0, 0.75]} onPress={() => pick(onJoinClub)} />
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

type AnimatedNumber = Animated.AnimatedInterpolation<number> | Animated.AnimatedSubtraction<number> | number;

/**
 * 바 옆 단추 — 바와 같은 유리 원에, 그림은 옆 탭 아이콘과 같은 회색(textMuted)으로 바와 한 몸처럼 둔다
 * (사용자 결정 2026-10-05). 광장은 연필, 클럽은 ＋(메뉴가 열리면 45° 돌아 ×). 둘러보기 광장·클럽 단계가 이 단추를 비춘다.
 */
function DockButton({ label, expanded, onPress, pen, plus, turn }: {
  label: string;
  /** 클럽에서만 — 메뉴가 열려 있는지. */
  expanded?: boolean;
  onPress: () => void;
  pen: AnimatedNumber;
  plus: AnimatedNumber;
  turn: Animated.AnimatedInterpolation<string>;
}) {
  const { colors } = useTheme();
  const plazaRef = useTourTarget('plaza-compose');
  const clubsRef = useTourTarget('club-actions');
  const stroke = { stroke: colors.textMuted, ...iconStroke };
  return (
    <NavGlass style={styles.dockFace}>
      <Pressable
        ref={(node) => {
          plazaRef(node);
          clubsRef(node);
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        style={({ pressed }) => [styles.dockPress, pressed && styles.pressed]}
      >
        <Animated.View style={[styles.dockIcon, { opacity: pen }]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path d="M5 18.5 6.2 14 15.8 4.4a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L10 17.8z" {...stroke} />
            <Path d="m14.5 5.8 3.7 3.7" {...stroke} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.dockIcon, { opacity: plus, transform: [{ rotate: turn }] }]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path d="M12 4.5v15M4.5 12h15" {...stroke} />
          </Svg>
        </Animated.View>
      </Pressable>
    </NavGlass>
  );
}

/**
 * 클럽 메뉴의 유리 알약 하나 — 단추와 같은 유리에 그림·이름 모두 옆 탭 아이콘과 같은 회색(사용자 결정 2026-10-05, 시안 ① 유리 알약).
 * range 는 메뉴가 열리는 진행(0~1) 중 이 알약이 나타나는 구간 — 아래 것이 먼저, 위 것이 조금 늦게 올라온다.
 */
function MenuPill({ label, icon, anim, range, onPress }: {
  label: string;
  icon: 'create' | 'join';
  anim: Animated.Value;
  range: [number, number];
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const stroke = { stroke: colors.textMuted, ...iconStroke };
  const shown = anim.interpolate({ inputRange: range, outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View
      style={[
        styles.pillShadow,
        { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <NavGlass style={styles.pill}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.pillPress, pressed && styles.pressed]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            {icon === 'create' ? (
              <>
                <Circle cx={9} cy={8.5} r={2.75} {...stroke} />
                <Path d="M3.5 18.5c.7-2.8 2.6-4.5 5.5-4.5s4.8 1.7 5.5 4.5" {...stroke} />
                <Path d="M18.5 8v7M15 11.5h7" {...stroke} />
              </>
            ) : (
              <>
                <Circle cx={8} cy={12} r={3.5} {...stroke} />
                <Path d="M11.5 12H20.5M17.5 12v3M20.5 12v3" {...stroke} />
              </>
            )}
          </Svg>
          <Text style={[typeScale.bodyStrong, styles.pillLabel, { color: colors.textMuted }]}>{label}</Text>
        </Pressable>
      </NavGlass>
    </Animated.View>
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
      // 편지지 — 봉투에서 반쯤 꺼낸 줄 친 편지지(2026-10-05 시안 B, 우표 대신).
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6.5 12.5V3.5h11v9" {...stroke} />
          <Path d="M9.5 7h5M9.5 9.75h3" {...stroke} />
          <Path d="M3.5 11v9.5h17V11" {...stroke} />
          <Path d="m3.5 11 8.5 6 8.5-6" {...stroke} />
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
    zIndex: 22,
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
  // 연필·＋ 를 한자리에 겹쳐 두고 불투명도로 바꾼다.
  dockIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // 메뉴 덮개 — 화면 내용보다 위, 바(20)·단추·메뉴(22)보다 아래. 바는 가라앉지 않고 ×·알약과 같은 유리색으로 남는다.
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 },
  // 메뉴 층 — 바와 같은 상자 폭, 알약은 오른쪽(단추 위)에 붙는다. 상자가 알약을 감싸야 안드로이드에서도 눌린다.
  menuLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 22,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  pillShadow: {
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 14,
  },
  pill: { height: 52, borderRadius: 26, borderWidth: hairline, overflow: 'hidden' },
  pillPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg + spacing.xs,
  },
  pillLabel: { fontSize: 15 },
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
