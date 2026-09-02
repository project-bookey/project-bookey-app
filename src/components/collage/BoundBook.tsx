import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, mono, radius, serif } from '@/theme/tokens';

/**
 * 시안(126×189) 기준 비율. 사진판 여백·책등 폭·띠지 위치는 표지 크기에 비례한다.
 * 책장 두께·리본은 실물 두께라 아래 px 상수로 고정한다.
 */
const R = {
  plateSide: 17 / 126,
  plateTop: 10 / 189,
  plateBottom: 30 / 189,
  spineW: 12 / 126,
  bandBottom: 16 / 189,
  bandH: 36 / 189,
} as const;
/** 책장 단면이 판 밖으로 비치는 두께(px). */
const PAGE_OFFSET = 3;
/** 리본 — 폭·판 밖으로 늘어진 길이·오른쪽 여백·판 안쪽으로 숨긴 길이·출구 그림자 길이(px). */
const RIBBON = { w: 8, tail: 28, right: 16, inset: 10, exitShade: 14 } as const;

/** 음영은 검정·흰색 알파라 팔레트와 무관 — 라이트 판은 밝아서 더 옅게 깐다. */
const SHADE = {
  dark: { spine: ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.10)'], plateEdge: 'rgba(0,0,0,0.55)' },
  light: { spine: ['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.35)'], plateEdge: 'rgba(0,0,0,0.35)' },
} as const;
const SPINE_STOPS = [0, 0.45, 0.75, 1] as const;

/** 띠지에 얹는 두 줄 — 상태(세리프)와 진행(모노). */
export type BookBand = { title: string; meta?: string };

/**
 * 장정된 책의 앞면 — 판(board) 위에 사진판을 오려 붙이고, 왼쪽에 책등 음영, 아래에 띠지를 두른다.
 * 판 색은 테마가 정한다(다크 = 어두운 천, 라이트 = 리넨, 띠지는 그 반전).
 * TiltCover 의 surface 안에서 그린다 — 모서리·오버플로는 surface 가 맡는다.
 */
export function BoundFace({ uri, title, width, height, band }: {
  uri?: string | null;
  title?: string;
  width: number;
  height: number;
  band?: BookBand;
}) {
  const { colors, mode } = useTheme();
  const shade = SHADE[mode];
  const side = Math.round(width * R.plateSide);
  const spineW = Math.round(width * R.spineW);
  const bandH = Math.round(height * R.bandH);
  const bandBottom = Math.round(height * R.bandBottom);
  // 띠지 활자는 표지 폭에 비례 — 126px 에서 세리프 10 / 모노 7.
  const titleSize = Math.max(8, Math.round(width / 12.6));
  const metaSize = Math.max(6, Math.round(width / 18));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bookBoard }]}>
      {/* 사진판 — 표지 이미지는 여기만 채운다 */}
      <View
        style={[
          styles.plate,
          {
            left: side,
            right: side,
            top: Math.round(height * R.plateTop),
            bottom: Math.round(height * R.plateBottom),
            backgroundColor: colors.surfaceDeep,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          // 무표지 폴백 — 사진판 안에 세리프 제목만.
          <View style={styles.plateFallback}>
            <Text
              numberOfLines={3}
              style={[styles.plateFallbackTitle, { color: colors.textMuted, fontSize: Math.max(9, Math.round(width / 9)) }]}
            >
              {title ?? '표지 없음'}
            </Text>
          </View>
        )}
        {/* 눌러 붙인 가장자리 */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.plateEdge, { borderColor: shade.plateEdge }]} />
      </View>

      {/* 책등 음영 */}
      <LinearGradient
        pointerEvents="none"
        colors={shade.spine}
        locations={SPINE_STOPS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.spine, { width: spineW }]}
      />

      {band ? (
        <>
          {/* 띠지가 판 위로 드리우는 그림자 */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.bandShade, { bottom: bandBottom + bandH }]}
          />
          <View
            style={[
              styles.band,
              { bottom: bandBottom, height: bandH, backgroundColor: colors.bookBand, paddingLeft: spineW },
            ]}
          >
            {/* 띠지도 책등을 감싸며 어두워진다 */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.bandSpine, { width: spineW }]}
            />
            <Text numberOfLines={1} style={[styles.bandTitle, { color: colors.onBookBand, fontSize: titleSize }]}>
              {band.title}
            </Text>
            {band.meta ? (
              <Text numberOfLines={1} style={[styles.bandMeta, { color: colors.onBookBand, fontSize: metaSize }]}>
                {band.meta}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * 장정된 책의 몸통 — 판 뒤로 비치는 책장 단면과, 책장 사이에 꽂혀 아래로 늘어진 민트 리본.
 * TiltCover 프레임 뒤(뒤장 스택 위)에 그린다. 리본 윗부분은 프레임에 가려 '꽂힌' 것처럼 보인다.
 */
export function BookBody({ width, height, ribbonRight = RIBBON.right }: {
  width: number;
  height: number;
  /** 리본의 오른쪽 여백(px). 사용처가 다른 종잇조각에 가리지 않는 자리로 옮길 때 쓴다. */
  ribbonRight?: number;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.pages,
          {
            width,
            height,
            backgroundColor: colors.bookPage,
            transform: [{ translateX: PAGE_OFFSET }, { translateY: PAGE_OFFSET }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ribbon,
          {
            right: ribbonRight,
            top: height - RIBBON.inset,
            width: RIBBON.w,
            height: RIBBON.inset + RIBBON.tail,
            backgroundColor: colors.accent,
          },
        ]}
      >
        {/* 판 밑에서 나오는 출구 그림자 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.ribbonShade, { top: RIBBON.inset, height: RIBBON.exitShade }]}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  plate: { position: 'absolute', overflow: 'hidden', borderRadius: 1 },
  plateEdge: { borderWidth: hairline, borderRadius: 1 },
  plateFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  plateFallbackTitle: { fontFamily: serif.bold, textAlign: 'center' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  bandShade: { position: 'absolute', left: 0, right: 0, height: 8 },
  band: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', paddingRight: 8 },
  bandSpine: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  bandTitle: { fontFamily: serif.extraBold },
  bandMeta: { fontFamily: mono.medium, letterSpacing: 1, marginTop: 2, opacity: 0.75 },
  pages: { position: 'absolute', borderRadius: radius.sm },
  ribbon: { position: 'absolute' },
  ribbonShade: { position: 'absolute', left: 0, right: 0 },
});
