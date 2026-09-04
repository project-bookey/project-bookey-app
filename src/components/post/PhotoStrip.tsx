import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

import type { PhotoUpload } from './usePhotoUploads';

/** 타일 한 변(px). */
const TILE = 84;
/** 타일 교차 기울기(도) — 상세의 인화지와 같은 값. */
const TILE_TILT = [-1.5, 1.5];
/** × 버튼 — 보이는 원과 실제 터치 상자. 웹은 hitSlop 을 무시하므로 상자를 진짜로 키운다. */
const REMOVE = 22;
const REMOVE_HIT = 36;
/** 원 둘레에 두르는 투명 여백 — 상자를 이만큼 더 밀어야 원이 있던 자리를 지킨다. */
const REMOVE_PAD = (REMOVE_HIT - REMOVE) / 2;
/** 네이티브는 36px 상자 위에 hitSlop 을 더 얹는다(푸터 액션과 같은 규율). */
const REMOVE_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

/**
 * 사진 띠 — 점선 고스트 `+ 사진`(프로필 서가의 빈 칸과 같은 꼴) 뒤로 고른 사진이 인화지처럼 늘어선다.
 * 타일 위 버튼(다시·×)은 타일(View)의 자식이라 웹에서 버튼이 겹치지 않는다.
 */
export function PhotoStrip({ photos, onPick, onRetry, onRemove, max, disabled, retryable = true, notice }: {
  photos: PhotoUpload[];
  onPick: () => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  max: number;
  /** 고르기 창이 이미 떠 있거나 서버가 사진을 못 받는 상태면 참 — 고스트 타일을 잠근다. */
  disabled?: boolean;
  /** 거짓이면 실패한 타일에 '다시'를 두지 않는다 — 서버 저장소가 꺼져 있어 다시 눌러도 결과가 같을 때. */
  retryable?: boolean;
  /** 띠 아래 한 줄 안내(사진첩 권한 거부·업로드 실패 이유). */
  notice?: string | null;
}) {
  const { colors } = useTheme();
  const full = photos.length >= max;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {!full ? (
          <Pressable
            onPress={onPick}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            accessibilityState={{ disabled: !!disabled }}
            style={[styles.tile, styles.ghost, {
              borderColor: colors.lineStrong,
              opacity: disabled ? 0.35 : 1,
            }]}
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
            {/* 실패한 타일 — 다시 해 볼 만하면 '다시', 아니면 눌리지 않는 표시만 남긴다(이유는 아래 한 줄에). */}
            {photo.status === 'failed' ? (
              retryable ? (
                <Pressable
                  onPress={() => onRetry(photo.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`사진 ${i + 1} 다시 올리기`}
                  style={[styles.overlay, { backgroundColor: colors.bg }]}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.warn }]}>다시</Text>
                </Pressable>
              ) : (
                <View style={[styles.overlay, { backgroundColor: colors.bg }]}>
                  <Text style={[typeScale.monoLabel, { color: colors.warn }]}>실패</Text>
                </View>
              )
            ) : null}
            {/* 실패한 사진도 뗄 수 있어야 한다 — 띠에 남겨 둬도 글은 올라가지만 자리를 차지한다. */}
            {photo.status !== 'uploading' ? (
              <Pressable
                onPress={() => onRemove(photo.key)}
                hitSlop={REMOVE_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`사진 ${i + 1} 제거`}
                style={styles.removeHit}
              >
                <View style={[styles.remove, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={[styles.removeMark, { color: colors.text }]}>×</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {full ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>최대 {max}장</Text> : null}
      {notice ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  // 기울인 타일 모서리와 × 터치 상자(원 밖으로 REMOVE_PAD 만큼 더 나간다)가 잘리지 않게 사방으로 숨을 둔다.
  row: { gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
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
  // 터치 상자 — 투명한 36px. 보이는 원은 그대로 타일 모서리 밖 6px 에 두려고 상자를 REMOVE_PAD 만큼 더 민다.
  removeHit: {
    position: 'absolute',
    top: -6 - REMOVE_PAD,
    right: -6 - REMOVE_PAD,
    width: REMOVE_HIT,
    height: REMOVE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    width: REMOVE,
    height: REMOVE,
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMark: { fontSize: 14, lineHeight: 16 },
});
