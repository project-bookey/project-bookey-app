import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/** 노트 도구 공용 하단 시트 — 텍스트·말풍선 편집, 스티커 고르기. 바탕을 누르면 닫힌다. */
export function NoteSheet({ visible, title, onClose, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrimDim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.lineStrong, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
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
});
