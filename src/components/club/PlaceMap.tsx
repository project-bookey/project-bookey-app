import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, spacing, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';

const TILE = 256;
/** 한 곳만 찍을 때의 확대 — 골목까지 보인다. */
const ZOOM = 15;
/** 여러 곳을 찍을 때 — 가까이 모여 있어도 이보다 더 당기지 않는다. 멀리 흩어지면 다 들어올 때까지 줄인다. */
const MAX_FIT_ZOOM = 16;
const MIN_FIT_ZOOM = 5;
/** 가장자리 핀이 잘리지 않게 비워 두는 여백. */
const FIT_PADDING = 24;
const HEIGHT = 200;

/** 위경도 → 0~1 로 편 지도 좌표(웹 메르카토르). 확대 z 의 픽셀은 이 값 × 256 × 2^z. */
function unitPoint(lat: number, lng: number) {
  const rad = (lat * Math.PI) / 180;
  return {
    u: (lng + 180) / 360,
    v: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
  };
}

export type MapPin = { key: string; latitude: number; longitude: number; label?: string };

/**
 * 모임 장소 지도 — OpenStreetMap 타일을 이어 붙이고 가운데에 잉크 점을 찍는다.
 * 종이 위 다른 조각처럼 헤어라인 한 겹으로만 둘러싼다(그림자 없음).
 */
export function PlaceMap({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  if (latitude == null || longitude == null) return null;
  return <PinMap pins={[{ key: 'place', latitude, longitude }]} />;
}

/**
 * 여러 곳을 한 지도에 — 모든 핀(fitTo 를 주면 그 핀들)이 들어오도록 확대를 맞추고, label 이 있으면 번호 핀으로
 * 찍는다(장소 찾기 결과). 지도는 보기만 하는 그림이다 — 고르는 일은 옆 목록이 한다.
 */
export function PinMap({ pins, fitTo, height = HEIGHT }: { pins: MapPin[]; fitTo?: MapPin[]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  if (pins.length === 0) return null;

  const points = pins.map((pin) => ({ pin, ...unitPoint(pin.latitude, pin.longitude) }));
  const framed = fitTo?.length ? fitTo.map((pin) => unitPoint(pin.latitude, pin.longitude)) : points;
  const us = framed.map((p) => p.u);
  const vs = framed.map((p) => p.v);
  const [minU, maxU, minV, maxV] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  // 모든 핀이 여백 안에 드는 가장 큰 확대. 한 점(또는 같은 자리)이면 기본 확대.
  const spanU = (maxU - minU) * TILE;
  const spanV = (maxV - minV) * TILE;
  const fit = Math.min(
    spanU > 0 ? Math.log2((width - FIT_PADDING * 2) / spanU) : Infinity,
    spanV > 0 ? Math.log2((height - FIT_PADDING * 2) / spanV) : Infinity,
  );
  const zoom = Number.isFinite(fit) ? Math.max(MIN_FIT_ZOOM, Math.min(MAX_FIT_ZOOM, Math.floor(fit))) : ZOOM;

  const scale = TILE * 2 ** zoom;
  const n = 2 ** zoom;
  // 화면 왼쪽 위 모서리의 지도 픽셀 — 타일과 핀을 모두 이 기준으로 옮긴다.
  const left = ((minU + maxU) / 2) * scale - width / 2;
  const top = ((minV + maxV) / 2) * scale - height / 2;
  const tiles: { x: number; y: number }[] = [];
  for (let y = Math.floor(top / TILE); y <= Math.floor((top + height) / TILE); y++) {
    if (y < 0 || y >= n) continue;
    for (let x = Math.floor(left / TILE); x <= Math.floor((left + width) / TILE); x++) tiles.push({ x, y });
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { height, backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}
    >
      {tiles.map(({ x, y }) => (
        <Image
          key={`${zoom}-${x}-${y}`}
          source={{ uri: `https://tile.openstreetmap.org/${zoom}/${(x + n) % n}/${y}.png` }}
          style={[styles.tile, { left: x * TILE - left, top: y * TILE - top }]}
        />
      ))}
      {/* 뒤에서부터 그려 1번 핀이 맨 위에 온다. */}
      {[...points].reverse().map(({ pin, u, v }) => (
        <View
          key={pin.key}
          pointerEvents="none"
          style={[styles.pin, { left: u * scale - left, top: v * scale - top }]}
        >
          {pin.label ? (
            <View style={[styles.badge, { backgroundColor: colors.ink, borderColor: colors.onInk }]}>
              <Text style={[styles.badgeText, { color: colors.onInk }]}>{pin.label}</Text>
            </View>
          ) : (
            <Svg width={22} height={22} viewBox="0 0 22 22">
              <Circle cx={11} cy={11} r={6} fill={colors.ink} stroke={colors.onInk} strokeWidth={2} />
            </Svg>
          )}
        </View>
      ))}
      <Text style={[styles.credit, { color: colors.textMuted, backgroundColor: colors.surface }]}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.sm, borderWidth: hairline, overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  // 핀 가운데가 그 자리에 오도록 22pt 상자를 반만큼 당긴다.
  pin: { position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, alignItems: 'center', justifyContent: 'center' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.round,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: mono.semiBold, fontSize: 10 },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontFamily: mono.regular,
    fontSize: 8,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
});
