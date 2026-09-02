import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, mono, radius, sans, serif, typeScale } from '@/theme/tokens';

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
/** 책갈피 — 두께·앞마구리(오른쪽 세로면) 밖으로 삐져나온 길이·판 안쪽으로 숨긴 길이·출구 그림자 길이(px), 세로 위치 비율. */
const TAB = { thick: 7, out: 11, inset: 10, exitShade: 7, topRatio: 0.3 } as const;
/** 메모장 — 안쪽 여백·괘선 간격·본문 활자·제목 높이(px). 126px 표지 기준 한 줄 12자 남짓. */
const PAD = { inset: 8, lineH: 12, fontSize: 8.5, headerH: 14 } as const;

/** 음영은 검정·흰색 알파라 팔레트와 무관 — 라이트 판은 밝아서 더 옅게 깐다. */
const SHADE = {
  dark: { spine: ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.10)'], plateEdge: 'rgba(0,0,0,0.55)' },
  light: { spine: ['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.35)'], plateEdge: 'rgba(0,0,0,0.35)' },
} as const;
/** 메모장 괘선 — 종이 위 옅은 잉크선. */
const RULE = 'rgba(0,0,0,0.12)';
const SPINE_STOPS = [0, 0.45, 0.75, 1] as const;

/** 띠지에 얹는 두 줄 — 상태(세리프)와 진행(모노). */
export type BookBand = { title: string; meta?: string };
/** 책 뒤에 끼워 둔 메모장 — 모노 제목(예: 줄거리)과 본문. 둘 다 없으면 빈 괘선 메모장. */
export type BookNote = { title?: string; body?: string };

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
 * 장정된 책의 몸통 — 판 뒤로 비치는 책장 단면과, 책장 사이에 꽂혀 오른쪽 세로면으로 살짝 삐져나온 민트 책갈피.
 * TiltCover 프레임 뒤(뒤장 스택 위)에 그린다. 책갈피 안쪽은 프레임에 가려 '꽂힌' 것처럼 보인다.
 */
export function BookBody({ width, height }: { width: number; height: number }) {
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
          styles.tab,
          {
            left: width - TAB.inset,
            top: Math.round(height * TAB.topRatio),
            width: TAB.inset + TAB.out,
            height: TAB.thick,
            backgroundColor: colors.accent,
          },
        ]}
      >
        {/* 판 옆에서 나오는 출구 그림자 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.tabShade, { left: TAB.inset, width: TAB.exitShade }]}
        />
      </View>
    </>
  );
}

/**
 * 책 뒤에 끼워 둔 메모장 — 괘선 종이 위에 모노 제목과 작은 본문(줄거리 등).
 * TiltCover 의 뒤장(stack) 안을 채운다. 앞 책에 대부분 가려지고 오른쪽·위쪽 가장자리만 보이는 게 정상이다.
 */
export function BackNote({ width, height, note }: { width: number; height: number; note: BookNote }) {
  const { colors } = useTheme();
  const bodyTop = PAD.inset + (note.title ? PAD.headerH : 0);
  const lines = Math.max(0, Math.floor((height - bodyTop - PAD.inset) / PAD.lineH));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.memoPad }]}>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          style={[styles.rule, { left: PAD.inset, right: PAD.inset, top: bodyTop + (i + 1) * PAD.lineH - 1 }]}
        />
      ))}
      {note.title ? (
        <Text
          numberOfLines={1}
          style={[typeScale.monoEyebrow, styles.noteTitle, { left: PAD.inset, top: PAD.inset, color: colors.onMemoPad }]}
        >
          {note.title}
        </Text>
      ) : null}
      {note.body ? (
        <Text
          numberOfLines={lines}
          style={[styles.noteBody, { left: PAD.inset, width: width - PAD.inset * 2, top: bodyTop, color: colors.onMemoPad }]}
        >
          {note.body}
        </Text>
      ) : null}
    </View>
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
  tab: { position: 'absolute' },
  tabShade: { position: 'absolute', top: 0, bottom: 0 },
  rule: { position: 'absolute', height: hairline, backgroundColor: RULE },
  noteTitle: { position: 'absolute', fontSize: 7, letterSpacing: 1.5, opacity: 0.7 },
  noteBody: { position: 'absolute', fontFamily: sans.regular, fontSize: PAD.fontSize, lineHeight: PAD.lineH },
});
