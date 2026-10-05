import { StyleSheet } from 'react-native';
import { CachedImage as Image } from '@/components/CachedImage';

import { hairline, radius, useTheme } from '@/theme';

/** 그릴 사진 — 서버 사진이면 url, 올라가는 중이면 고른 파일의 로컬 uri. 크기를 알면 비율을 지킨다. */
export type PhotoSource = { uri: string; width?: number; height?: number };

/** 비율 범위 — 아주 길쭉한 사진이 본문을 통째로 덮거나 띠처럼 얇아지지 않게 이 안에서 잘라 보인다. */
const MIN_RATIO = 3 / 4;
const MAX_RATIO = 1.91;
/** 크기를 모를 때의 비율. */
const FALLBACK_RATIO = 4 / 3;

/** 본문 폭을 꽉 채운 사진 한 장 — 독후감 본문 안 제자리와 본문 앞(옛 글)에 쓴다. 기울이지 않는다. */
export function PostPhoto({ source, label }: { source: PhotoSource; label: string }) {
  const { colors } = useTheme();
  const ratio = source.width && source.height
    ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, source.width / source.height))
    : FALLBACK_RATIO;
  return (
    <Image
      source={{ uri: source.uri }}
      contentFit="cover"
      recyclingKey={source.uri}
      accessibilityLabel={label}
      style={[styles.photo, { aspectRatio: ratio, backgroundColor: colors.surfaceDeep, borderColor: colors.line }]}
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: radius.sm, borderWidth: hairline },
});
