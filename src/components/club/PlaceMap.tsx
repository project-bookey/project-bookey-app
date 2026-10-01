import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';

const TILE = 256;
const ZOOM = 15;
const HEIGHT = 200;

/** 위경도 → 타일 좌표(소수). */
function tilePoint(lat: number, lng: number) {
  const n = 2 ** ZOOM;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y, n };
}

/**
 * 모임 장소 지도 — OpenStreetMap 타일 3×3 을 이어 붙이고 가운데에 잉크 점을 찍는다.
 * 종이 위 다른 조각처럼 헤어라인 한 겹으로만 둘러싼다(그림자 없음).
 */
export function PlaceMap({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  if (latitude == null || longitude == null) return null;
  const p = tilePoint(latitude, longitude);
  const baseX = Math.floor(p.x);
  const baseY = Math.floor(p.y);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.frame, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}
    >
      {[-1, 0, 1].flatMap((dy) =>
        [-1, 0, 1].map((dx) => {
          const x = (baseX + dx + p.n) % p.n;
          const y = baseY + dy;
          return (
            <Image
              key={`${x}-${y}`}
              source={{ uri: `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png` }}
              style={[
                styles.tile,
                { left: width / 2 + (baseX + dx - p.x) * TILE, top: HEIGHT / 2 + (baseY + dy - p.y) * TILE },
              ]}
            />
          );
        }),
      )}
      <View style={styles.pin} pointerEvents="none">
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Circle cx={11} cy={11} r={6} fill={colors.ink} stroke={colors.onInk} strokeWidth={2} />
        </Svg>
      </View>
      <Text style={[styles.credit, { color: colors.textMuted, backgroundColor: colors.surface }]}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: HEIGHT, borderRadius: radius.sm, borderWidth: hairline, overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -11, marginTop: -11 },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontFamily: mono.regular,
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
