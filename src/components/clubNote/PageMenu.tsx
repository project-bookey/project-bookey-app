import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import type { NotePaper } from './noteDoc';

const PAPERS: { value: NotePaper; label: string }[] = [
  { value: 'plain', label: '민무늬' }, { value: 'grid', label: '격자' }, { value: 'lined', label: '줄' },
];

/** 페이지 메뉴 — 모임 홈 ☰ 메뉴와 같은 자리·같은 종이 시트. 종이 바꾸기 · 제목 바꾸기 · 페이지 추가 · PNG 저장 · 페이지 삭제. */
export function PageMenu({ visible, onClose, readOnly, canDelete, paper, onPaper, onRename, onAdd, onExport, onDelete }: {
  visible: boolean;
  onClose: () => void;
  readOnly: boolean;
  canDelete: boolean;
  paper: NotePaper;
  onPaper: (paper: NotePaper) => void;
  onRename: () => void;
  onAdd: () => void;
  onExport: () => void;
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
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>페이지 메뉴</Text>
          {!readOnly ? (
            <View style={styles.paperRow}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>종이</Text>
              <Segmented options={PAPERS} value={paper} onChange={onPaper} />
            </View>
          ) : null}
          {!readOnly ? <Item label="제목 바꾸기" description="페이지 위에 보이는 이름" onPress={run(onRename)} colors={colors} /> : null}
          {!readOnly ? <Item label="페이지 추가" description="마지막 뒤에 새 페이지" onPress={run(onAdd)} colors={colors} /> : null}
          <Item label="PNG로 저장" description="이 페이지를 이미지로 공유" onPress={run(onExport)} colors={colors} />
          {!readOnly && canDelete ? (
            <Item label="페이지 삭제" description="그린 것과 사진이 함께 사라져요" onPress={run(onDelete)} colors={colors} danger />
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

function Item({ label, description, onPress, colors, danger = false }: {
  label: string;
  description: string;
  onPress: () => void;
  colors: { line: string; text: string; textMuted: string; danger: string };
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
    >
      <Text style={[typeScale.bodyStrong, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 58, paddingRight: spacing.md },
  sheet: { width: 280, borderWidth: hairline, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  paperRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  item: { paddingVertical: spacing.sm, borderBottomWidth: hairline, gap: 2 },
});
