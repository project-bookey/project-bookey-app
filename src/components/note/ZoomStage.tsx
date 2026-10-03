import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type ComposedGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { ToolIcon } from './NoteIcons';
import { CANVAS, canvasFor, type CanvasSize, type CanvasWindow, type NoteKind, type NoteRect } from './noteDoc';
import type { Point } from './noteGeometry';

/** 최대 배율 — 작업 배율(100%)의 네 배. */
export const ZOOM_MAX = 4;
/** −/+ 버튼 한 번의 배율. */
const ZOOM_STEP = 1.5;
/** 맞춤·100% 에 이만큼(비율) 가까이 놓으면 그 배율로 붙인다. */
const SNAP = 0.05;
/** 종이가 뷰포트보다 클 때 가장자리 너머로 더 끌 수 있는 여유(px) — 종이 끝이 화면 끝에 딱 붙지 않게. */
const PAN_PAD = spacing.lg;
/** SVG 층을 그릴 창의 여유 — 보이는 구역 둘레로 뷰포트의 이만큼(비율)씩 더 그려 둔다. */
const WINDOW_MARGIN = 0.5;

/**
 * 한 축의 오프셋 — 종이(+여유)가 뷰포트보다 작으면 가운데(start 면 여유만큼 띄운 위쪽), 크면 [view - content - pad, pad] 안.
 * 두 경우가 content + 2·pad = view 에서 이어진다(핀치 중 튀지 않는다).
 */
const clampAxis = (t: number, view: number, content: number, start = false) => {
  'worklet';
  if (content + PAN_PAD * 2 <= view) return start ? PAN_PAD : (view - content) / 2;
  const min = view - content - PAN_PAD;
  return t < min ? min : t > PAN_PAD ? PAN_PAD : t;
};

/** 여백·상한을 뺀 자리에 캔버스를 통째로 넣는 배율. */
function fitScaleOf(canvas: CanvasSize, view: { w: number; h: number }, inset: { x: number; y: number }, maxWidth?: number) {
  const w = Math.max(view.w - inset.x * 2, 1);
  const h = Math.max(view.h - inset.y * 2, 1);
  const s = Math.min(w / canvas.w, h / canvas.h);
  return maxWidth ? Math.min(s, maxWidth / canvas.w) : s;
}

type ZoomView = { s: number; x: number; y: number };

/** 줌 무대의 '처음 모습' — 맞춤(종이 전체) · 한 점을 가운데 둔 100% · 한 구역이 들어오게. */
export type ZoomHome = { fit: true } | { center: Point } | { rect: NoteRect };

/**
 * 노트 줌 상태 — useNoteZoom 이 만들고 ZoomStage 에 넘긴다. 격자·줄·대형노트 모두 쓴다.
 * 배율(scale)은 px/논리 단위다. 맞춤(fitScale) = 종이 전체가 보이는 배율 = 최소, 작업(workScale, '100%') = 격자노트
 * 한 쪽이 화면 페이지에 꼭 맞는 배율, 최대 = 작업 × ZOOM_MAX. 격자·줄노트는 맞춤 = 100% 이고,
 * 대형노트는 종이가 훨씬 넓어 100% 에선 종이의 일부만 보이고 맞춤으로 줄이면 전체가 보인다.
 */
export type NoteZoom = {
  /** 뷰포트 크기를 알아서 그릴 수 있는지. */
  enabled: boolean;
  kind: NoteKind;
  viewport: { w: number; h: number };
  /** 종이가 낮으면 위쪽에 붙이는지(useNoteZoom 의 alignTop). */
  alignTop: boolean;
  /** 확정된 배율(px/논리 단위). 핀치 중엔 바뀌지 않고 손을 뗄 때 확정된다. */
  scale: number;
  fitScale: number;
  workScale: number;
  maxScale: number;
  /** 맞춤 배율의 페이지 폭(px) — 지금 페이지가 아닌 이웃 페이지 미리보기를 이 폭으로 그린다. */
  fitWidth: number;
  /** 작업 배율 대비 퍼센트(정수). */
  percent: number;
  /** 종이가 맞춤보다 크게 보이는지 — 참이면 끌어서 보고, 화면은 페이지 스와이프를 끈다. */
  isZoomed: boolean;
  atFit: boolean;
  atWork: boolean;
  atMax: boolean;
  /** 캔버스를 그릴 폭(px) = 논리 폭 × scale. 자식에게 이 폭을 준다. */
  canvasWidth: number;
  /** SVG 층을 그릴 창(캔버스 px) — 보이는 구역 + 여유. */
  window: CanvasWindow;
  /** 배율을 바꾼다. focal(뷰포트 px)을 중심으로 — 생략하면 뷰포트 가운데. */
  setScale: (scale: number, focal?: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 종이 전체가 보이게(맞춤). */
  fit: () => void;
  /** 지금 보는 곳을 가운데 둔 채 100% 로. */
  toWork: () => void;
  /** 처음 모습(home)으로 — 페이지를 넘길 때 부른다. */
  goHome: () => void;
  /** 뷰포트 가운데의 논리 좌표(캔버스 안으로 잘라서) — 삽입 기준점(useNoteInserts·useNotePhotos 의 getAnchor)으로 쓴다. */
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
    refreshWindow: () => void;
  };
};

/**
 * 노트 줌 — 캔버스를 `논리 폭 × 배율` 로 다시 그리고, 잘린 뷰포트 안에서 translate 로 옮긴다.
 * 자식은 늘 제 폭(canvasWidth)대로 그려지므로 자식 제스처의 좌표(e.x·e.y)는 그대로 캔버스 로컬이고 scale 도 맞다.
 * 핀치 중에는 다시 그리지 않고 UI 스레드에서 scale 변환만 얹었다가, 손을 떼면 배율을 확정해 한 번 다시 그린다.
 * 팬(종이 끌기)은 panEnabled(보통 손 도구)이고 종이가 뷰포트보다 클 때만 켜진다 — 그땐 화면이 페이지 넘김을 꺼야 한다.
 * SVG 층은 보이는 구역 둘레만 그린다(window) — 끌다가 그 밖이 보이려 하면 창을 새로 잡는다.
 */
export function useNoteZoom({ kind, viewport, fitInset = { x: 0, y: 0 }, maxFitWidth, alignTop = false, panEnabled = false, home }: {
  kind: NoteKind;
  /** 뷰포트 크기(px). */
  viewport: { w: number; h: number };
  /** 맞춤 배율을 셀 때 뺄 여백(px) — 편집기는 종이 둘레에 책상이 조금 보이게 준다. */
  fitInset?: { x: number; y: number };
  /** 맞춤 페이지 폭 상한(px) — 넓은 화면에서 종이가 끝없이 커지지 않게. */
  maxFitWidth?: number;
  /** 종이가 뷰포트보다 낮을 때 세로 가운데 대신 위쪽(여유만큼 띄워)에 붙인다 — 키 큰 편집 화면에서 위아래가 비지 않게. */
  alignTop?: boolean;
  /** 손 도구일 때 참 — 확대 중이면 드래그가 종이를 끈다. */
  panEnabled?: boolean;
  /** 처음 모습 — 뷰포트가 정해질 때·goHome 때 부른다. 생략하면 맞춤. */
  home?: () => ZoomHome;
}): NoteZoom {
  const canvas = canvasFor(kind);
  const vw = viewport.w;
  const vh = viewport.h;
  const enabled = vw > 0 && vh > 0;
  const fitScale = enabled ? fitScaleOf(canvas, viewport, fitInset, maxFitWidth) : 1;
  // 100% = 격자노트 한 쪽이 같은 자리에 맞춤으로 들어가는 배율. 대형노트 맞춤이 그보다 클 일은 없지만 안전하게.
  const workScale = Math.max(enabled ? fitScaleOf(CANVAS, viewport, fitInset, maxFitWidth) : 1, fitScale);
  const maxScale = workScale * ZOOM_MAX;
  const cw = canvas.w;
  const ch = canvas.h;

  const [scaleState, setScaleState] = useState(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** 핀치 중 임시 배율(확정 배율 대비). 평소엔 1. */
  const live = useSharedValue(1);
  /** 확정 배율의 UI 스레드 사본. */
  const committed = useSharedValue(0);
  const pinchStart = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 });
  /** 지금 그려 둔 창(확정 배율 px) — 워크릿이 창 밖이 보이는지 잰다. */
  const win = useSharedValue({ x0: 0, y0: 0, x1: 0, y1: 0 });
  /** 창을 새로 잡아 달라고 JS 에 부탁해 둔 상태 — 부탁이 겹치지 않게. */
  const winAsked = useSharedValue(false);
  const [windowState, setWindowState] = useState<CanvasWindow>({ x: 0, y: 0, w: 0, h: 0 });

  // 확정 배율이 아직 없으면(첫 그리기 전) 맞춤으로 그린다 — 곧바로 layout effect 가 처음 모습을 얹는다.
  const scale = scaleState > 0 ? Math.min(Math.max(scaleState, fitScale), maxScale) : fitScale;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  /** 확정했지만 아직 다시 그리기 전인 상태 — 다시 그린 직후(layout effect) 오프셋을 얹는다. */
  const pendingRef = useRef<ZoomView | null>(null);
  const homeRef = useRef(home);
  homeRef.current = home;

  const clampScale = useCallback((s: number) => {
    let z = Math.min(Math.max(s, fitScale), maxScale);
    if (Math.abs(z - fitScale) <= fitScale * SNAP) z = fitScale;
    else if (Math.abs(z - workScale) <= workScale * SNAP) z = workScale;
    return z;
  }, [fitScale, workScale, maxScale]);

  const current = useCallback((): ZoomView => pendingRef.current ?? { s: scaleRef.current, x: tx.value, y: ty.value }, [tx, ty]);

  /** 보이는 구역 + 여유를 확정 배율 px 로 잡아 창으로 둔다. */
  const refreshWindow = useCallback(() => {
    winAsked.value = false;
    const s = scaleRef.current;
    const m = live.value || 1;
    const contentW = cw * s;
    const contentH = ch * s;
    const mx = (vw * WINDOW_MARGIN) / m;
    const my = (vh * WINDOW_MARGIN) / m;
    const x0 = Math.max(0, Math.floor(-tx.value / m - mx));
    const y0 = Math.max(0, Math.floor(-ty.value / m - my));
    const x1 = Math.min(contentW, Math.ceil((vw - tx.value) / m + mx));
    const y1 = Math.min(contentH, Math.ceil((vh - ty.value) / m + my));
    win.value = { x0, y0, x1, y1 };
    setWindowState((prev) => {
      const next = { x: x0, y: y0, w: Math.max(x1 - x0, 0), h: Math.max(y1 - y0, 0) };
      return prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next;
    });
  }, [cw, ch, vw, vh, tx, ty, live, win, winAsked]);

  const commit = useCallback((view: ZoomView) => {
    // 확정 배율이 그대로면 다시 그릴 것 없이 오프셋만. 아니면 다시 그린 뒤(layout effect) 얹는다.
    if (view.s === scaleState) {
      pendingRef.current = null;
      tx.value = view.x;
      ty.value = view.y;
      live.value = 1;
      refreshWindow();
      return;
    }
    pendingRef.current = view;
    setScaleState(view.s);
  }, [tx, ty, live, scaleState, refreshWindow]);

  useLayoutEffect(() => {
    const view = pendingRef.current;
    pendingRef.current = null;
    if (view) {
      tx.value = view.x;
      ty.value = view.y;
    }
    live.value = 1;
    committed.value = scale;
    refreshWindow();
    // scaleState 도 본다 — 첫 배치에서 맞춤(fitScale)을 확정하면 그린 배율은 그대로라 scale 만으론 안 불린다.
  }, [scaleState, scale, tx, ty, live, committed, refreshWindow]);

  /** 배율 s 에서 논리 점 (lx, ly) 를 뷰포트 px (fx, fy) 에 두는 모습. */
  const viewAt = useCallback((s: number, lx: number, ly: number, fx: number, fy: number): ZoomView => ({
    s,
    x: clampAxis(fx - lx * s, vw, cw * s),
    y: clampAxis(fy - ly * s, vh, ch * s, alignTop),
  }), [vw, vh, cw, ch, alignTop]);

  const fit = useCallback(() => commit(viewAt(fitScale, cw / 2, ch / 2, vw / 2, vh / 2)), [commit, viewAt, fitScale, cw, ch, vw, vh]);

  const goHome = useCallback(() => {
    if (!enabled) return;
    const h = homeRef.current?.() ?? { fit: true as const };
    if ('center' in h) {
      commit(viewAt(workScale, h.center[0], h.center[1], vw / 2, vh / 2));
    } else if ('rect' in h) {
      const r = h.rect;
      const s = Math.min(Math.max(Math.min(vw / r.w, vh / r.h), fitScale), workScale);
      commit(viewAt(s, r.x + r.w / 2, r.y + r.h / 2, vw / 2, vh / 2));
    } else {
      fit();
    }
  }, [enabled, commit, viewAt, workScale, fitScale, vw, vh, fit]);

  /** 처음 모습을 얹은 노트 종류 — 이 종류로 한 번 얹은 뒤엔 뷰포트 크기가 바뀌어도 보던 자리를 지킨다. */
  const homedKindRef = useRef<NoteKind | null>(null);
  /** 직전 맞춤 배율 — 크기가 바뀔 때 '맞춤 상태였는지' 가린다. */
  const prevFitRef = useRef(fitScale);

  // 첫 배치·종류가 바뀔 때는 처음 모습으로. 그 뒤 뷰포트 크기만 바뀌면(도구를 바꿔 펜 색 줄이 생기고 사라질 때,
  // 회전·창 크기) 보던 자리를 지킨다 — 뷰포트 왼쪽 위의 논리 점과 배율을 그대로 둔다(맞춤이었으면 새 맞춤으로).
  // 그리기 전에 얹어 한 번 튀지 않게 layout effect 로.
  useLayoutEffect(() => {
    const prevFit = prevFitRef.current;
    prevFitRef.current = fitScale;
    if (!enabled) return;
    if (homedKindRef.current !== kind) {
      homedKindRef.current = kind;
      goHome();
      return;
    }
    const cur = current();
    const wasFit = cur.s <= prevFit * (1 + 1e-3);
    const s = wasFit ? fitScale : Math.min(Math.max(cur.s, fitScale), maxScale);
    commit(viewAt(s, -cur.x / cur.s, -cur.y / cur.s, 0, 0));
    // 종류·크기가 바뀔 때만 — 콜백들은 크기가 바뀌면 새로 만들어지므로 deps 에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, vw, vh]);

  const setScale = useCallback((next: number, focal?: { x: number; y: number }) => {
    if (!enabled) return;
    const cur = current();
    const s = clampScale(next);
    const f = focal ?? { x: vw / 2, y: vh / 2 };
    // 초점 아래의 논리 점이 줌 뒤에도 초점 아래 남도록.
    commit(viewAt(s, (f.x - cur.x) / cur.s, (f.y - cur.y) / cur.s, f.x, f.y));
  }, [enabled, current, clampScale, vw, vh, commit, viewAt]);

  const zoomIn = useCallback(() => setScale(current().s * ZOOM_STEP), [setScale, current]);
  const zoomOut = useCallback(() => setScale(current().s / ZOOM_STEP), [setScale, current]);
  const toWork = useCallback(() => setScale(workScale), [setScale, workScale]);

  const visibleCenter = useCallback((): Point | null => {
    if (!enabled) return null;
    const cur = current();
    const x = (vw / 2 - cur.x) / cur.s;
    const y = (vh / 2 - cur.y) / cur.s;
    return [Math.min(Math.max(x, 0), cw), Math.min(Math.max(y, 0), ch)];
  }, [enabled, current, vw, vh, cw, ch]);

  const commitPinch = useCallback((s: number, x: number, y: number) => {
    const z = clampScale(s);
    if (z === s) {
      commit({ s, x, y });
      return;
    }
    // 맞춤·100% 로 붙였으면 핀치 초점(뷰포트 가운데로 어림) 둘레로 다시 잡는다.
    const cur = { s, x, y };
    commit(viewAt(z, (vw / 2 - cur.x) / cur.s, (vh / 2 - cur.y) / cur.s, vw / 2, vh / 2));
  }, [clampScale, commit, viewAt, vw, vh]);

  const isZoomed = scale > fitScale * (1 + 1e-3);
  const panOn = enabled && panEnabled && isZoomed;
  const { panGesture, gesture } = useMemo(() => {
    const minS = fitScale;
    const maxS = maxScale;
    const top = alignTop;
    /** 보이는 구역이 그려 둔 창을 벗어나면 JS 에 새 창을 부탁한다. */
    const checkWindow = () => {
      'worklet';
      if (winAsked.value) return;
      const s = committed.value;
      const m = live.value;
      const w = win.value;
      const x0 = Math.max(0, -tx.value / m);
      const y0 = Math.max(0, -ty.value / m);
      const x1 = Math.min(cw * s, (vw - tx.value) / m);
      const y1 = Math.min(ch * s, (vh - ty.value) / m);
      if (x0 < w.x0 || y0 < w.y0 || x1 > w.x1 || y1 > w.y1) {
        winAsked.value = true;
        runOnJS(refreshWindow)();
      }
    };
    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart((e) => {
        pinchStart.value = { s: committed.value, x: tx.value, y: ty.value, fx: e.focalX, fy: e.focalY };
      })
      .onUpdate((e) => {
        const p = pinchStart.value;
        const raw = p.s * e.scale;
        const s = raw < minS ? minS : raw > maxS ? maxS : raw;
        const lx = (p.fx - p.x) / p.s;
        const ly = (p.fy - p.y) / p.s;
        tx.value = clampAxis(e.focalX - lx * s, vw, cw * s);
        ty.value = clampAxis(e.focalY - ly * s, vh, ch * s, top);
        live.value = s / p.s;
        checkWindow();
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
        const s = committed.value;
        tx.value = clampAxis(tx.value + e.changeX, vw, cw * s);
        ty.value = clampAxis(ty.value + e.changeY, vh, ch * s, top);
        checkWindow();
      })
      .onEnd(() => {
        runOnJS(refreshWindow)();
      });
    return { panGesture: pan, gesture: Gesture.Simultaneous(pinch, pan) };
  }, [enabled, panOn, fitScale, maxScale, alignTop, vw, vh, cw, ch, pinchStart, committed, tx, ty, live, win, winAsked, commitPinch, refreshWindow]);

  return {
    enabled,
    kind,
    viewport,
    alignTop,
    scale,
    fitScale,
    workScale,
    maxScale,
    fitWidth: Math.floor(cw * fitScale),
    percent: Math.round((scale / workScale) * 100),
    isZoomed,
    atFit: !isZoomed,
    atWork: Math.abs(scale - workScale) <= workScale * 1e-3,
    atMax: scale >= maxScale * (1 - 1e-3),
    canvasWidth: cw * scale,
    window: windowState,
    setScale,
    zoomIn,
    zoomOut,
    fit,
    toWork,
    goHome,
    visibleCenter,
    panGesture,
    gesture,
    internal: { tx, ty, live, committed, refreshWindow },
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

/** 휠로 끈 뒤 창을 새로 잡기까지 기다리는 시간(ms). */
const WHEEL_SETTLE_MS = 120;

/**
 * 줌 무대 — 뷰포트를 잘라 두고 그 안에 캔버스를 `논리 폭 × 배율` 로 그려 옮긴다. 맞춤보다 작을 일은 없고,
 * 종이가 뷰포트보다 작은 축은 가운데에 선다.
 * 웹: ctrl(⌘)+휠(트랙패드 핀치)로 줌, 종이가 뷰포트보다 크면 그냥 휠은 종이를 끈다. 터치 핀치는 네이티브·모바일 웹에서.
 */
export function ZoomStage({ zoom, children, controls = true, style }: {
  zoom: NoteZoom;
  /** 캔버스 폭(px)과 그릴 창을 받아 페이지를 그린다 — 보통 NoteCanvas width={w} window={win}. */
  children: (width: number, window: CanvasWindow) => ReactNode;
  /** 오른쪽 아래에 줌 버튼을 띄울지. 크롬에 따로 두려면 끄고 ZoomControls 를 쓴다. */
  controls?: boolean;
  style?: ViewStyle;
}) {
  const { enabled, viewport, canvasWidth } = zoom;
  const canvas = canvasFor(zoom.kind);
  const canvasHeight = canvas.h * zoom.scale;
  const { tx, ty, live, committed, refreshWindow } = zoom.internal;
  const viewportRef = useRef<View>(null);
  const latest = useRef(zoom);
  latest.current = zoom;

  const animated = useAnimatedStyle(() => {
    // RN 은 박스 가운데를 축으로 scale 한다 — 좌상단 기준으로 보이게 가운데 몫을 빼 준다.
    const s = live.value;
    const cx = (canvas.w * committed.value) / 2;
    const cy = (canvas.h * committed.value) / 2;
    return {
      transform: [
        { translateX: tx.value - cx * (1 - s) },
        { translateY: ty.value - cy * (1 - s) },
        { scale: s },
      ],
    };
  }, [canvas.w, canvas.h]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const node: unknown = viewportRef.current;
    if (!isWheelTarget(node)) return;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelLike) => {
      const z = latest.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = node.getBoundingClientRect();
        z.setScale(z.scale * Math.exp(-e.deltaY * 0.01), { x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
      if (!z.isZoomed) return;
      e.preventDefault();
      const s = committed.value;
      tx.value = clampAxis(tx.value - e.deltaX, z.viewport.w, canvas.w * s);
      ty.value = clampAxis(ty.value - e.deltaY, z.viewport.h, canvas.h * s, z.alignTop);
      if (settle) clearTimeout(settle);
      settle = setTimeout(refreshWindow, WHEEL_SETTLE_MS);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      if (settle) clearTimeout(settle);
    };
  }, [enabled, canvas.w, canvas.h, tx, ty, committed, refreshWindow]);

  if (!enabled) return <View style={style} />;

  return (
    <View style={[{ width: viewport.w, height: viewport.h }, style]}>
      <GestureDetector gesture={zoom.gesture}>
        <View
          ref={viewportRef}
          collapsable={false}
          style={[styles.viewport, { width: viewport.w, height: viewport.h }]}
        >
          <Animated.View style={[styles.content, { width: canvasWidth, height: canvasHeight }, animated]}>
            {children(canvasWidth, zoom.window)}
          </Animated.View>
        </View>
      </GestureDetector>
      {controls ? <ZoomControls zoom={zoom} style={styles.controls} /> : null}
    </View>
  );
}

/**
 * 줌 버튼 묶음 — − · 지금 배율(누르면 100%) · + · 전체(누르면 종이 전체).
 * 격자·줄노트는 처음이 100% 이자 전체라 확대했을 때만 가운데 두 버튼이 살아난다.
 */
export function ZoomControls({ zoom, style }: { zoom: NoteZoom; style?: ViewStyle }) {
  const { colors } = useTheme();
  if (!zoom.enabled) return null;
  const box = { backgroundColor: colors.surface, borderColor: colors.line };
  const button = (key: string, label: string, onPress: () => void, disabled: boolean, content: ReactNode, wide = false) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn, wide ? styles.wideBtn : null, box, disabled ? styles.disabled : null, pressed && !disabled ? pressedStyle : null,
      ]}
    >
      {content}
    </Pressable>
  );
  const label = (text: string) => <Text style={[typeScale.monoLabel, { color: colors.text }]}>{text}</Text>;
  return (
    <View style={[styles.cluster, style]}>
      {button('out', '축소', zoom.zoomOut, zoom.atFit, <ToolIcon icon={Minus} size={16} color={colors.text} />)}
      {button('work', `지금 ${zoom.percent}% — 누르면 100%`, zoom.toWork, zoom.atWork, label(`${zoom.percent}%`), true)}
      {button('in', '확대', zoom.zoomIn, zoom.atMax, <ToolIcon icon={Plus} size={16} color={colors.text} />)}
      {button('fit', '종이 전체 보기', zoom.fit, zoom.atFit, label('전체'), true)}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  content: { position: 'absolute', left: 0, top: 0 },
  controls: { position: 'absolute', right: spacing.sm, bottom: spacing.sm },
  // 손가락 기준 44pt 상자, 버튼 사이는 sm — 캔버스 위에 떠 있어 hitSlop 대신 실제 크기로 키운다.
  cluster: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    height: 44,
    minWidth: 44,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideBtn: { paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.35 },
});
