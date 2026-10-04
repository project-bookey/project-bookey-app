import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/**
 * 노트 도구 공용 하단 시트 — 텍스트·말풍선 편집, 스티커 고르기. 바탕을 누르면 닫힌다.
 * 키보드가 뜨면 시트가 그 위로 올라온다. 입력이 있는 시트는 scroll 을 켠다 — 작은 폰에서 키보드 위 자리가 모자라도
 * 시트 안을 굴려 '완료'에 닿는다(목록을 품은 시트는 안쪽 목록이 스스로 스크롤하므로 끈 채로 둔다).
 */
export function NoteSheet({ visible, title, onClose, scroll = false, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  scroll?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardArea style={styles.fill}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrimDim }]} onPress={onClose} accessibilityLabel="닫기" />
        <KeyboardDock stacked style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>{title}</Text>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.body}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </KeyboardDock>
      </KeyboardArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopWidth: hairline,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
  },
  // 내용이 85% 를 넘으면 줄어들어 안에서 스크롤한다.
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: spacing.md },
});
