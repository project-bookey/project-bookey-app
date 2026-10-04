import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { NAV_BAR_HEIGHT } from '@/components/collage';
import { showSection, useSectionPager } from '@/components/pager/sectionPager';
import { Button } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { APP_TOUR_STEPS, type TourStep, useAppTour } from '@/store/appTour';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { measureTourTarget, measureView, type TourRect } from './TourTarget';
import { useTourBackHandler } from './useTourBackHandler';

/** 내용 구멍이 대상 바깥으로 넓어지는 만큼. */
const HOLE_PAD = 6;
/** 하단 탭 아이콘 구멍의 반지름 — 활성 표식(44pt 원)을 넉넉히 감싼다. */
const NAV_HOLE_RADIUS = 26;
/** 구멍이 화면 가장자리에서 띄우는 최소 거리 — 테두리가 화면 끝에 붙어 잘려 보이지 않게. */
const EDGE = spacing.xs;
/** 내용 구멍 테두리 두께. */
const RING = 2;
/** 구역을 넘기라고 다시 부르는 간격, 끝내 못 넘기면 구멍 없이 카드만 띄우기까지의 시간(ms). */
const SWITCH_RETRY_MS = 300;
const SWITCH_BUDGET_MS = 2000;
/** 구역이 맞은 뒤 재는 시점(ms) — 그림이 늦게 앉거나 데이터가 와서 밀리는 경우를 따라간다. */
const MEASURE_AT_MS = [60, 350, 1000];
/** 페이지 영역에 이만큼도 안 보이면(스크롤로 밀려났으면) 그 구멍은 뺀다. */
const MIN_VISIBLE = 0.5;

type Size = { width: number; height: number };
type Hole =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

/**
 * 앱 둘러보기 — 메인 탭 위에 짙은 막을 깔고, 단계마다 그 구역의 하단 탭 아이콘과 화면 속 핵심 요소만 뚫어 비춘다.
 * 설명 카드는 늘 하단 탭 바로 위에 붙어 있어 '다음'을 같은 자리에서 연달아 누를 수 있다(한 손 조작, UX 철칙 Fitts).
 *
 * - 메인 탭 화면이 포커스돼 있을 때만 보인다. 설정·상세 화면이 위에 오면 끌고 오지 않고 멈췄다가, 돌아오면 이어서 보인다.
 * - 구역 이동은 URL 이 아니라 sectionPager 로 pager 를 넘긴다 — 메인 탭 URL 은 보이는 구역을 따라가지 않는다.
 * - 떠 있는 동안 뒤 화면은 눌리지도 밀리지도 않는다(구멍 포함) — 강조된 버튼을 눌러 둘러보기가 어긋나지 않게.
 */
export function AppTourOverlay() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useAuth((s) => s.user?.id);
  const status = useAuth((s) => s.status);
  const { active, step, checked, next, prev, stop, reset, startIfFirstLogin, markSeen } = useAppTour();
  const shown = useSectionPager((s) => s.shown);
  const item = APP_TOUR_STEPS[step];
  const visible = active && shown !== null;
  const onSection = shown === item.section;

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<Size | null>(null);
  /** null 이면 아직 재는 중 — 막만 깔고 카드는 띄우지 않는다. */
  const [holes, setHoles] = useState<Hole[] | null>(null);
  const [switchTimedOut, setSwitchTimedOut] = useState(false);

  // 로그아웃·계정 전환 때 진행 중이던 둘러보기를 거둔다 — 다음 계정이 이전 단계를 이어받지 않게.
  const lastUser = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const current = status === 'authenticated' ? userId ?? null : null;
    if (current === lastUser.current) return;
    lastUser.current = current;
    reset();
  }, [status, userId, reset]);

  // 처음 들어온 사용자 — 메인 탭이 포커스되면(로그인·가입·프로필 단계를 다 지나 앱에 들어오면) 시작한다.
  useEffect(() => {
    if (status !== 'authenticated' || userId == null || shown === null || checked) return;
    void startIfFirstLogin(userId);
  }, [status, userId, shown, checked, startIfFirstLogin]);

  // 키보드가 떠 있으면 하단 탭이 숨어 비출 수 없다 — 둘러보기가 뜨면 내린다.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  // 단계가 바뀌면 이전 구멍만 거두고 카드는 남긴다 — '다음'을 누를 때마다 카드가 깜빡이지 않게.
  // 새로 보이기 시작할 때(시작·멈췄다 돌아옴)는 잴 때까지 카드를 숨긴다.
  useEffect(() => {
    setSwitchTimedOut(false);
    setHoles((current) => (visible && current !== null ? [] : null));
  }, [step, visible]);

  // 이 단계의 구역으로 pager 를 넘긴다. 이벤트를 놓칠 수 있어 맞을 때까지 다시 부른다.
  useEffect(() => {
    if (!visible || onSection) return undefined;
    showSection(item.section);
    const retry = setInterval(() => showSection(item.section), SWITCH_RETRY_MS);
    const giveUp = setTimeout(() => setSwitchTimedOut(true), SWITCH_BUDGET_MS);
    return () => {
      clearInterval(retry);
      clearTimeout(giveUp);
    };
  }, [visible, onSection, item.section]);

  // 구역이 맞은 뒤에만 잰다 — 네이티브는 숨은 페이지도 화면 안 좌표로 재므로 좌표만으로는 가릴 수 없다.
  useEffect(() => {
    if (!visible || !size) return undefined;
    if (!onSection) {
      // 끝내 못 넘기면 구멍 없이 카드만 띄운다 — 보이지 않는 채로 켜져 있는 일이 없게.
      if (switchTimedOut) setHoles([]);
      return undefined;
    }
    let cancelled = false;
    const timers = MEASURE_AT_MS.map((ms) => setTimeout(() => {
      void measureHoles(item, size, rootRef.current).then((measured) => {
        if (!cancelled) setHoles(measured);
      });
    }, ms));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [visible, size, onSection, switchTimedOut, item]);

  // 스크린 리더 — 단계마다 한 번 카드 내용을 읽어 준다(웹에서는 아무것도 하지 않는다).
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (!visible) {
      announced.current = null;
      return;
    }
    if (holes === null || announced.current === step) return;
    announced.current = step;
    AccessibilityInfo.announceForAccessibility(
      `${APP_TOUR_STEPS.length}단계 중 ${step + 1}단계, ${item.title}. ${item.body}`,
    );
  }, [visible, holes, step, item]);

  // 마치기·건너뛰기 모두 다시 띄우지 않게 남기고 홈으로 돌아온다 — 책을 찾는 자리에서 앱을 시작하게.
  const close = () => {
    if (userId != null) markSeen(userId);
    showSection('home');
    stop();
  };
  const goNext = () => {
    if (step === APP_TOUR_STEPS.length - 1) close();
    else next();
  };
  useTourBackHandler(visible, () => {
    if (step > 0) prev();
    else close();
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  if (!visible) return null;

  const drawn = holes ?? [];
  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={onLayout}
      // 구멍까지 포함해 모든 터치·스와이프를 여기서 받는다 — 뒤 화면(pager 밀기·하단 탭 끌기 포함)이 반응하지 않게.
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      accessibilityViewIsModal
      aria-modal
    >
      {/* 루트에는 투명도 애니메이션을 걸지 않는다 — iOS 는 거의 투명한 뷰의 터치를 무시해 그사이 뒤 화면이 눌린다. */}
      <View
        style={styles.scrim}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {size ? (
          <Svg width={size.width} height={size.height}>
            <Path d={scrimPath(size, drawn)} fill={colors.scrimFocus} fillRule="evenodd" />
            {drawn.map((hole, index) => (hole.kind === 'rect' ? (
              <Rect
                key={index}
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={radius.md}
                ry={radius.md}
                fill="none"
                stroke={colors.ink}
                strokeWidth={RING}
              />
            ) : null))}
          </Svg>
        ) : null}
      </View>

      {holes ? (
        <View style={[styles.dock, { bottom: Math.max(insets.bottom, spacing.md) + NAV_BAR_HEIGHT + spacing.md }]}>
          <View style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.lineStrong }]}>
            <Text
              style={[typeScale.monoEyebrow, { color: colors.textMuted }]}
              accessibilityLabel={`${APP_TOUR_STEPS.length}단계 중 ${step + 1}단계`}
            >
              {step + 1} / {APP_TOUR_STEPS.length}
            </Text>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{item.title}</Text>
            {/* 한글은 어절 단위로 꺾는다(도서 상세 제목과 같은 방식) — '재/요.'처럼 끝 글자만 떨어지지 않게. */}
            <Text
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="balanced"
              style={[typeScale.body, { color: colors.textMuted }]}
            >
              {item.body}
            </Text>
            <View style={styles.actions}>
              {/* 건너뛰기는 왼쪽 끝 — 이전·다음 짝과 떨어뜨려 실수로 둘러보기를 끝내지 않게. */}
              <Button label="건너뛰기" variant="ghost" onPress={close} style={styles.skip} />
              {step > 0 ? <Button label="이전" variant="outline" onPress={prev} style={styles.pair} /> : null}
              <Button
                label={step === APP_TOUR_STEPS.length - 1 ? '마치기' : '다음'}
                onPress={goNext}
                style={styles.pair}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** 이 단계에서 뚫을 구멍들 — 화면 속 핵심 요소(사각형)와 하단 탭 아이콘(원). 못 찾은 것은 빠진다. */
async function measureHoles(item: TourStep, size: Size, root: View | null): Promise<Hole[]> {
  // 오버레이 자신의 창 기준 원점을 빼서 좌표를 맞춘다 — 플랫폼마다 다를 수 있는 기준(상태 표시줄 등)을 상쇄한다.
  const origin = root ? await measureView(root) : null;
  const toLocal = (rect: TourRect | null): TourRect | null => (
    rect && { ...rect, x: rect.x - (origin?.x ?? 0), y: rect.y - (origin?.y ?? 0) }
  );
  const holes: Hole[] = [];

  let target = toLocal(await measureTourTarget(item.target));
  if (target && !item.inHeader) {
    const pages = toLocal(await measureTourTarget('section-pages'));
    if (pages) target = visiblePart(target, pages);
  }
  if (target) holes.push(rectHole(target, size));

  if (item.nav) {
    const tab = toLocal(await measureTourTarget(`nav-${item.section}`));
    if (tab) holes.push({ kind: 'circle', cx: tab.x + tab.width / 2, cy: tab.y + tab.height / 2, r: NAV_HOLE_RADIUS });
  }
  return holes;
}

/** 페이지 영역 안에 보이는 부분만 — 절반도 안 보이면(스크롤로 밀려나 헤더 밑에 있으면) 뺀다. */
function visiblePart(rect: TourRect, area: TourRect): TourRect | null {
  const x = Math.max(rect.x, area.x);
  const y = Math.max(rect.y, area.y);
  const right = Math.min(rect.x + rect.width, area.x + area.width);
  const bottom = Math.min(rect.y + rect.height, area.y + area.height);
  if (right <= x || bottom <= y) return null;
  const visibleShare = ((right - x) * (bottom - y)) / (rect.width * rect.height);
  return visibleShare < MIN_VISIBLE ? null : { x, y, width: right - x, height: bottom - y };
}

/** 대상보다 조금 넓힌 구멍 — 화면 가장자리에서는 EDGE 만큼 안쪽에서 멈춘다. */
function rectHole(rect: TourRect, size: Size): Hole {
  const x = Math.max(EDGE, rect.x - HOLE_PAD);
  const y = Math.max(EDGE, rect.y - HOLE_PAD);
  const right = Math.min(size.width - EDGE, rect.x + rect.width + HOLE_PAD);
  const bottom = Math.min(size.height - EDGE, rect.y + rect.height + HOLE_PAD);
  return { kind: 'rect', x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** 화면 전체를 덮는 막에 구멍을 뚫은 경로 — evenodd 라 겹친 부분(구멍)이 비워진다. */
function scrimPath(size: Size, holes: Hole[]): string {
  let d = `M0 0H${size.width}V${size.height}H0Z`;
  for (const hole of holes) {
    d += hole.kind === 'circle'
      ? circlePath(hole.cx, hole.cy, hole.r)
      : roundRectPath(hole.x, hole.y, hole.width, hole.height, radius.md);
  }
  return d;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}

function roundRectPath(x: number, y: number, width: number, height: number, r: number): string {
  const right = x + width;
  const bottom = y + height;
  return `M${x + r} ${y}H${right - r}A${r} ${r} 0 0 1 ${right} ${y + r}V${bottom - r}`
    + `A${r} ${r} 0 0 1 ${right - r} ${bottom}H${x + r}A${r} ${r} 0 0 1 ${x} ${bottom - r}V${y + r}`
    + `A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

const styles = StyleSheet.create({
  // 루트 레이아웃에서 Stack 다음에 그려져 이미 위에 있다 — zIndex 는 형제 사이 순서만 못 박는다.
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  // 카드는 하단 탭 바로 위 — 화면마다 높이가 달라도 '다음'이 늘 같은 자리에 있다.
  dock: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.lg, pointerEvents: 'box-none' },
  card: { ...layout.content, borderWidth: hairline, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  skip: { marginRight: 'auto' },
  pair: { minWidth: 72 },
});
