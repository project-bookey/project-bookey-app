import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type ComposedGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { pageHeightFor, scaleFor } from './NoteCanvas';
import { ToolIcon } from './NoteIcons';
import { canvasFor, type NoteKind } from './noteDoc';
import type { Point } from './noteGeometry';

/** 줌 범위 — 1 은 페이지가 뷰포트에 꼭 맞는 상태(맞춤). */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** −/+ 버튼 한 번의 배율. */
const ZOOM_STEP = 1.5;
/** 핀치를 이 아래로 놓으면 맞춤으로 붙인다. */
const SNAP_TO_FIT = 1.05;

const clampZoom = (z: number) => {
  'worklet';
  return z < ZOOM_MIN ? ZOOM_MIN : z > ZOOM_MAX ? ZOOM_MAX : z;
};
/** 종이가 뷰포트 밖으로 나가지 않게 — 오프셋은 [view - view·z, 0]. */
const clampOffset = (t: number, view: number, z: number) => {
  'worklet';
  const min = view - view * z;
  return t < min ? min : t > 0 ? 0 : t;
};

type ZoomView = { z: number; x: number; y: number };

/**
 * 대형노트 줌 상태 — useNoteZoom 이 만들고 ZoomStage 에 넘긴다. 격자·줄노트면 enabled 가 거짓이고 늘 맞춤(1)이다.
 */
export type NoteZoom = {
  /** 줌을 쓰는 노트인지(대형노트). 아니면 ZoomStage 는 그대로 통과시킨다. */
  enabled: boolean;
  kind: NoteKind;
  /** 맞춤 상태의 페이지 크기(px) = 뷰포트 크기. */
  baseWidth: number;
  baseHeight: number;
  /** 확정된 배율(1..4). 핀치 중엔 바뀌지 않고 손을 뗄 때 확정된다. */
  zoom: number;
  isZoomed: boolean;
  /** 캔버스를 그릴 폭(px) = baseWidth × zoom. 자식에게 이 폭을 준다. */
  canvasWidth: number;
  /** 캔버스 배율 = scaleFor(canvasWidth, kind) — 잉크·선택 제스처가 쓰는 값. */
  scale: number;
  /** 배율을 바꾼다. focal(뷰포트 px)을 중심으로 — 생략하면 뷰포트 가운데. */
  setZoom: (zoom: number, focal?: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 맞춤(1)으로. 페이지를 넘길 때 부른다. */
  fit: () => void;
  /** 뷰포트 가운데의 논리 좌표 — 삽입 기준점(useNoteInserts·useNotePhotos 의 getAnchor)으로 쓴다. 확대 전이면 null(캔버스 가운데). */
  visibleCenter: () => Point | null;
  /** 손 도구로 종이를 끄는 팬(확대 중·panEnabled 일 때만 켜진다). ZoomStage 가 이미 붙인다 — 관계를 맺을 때만 참조. */
  panGesture: PanGesture;
  /** ZoomStage 가 뷰포트에 붙이는 제스처(핀치 + 팬). */
  gesture: ComposedGesture;
  /** @internal ZoomStage 전용. */
  internal: {
    tx: SharedValue<number>;
    ty: SharedValue<number>;
    live: SharedValue<number>;
    committed: SharedValue<number>;
  };
};

/**
 * 대형노트 줌 — 캔버스를 `폭×줌` 으로 다시 그리고, 잘린 뷰포트 안에서 translate 로 옮긴다.
 * 자식은 늘 제 폭(canvasWidth)대로 그려지므로 자식 제스처의 좌표(e.x·e.y)는 그대로 캔버스 로컬이고 scale 도 맞다.
 * 핀치 중에는 다시 그리지 않고 UI 스레드에서 scale 변환만 얹었다가, 손을 떼면 배율을 확정해 한 번 다시 그린다.
 * 팬(종이 끌기)은 panEnabled(보통 손 도구)이고 확대 중일 때만 켜진다 — 그땐 화면이 페이지 넘김을 꺼야 한다.
 */
export function useNoteZoom({ kind, baseWidth, panEnabled = false }: {
  kind: NoteKind;
  /** 맞춤 상태의 페이지 폭(px). */
  baseWidth: number;
  /** 손 도구일 때 참 — 확대 중이면 드래그가 종이를 끈다. */
  panEnabled?: boolean;
}): NoteZoom {
  const enabled = kind === 'large' && baseWidth > 0;
  const baseHeight = pageHeightFor(baseWidth, kind);
  const [zoom, setZoomState] = useState(ZOOM_MIN);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** 핀치 중 임시 배율(확정 배율 대비). 평소엔 1. */
  const live = useSharedValue(1);
  /** 확정 배율의 UI 스레드 사본. */
  const committed = useSharedValue(ZOOM_MIN);
  const pinchStart = useSharedValue({ z: 1, x: 0, y: 0, fx: 0, fy: 0 });

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** 확정했지만 아직 다시 그리기 전인 상태 — 다시 그린 직후(layout effect) 오프셋을 얹는다. */
  const pendingRef = useRef<ZoomView | null>(null);

  const current = useCallback((): ZoomView => pendingRef.current ?? { z: zoomRef.current, x: tx.value, y: ty.value }, [tx, ty]);

  const commit = useCallback((view: ZoomView) => {
    if (view.z === zoomRef.current) {
      pendingRef.current = null;
      tx.value = view.x;
      ty.value = view.y;
      live.value = 1;
      return;
    }
    pendingRef.current = view;
    setZoomState(view.z);
  }, [tx, ty, live]);

  useLayoutEffect(() => {
    const view = pendingRef.current;
    pendingRef.current = null;
    if (view) {
      tx.value = view.x;
      ty.value = view.y;
    }
    live.value = 1;
    committed.value = zoom;
  }, [zoom, tx, ty, live, committed]);

  // 종류·뷰포트 크기가 바뀌면(회전·창 크기) 맞춤으로 돌아간다.
  useEffect(() => {
    pendingRef.current = null;
    tx.value = 0;
    ty.value = 0;
    live.value = 1;
    setZoomState(ZOOM_MIN);
  }, [kind, baseWidth, tx, ty, live]);

  const setZoom = useCallback((next: number, focal?: { x: number; y: number }) => {
    if (!enabled) return;
    const cur = current();
    let z = clampZoom(next);
    if (z < SNAP_TO_FIT) z = ZOOM_MIN;
    const f = focal ?? { x: baseWidth / 2, y: baseHeight / 2 };
    // 초점 아래의 종이 점(맞춤 px)이 줌 뒤에도 초점 아래 남도록.
    const px = (f.x - cur.x) / cur.z;
    const py = (f.y - cur.y) / cur.z;
    commit({ z, x: clampOffset(f.x - px * z, baseWidth, z), y: clampOffset(f.y - py * z, baseHeight, z) });
  }, [enabled, baseWidth, baseHeight, current, commit]);

  const zoomIn = useCallback(() => setZoom(current().z * ZOOM_STEP), [setZoom, current]);
  const zoomOut = useCallback(() => setZoom(current().z / ZOOM_STEP), [setZoom, current]);
  const fit = useCallback(() => commit({ z: ZOOM_MIN, x: 0, y: 0 }), [commit]);

  const visibleCenter = useCallback((): Point | null => {
    if (!enabled) return null;
    const cur = current();
    if (cur.z <= ZOOM_MIN) return null;
    const fitScale = baseWidth / canvasFor(kind).w;
    return [(baseWidth / 2 - cur.x) / cur.z / fitScale, (baseHeight / 2 - cur.y) / cur.z / fitScale];
  }, [enabled, current, baseWidth, baseHeight, kind]);

  const commitPinch = useCallback((z: number, x: number, y: number) => {
    if (z < SNAP_TO_FIT) commit({ z: ZOOM_MIN, x: 0, y: 0 });
    else commit({ z, x, y });
  }, [commit]);

  const panOn = enabled && panEnabled && zoom > ZOOM_MIN;
  const { panGesture, gesture } = useMemo(() => {
    const bw = baseWidth;
    const bh = baseHeight;
    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart((e) => {
        pinchStart.value = { z: committed.value, x: tx.value, y: ty.value, fx: e.focalX, fy: e.focalY };
      })
      .onUpdate((e) => {
        const s = pinchStart.value;
        const z = clampZoom(s.z * e.scale);
        const px = (s.fx - s.x) / s.z;
        const py = (s.fy - s.y) / s.z;
        tx.value = clampOffset(e.focalX - px * z, bw, z);
        ty.value = clampOffset(e.focalY - py * z, bh, z);
        live.value = z / s.z;
      })
      .onFinalize(() => {
        if (live.value === 1) return;
        runOnJS(commitPinch)(committed.value * live.value, tx.value, ty.value);
      });
    const pan = Gesture.Pan()
      .enabled(panOn)
      .minDistance(2)
      .maxPointers(1)
      .activeCursor('grabbing')
      .onChange((e) => {
        const z = committed.value;
        tx.value = clampOffset(tx.value + e.changeX, bw, z);
        ty.value = clampOffset(ty.value + e.changeY, bh, z);
      });
    return { panGesture: pan, gesture: Gesture.Simultaneous(pinch, pan) };
  }, [enabled, panOn, baseWidth, baseHeight, pinchStart, committed, tx, ty, live, commitPinch]);

  const effectiveZoom = enabled ? zoom : ZOOM_MIN;
  const canvasWidth = baseWidth * effectiveZoom;
  return {
    enabled,
    kind,
    baseWidth,
    baseHeight,
    zoom: effectiveZoom,
    isZoomed: effectiveZoom > ZOOM_MIN,
    canvasWidth,
    scale: scaleFor(Math.max(canvasWidth, 1), kind),
    setZoom,
    zoomIn,
    zoomOut,
    fit,
    visibleCenter,
    panGesture,
    gesture,
    internal: { tx, ty, live, committed },
  };
}

/** 웹 wheel 이벤트에서 쓰는 만큼만 — DOM 타입에 기대지 않는다. */
type WheelLike = {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};
type WheelTarget = {
  addEventListener: (type: 'wheel', handler: (e: WheelLike) => void, options?: { passive: boolean }) => void;
  removeEventListener: (type: 'wheel', handler: (e: WheelLike) => void) => void;
  getBoundingClientRect: () => { left: number; top: number };
};
const isWheelTarget = (v: unknown): v is WheelTarget =>
  typeof v === 'object' && v !== null && typeof (v as { addEventListener?: unknown }).addEventListener === 'function';

/**
 * 줌 무대 — 대형노트면 뷰포트(맞춤 크기)를 잘라 두고 그 안에 캔버스를 `폭×줌` 으로 그려 옮긴다.
 * 격자·줄노트면 아무것도 하지 않고 children(baseWidth) 를 그대로 그린다.
 * 웹: ctrl(⌘)+휠(트랙패드 핀치)로 줌, 확대 중 그냥 휠은 종이를 끈다. 터치 핀치는 네이티브·모바일 웹에서.
 */
export function ZoomStage({ zoom, children, controls = true, style }: {
  zoom: NoteZoom;
  /** 캔버스 폭(px)을 받아 페이지를 그린다 — 보통 NoteCanvas width={w}. */
  children: (width: number) => ReactNode;
  /** 오른쪽 아래에 − 맞춤 + 버튼을 띄울지. 크롬에 따로 두려면 끄고 ZoomControls 를 쓴다. */
  controls?: boolean;
  style?: ViewStyle;
}) {
  const { enabled, baseWidth, baseHeight, canvasWidth } = zoom;
  const { tx, ty, live, committed } = zoom.internal;
  const viewportRef = useRef<View>(null);
  const latest = useRef(zoom);
  latest.current = zoom;

  const animated = useAnimatedStyle(() => {
    // RN 은 박스 가운데를 축으로 scale 한다 — 좌상단 기준으로 보이게 가운데 몫을 빼 준다.
    const s = live.value;
    const cx = (baseWidth * committed.value) / 2;
    const cy = (baseHeight * committed.value) / 2;
    return {
      transform: [
        { translateX: tx.value - cx * (1 - s) },
        { translateY: ty.value - cy * (1 - s) },
        { scale: s },
      ],
    };
  }, [baseWidth, baseHeight]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const node: unknown = viewportRef.current;
    if (!isWheelTarget(node)) return;
    const onWheel = (e: WheelLike) => {
      const z = latest.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = node.getBoundingClientRect();
        z.setZoom(z.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
      if (!z.isZoomed) return;
      e.preventDefault();
      const c = committed.value;
      tx.value = clampOffset(tx.value - e.deltaX, baseWidth, c);
      ty.value = clampOffset(ty.value - e.deltaY, baseHeight, c);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [enabled, baseWidth, baseHeight, tx, ty, committed]);

  if (!enabled) return <View style={style}>{baseWidth > 0 ? children(baseWidth) : null}</View>;

  return (
    <View style={[{ width: baseWidth, height: baseHeight }, style]}>
      <GestureDetector gesture={zoom.gesture}>
        <View ref={viewportRef} collapsable={false} style={[styles.viewport, { width: baseWidth, height: baseHeight }]}>
          <Animated.View style={[styles.content, { width: canvasWidth, height: baseHeight * zoom.zoom }, animated]}>
            {children(canvasWidth)}
          </Animated.View>
        </View>
      </GestureDetector>
      {controls ? <ZoomControls zoom={zoom} style={styles.controls} /> : null}
    </View>
  );
}

/** − 맞춤 + — 대형노트 줌 버튼 묶음. 격자·줄노트면 그리지 않는다. */
export function ZoomControls({ zoom, style }: { zoom: NoteZoom; style?: ViewStyle }) {
  const { colors } = useTheme();
  if (!zoom.enabled) return null;
  const atMin = zoom.zoom <= ZOOM_MIN;
  const atMax = zoom.zoom >= ZOOM_MAX;
  const box = { backgroundColor: colors.surface, borderColor: colors.line };
  return (
    <View style={[styles.cluster, style]}>
      <Pressable
        onPress={zoom.zoomOut}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="축소"
        accessibilityState={{ disabled: atMin }}
        style={({ pressed }) => [styles.btn, box, atMin ? styles.disabled : null, pressed && !atMin ? pressedStyle : null]}
      >
        <ToolIcon icon={Minus} size={16} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={zoom.fit}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="화면에 맞춤"
        accessibilityState={{ disabled: atMin }}
        style={({ pressed }) => [styles.btn, styles.fitBtn, box, atMin ? styles.disabled : null, pressed && !atMin ? pressedStyle : null]}
      >
        <Text style={[typeScale.monoLabel, { color: colors.text }]}>맞춤</Text>
      </Pressable>
      <Pressable
        onPress={zoom.zoomIn}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="확대"
        accessibilityState={{ disabled: atMax }}
        style={({ pressed }) => [styles.btn, box, atMax ? styles.disabled : null, pressed && !atMax ? pressedStyle : null]}
      >
        <ToolIcon icon={Plus} size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  content: { position: 'absolute', left: 0, top: 0 },
  controls: { position: 'absolute', right: spacing.sm, bottom: spacing.sm },
  cluster: { flexDirection: 'row', gap: spacing.xs },
  btn: {
    height: 32,
    minWidth: 32,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitBtn: { paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.35 },
});
