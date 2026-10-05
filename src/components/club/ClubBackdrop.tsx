import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage as Image } from '@/components/CachedImage';
import { layout, useTheme } from '@/theme';

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
export function ClubBackdrop({ uri, seed, style }: {
  uri?: string | null;
  seed: number;
  style?: StyleProp<ViewStyle>;
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
      contentFit="cover"
      recyclingKey={uri || `club-default-${index}`}
      accessibilityIgnoresInvertColors
    />
  );
}

/** 이름 묶음이 머리 그림 아래쪽에 겹쳐 올라가는 비율 — 그림이 종이색으로 녹는 구간이다. */
export const CLUB_HEAD_OVERLAP = 0.3;

/**
 * 클럽 머리 그림(2026-10-05 사용자 결정, C안) — 3:2 그림에 종이색 그라데이션을 덮는다.
 * 위 끝은 헤더 아이콘이 어두운 모드에서도 보이게 살짝, 가운데는 그대로, 아래 끝은 종이색으로 녹인다.
 * `height`를 주지 않으면 폭에 맞춘 3:2 상자다.
 */
export function ClubHeadImage({ uri, seed, height, style }: {
  uri?: string | null;
  seed: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.image, height === undefined ? styles.imageRatio : { height }, style]}
    >
      <ClubBackdrop uri={uri} seed={seed} />
      <LinearGradient
        colors={[`${colors.bg}8C`, `${colors.bg}00`, `${colors.bg}00`, `${colors.bg}E6`, colors.bg]}
        locations={[0, 0.25, 0.5, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * 클럽 머리 — 그림을 상태 표시줄 바로 아래부터 헤더 뒤로 깔고, 헤더는 그 위에 띄우고,
 * 이름 묶음(children)은 그림이 녹는 아래쪽에 겹쳐 올린다. 클럽 홈과 추천 클럽 미리보기가 같이 쓴다.
 * 상태 표시줄 자리를 비워 두므로 노치가 있는 기기에서도 헤더 줄이 그림의 같은 자리에 걸린다.
 */
export function ClubHead({ uri, seed, header, children }: {
  uri?: string | null;
  seed: number;
  header: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 태블릿 · 웹에서 그림이 화면을 다 덮지 않게 본문 최대 폭 기준으로 높이를 잡는다.
  const imageHeight = (Math.min(width, layout.content.maxWidth) * 2) / 3;

  return (
    <View>
      <ClubHeadImage uri={uri} seed={seed} height={imageHeight} style={{ marginTop: insets.top }} />
      <View style={styles.header}>{header}</View>
      <View style={{ marginTop: -imageHeight * CLUB_HEAD_OVERLAP }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
  imageRatio: { aspectRatio: 3 / 2 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
});
