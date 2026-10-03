import { StyleSheet, Text, View } from 'react-native';

import { spacing, typeScale, useTheme } from '@/theme';
import { NoteAction } from './NoteAction';
import { PhotoElement } from './elements/PhotoElement';
import type { PendingPhoto } from './useNotePhotos';

/** 업로드 중·실패한 사진 자리표시자 — 오버레이(캡처 밖)에 요소처럼 놓인다. 실패하면 다시·지우기를 보인다. */
export function PendingPhotos({ items, scale, onRetry, onRemove }: {
  items: PendingPhoto[];
  scale: number;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      {items.map((p) => (
        <View key={p.key} pointerEvents="box-none" style={{ position: 'absolute', left: p.x * scale, top: p.y * scale, width: p.w * scale }}>
          <PhotoElement element={{ w: p.w, h: p.h, url: p.asset.uri }} scale={scale} uri={p.asset.uri} pending={p.status === 'uploading'} />
          {p.status === 'failed' ? (
            <View style={styles.failed}>
              <Text numberOfLines={1} style={[typeScale.caption, { color: colors.danger }]}>{p.message}</Text>
              <View style={styles.actions}>
                <NoteAction label="다시" onPress={() => onRetry(p.key)} />
                <NoteAction label="지우기" onPress={() => onRemove(p.key)} tone="danger" />
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  failed: { marginTop: spacing.xs, gap: spacing.xs },
  // 지우기는 되돌릴 수 없다 — 다시와 붙여 두지 않는다.
  actions: { flexDirection: 'row', gap: spacing.lg },
});
