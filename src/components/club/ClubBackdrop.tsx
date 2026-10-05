import { StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { CachedImage as Image } from '@/components/CachedImage';

/**
 * 모임별 기본 그림 — 이모티콘 캐릭터 여섯이 책 읽는 장면 두 장씩. 정적 경로로 앱에 포함해 네트워크 없이도 표시한다.
 * 이웃한 id가 같은 캐릭터를 받지 않게 여섯 캐릭터를 한 바퀴씩 번갈아 둔다.
 */
const DEFAULT_BACKGROUNDS: readonly ImageSourcePropType[] = [
  require('../../../assets/optimized/club-backgrounds/01-ears-rainy-armchair.webp'),
  require('../../../assets/optimized/club-backgrounds/03-dust-bookshelf.webp'),
  require('../../../assets/optimized/club-backgrounds/05-paper-cafe.webp'),
  require('../../../assets/optimized/club-backgrounds/07-worm-bookshelf.webp'),
  require('../../../assets/optimized/club-backgrounds/09-dumpling-desk.webp'),
  require('../../../assets/optimized/club-backgrounds/11-sprout-low-table.webp'),
  require('../../../assets/optimized/club-backgrounds/02-ears-park-bench.webp'),
  require('../../../assets/optimized/club-backgrounds/04-dust-night-desk.webp'),
  require('../../../assets/optimized/club-backgrounds/06-paper-hanok.webp'),
  require('../../../assets/optimized/club-backgrounds/08-worm-seaside.webp'),
  require('../../../assets/optimized/club-backgrounds/10-dumpling-window-seat.webp'),
  require('../../../assets/optimized/club-backgrounds/12-sprout-park-bench.webp'),
];

/**
 * 올린 사진이 없으면 기본 그림 12장 중 모임 id로 고정 배정한다.
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
        { width: '100%', height: '100%' },
        style as object,
      ]}
      contentFit={resizeMode}
      recyclingKey={uri || `club-default-${index}`}
      accessibilityIgnoresInvertColors
    />
  );
}
