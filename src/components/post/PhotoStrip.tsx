import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

import type { PhotoUpload } from './usePhotoUploads';

/** 타일 한 변(px). */
const TILE = 84;
/** 타일 교차 기울기(도) — 상세의 인화지와 같은 값. */
const TILE_TILT = [-1.5, 1.5];

/**
 * 사진 띠 — 점선 고스트 `+ 사진`(프로필 서가의 빈 칸과 같은 꼴) 뒤로 고른 사진이 인화지처럼 늘어선다.
 * 타일 위 버튼(다시·×)은 타일(View)의 자식이라 웹에서 버튼이 겹치지 않는다.
 */
export function PhotoStrip({ photos, onPick, onRetry, onRemove, max }: {
  photos: PhotoUpload[];
  onPick: () => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  max: number;
}) {
  const { colors } = useTheme();
  const full = photos.length >= max;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {!full ? (
          <Pressable
            onPress={onPick}
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            style={[styles.tile, styles.ghost, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>사진</Text>
          </Pressable>
        ) : null}

        {photos.map((photo, i) => (
          <View key={photo.key} style={[styles.tile, { transform: [{ rotate: `${TILE_TILT[i % 2]}deg` }] }]}>
            <Image
              source={{ uri: photo.localUri ?? photo.image?.url }}
              resizeMode="cover"
              accessibilityLabel={`사진 ${i + 1}`}
              style={[styles.image, { borderColor: colors.line }]}
            />
            {photo.status === 'uploading' ? (
              <View style={[styles.overlay, { backgroundColor: colors.bg }]}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null}
            {photo.status === 'failed' ? (
              <Pressable
                onPress={() => onRetry(photo.key)}
                accessibilityRole="button"
                accessibilityLabel={`사진 ${i + 1} 다시 올리기`}
                style={[styles.overlay, { backgroundColor: colors.bg }]}
              >
                <Text style={[typeScale.monoLabel, { color: colors.warn }]}>다시</Text>
              </Pressable>
            ) : null}
            {/* 실패한 사진도 뗄 수 있어야 한다 — 안 그러면 올리기가 영영 막힌다. */}
            {photo.status !== 'uploading' ? (
              <Pressable
                onPress={() => onRemove(photo.key)}
                accessibilityRole="button"
                accessibilityLabel={`사진 ${i + 1} 제거`}
                style={[styles.remove, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <Text style={[styles.removeMark, { color: colors.text }]}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {full ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>최대 {max}장</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  // 기울인 타일 모서리와 × 버튼이 잘리지 않게 사방으로 숨을 둔다.
  row: { gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  tile: { width: TILE, height: TILE },
  ghost: {
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  image: { width: TILE, height: TILE, borderRadius: radius.sm, borderWidth: hairline },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.sm,
    opacity: 0.72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMark: { fontSize: 14, lineHeight: 16 },
});
