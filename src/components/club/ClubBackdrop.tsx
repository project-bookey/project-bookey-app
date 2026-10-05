import { Image, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';

/** 모임별 기본 사진 — 정적 경로로 앱에 포함해 네트워크 없이도 표시한다. */
const DEFAULT_BACKGROUNDS: readonly ImageSourcePropType[] = [
  require('../../../assets/club-backgrounds/01-sunny-cafe.jpg'),
  require('../../../assets/club-backgrounds/02-rainy-night-cafe.jpg'),
  require('../../../assets/club-backgrounds/03-bookshop.jpg'),
  require('../../../assets/club-backgrounds/04-forest-window.jpg'),
  require('../../../assets/club-backgrounds/05-city-night.jpg'),
  require('../../../assets/club-backgrounds/06-seaside-terrace.jpg'),
  require('../../../assets/club-backgrounds/07-library.jpg'),
  require('../../../assets/club-backgrounds/08-hanok.jpg'),
  require('../../../assets/club-backgrounds/09-park-bench.jpg'),
  require('../../../assets/club-backgrounds/10-home-study.jpg'),
];

/**
 * 올린 사진이 없으면 독서 장소 사진 10장 중 모임 id로 고정 배정한다.
 * 목록 · 상세 · 추천 · 설정에서 같은 사진을 쓰고, 글씨 가독성은 각 화면의 그라데이션이 맡는다.
 */
export function ClubBackdrop({ uri, seed, style, resizeMode = 'cover' }: {
  uri?: string | null;
  seed: number;
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const index = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) % DEFAULT_BACKGROUNDS.length : 0;

  return (
    <Image
      source={uri ? { uri } : DEFAULT_BACKGROUNDS[index]}
      style={[
        StyleSheet.absoluteFill,
        { width: '100%', height: '100%', objectFit: resizeMode } as ImageStyle,
        style as object,
      ]}
      resizeMode={resizeMode}
      accessibilityIgnoresInvertColors
    />
  );
}
