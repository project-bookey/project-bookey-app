import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, RotateCw, X } from 'lucide-react-native';

import { ICON_SIZE } from '@/components/collage';
import { controlFace, hairline, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

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
 * 사진 띠 — 고른 사진이 인화지처럼 늘어서고, 타일마다 올라가는 상태·다시·떼기를 보인다.
 * `onPick` 을 넘기면 맨 앞에 사진 추가 타일(홈 책 추가 칸과 같은 회색 면 + 아이콘만, 이름은 접근성 라벨)을 둔다 — 독후감 작성은
 * 사진을 본문 커서 자리에 넣으므로 하단 바의 사진 버튼이 입구이고, 여기는 붙은 사진을 다루는 자리라 타일을 두지 않는다.
 * 타일 위 버튼(다시·떼기)은 아이콘만(2026-10-05 사용자 결정)이고 타일(View)의 자식이라 웹에서 버튼이 겹치지 않는다.
 */
export function PhotoStrip({ photos, onPick, onRetry, onRemove, max, disabled, retryable = true, notice }: {
  photos: PhotoUpload[];
  /** 있으면 맨 앞에 고르기 고스트 타일을 둔다. */
  onPick?: () => void;
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
        {onPick && !full ? (
          <Pressable
            onPress={onPick}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            accessibilityState={{ disabled: !!disabled }}
            style={({ pressed }) => [
              styles.tile, styles.addTile, controlFace(colors.tonal),
              disabled ? styles.disabled : null,
              pressed && !disabled && pressedStyle,
            ]}
          >
            <ImagePlus size={ICON_SIZE} color={colors.text} {...iconStroke} />
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
                  <RotateCw size={20} color={colors.warn} {...iconStroke} />
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
                  <X size={14} color={colors.text} {...iconStroke} />
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
  addTile: { borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
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
    borderRadius: radius.control,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
