import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

/** 페이지 메뉴 — 헤더 ☰ 자리에서 내려오는 종이 시트. 페이지 추가 · 페이지 지우기. */
export function PageMenu({ visible, onClose, pageLabel, canAdd, onAdd, canDelete, onDelete }: {
  visible: boolean;
  onClose: () => void;
  /** 머리 줄 — '2 / 3쪽' 처럼. */
  pageLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrimDim }]} onPress={onClose} accessibilityLabel="메뉴 닫기">
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>페이지 · {pageLabel}</Text>
          <Item
            label="페이지 추가"
            description={canAdd ? '이 페이지 뒤에 새 페이지' : '노트는 6페이지까지예요'}
            disabled={!canAdd}
            onPress={run(onAdd)}
          />
          <Item
            label="페이지 지우기"
            description={canDelete ? '그린 것과 붙인 것이 함께 사라져요' : '마지막 한 장은 지울 수 없어요'}
            disabled={!canDelete}
            onPress={run(onDelete)}
            danger
          />
        </View>
      </Pressable>
    </Modal>
  );
}

function Item({ label, description, onPress, disabled = false, danger = false }: {
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.item, { borderBottomColor: colors.line }, disabled ? styles.disabled : null, pressed && !disabled ? pressedStyle : null,
      ]}
    >
      <Text style={[typeScale.bodyStrong, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 58, paddingRight: spacing.md },
  sheet: { width: 280, borderWidth: hairline, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  item: { paddingVertical: spacing.sm, borderBottomWidth: hairline, gap: 2 },
  disabled: { opacity: 0.35 },
});
