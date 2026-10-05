import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { ICON_SIZE, IconButton } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { iconStroke, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/**
 * 노트 도구 공용 하단 시트 — 텍스트·말풍선 편집, 스티커 고르기. 바탕을 누르면 닫힌다.
 * 키보드가 뜨면 시트가 그 위로 올라온다. 입력이 있는 시트는 scroll 을 켠다 — 작은 폰에서 키보드 위 자리가 모자라도
 * 시트 안을 굴려 '완료'에 닿는다(목록을 품은 시트는 안쪽 목록이 스스로 스크롤하므로 끈 채로 둔다).
 * closeButton 을 켜면 제목 줄 오른쪽에 × 아이콘 버튼을 둔다 — '닫기' 글자 버튼 대신(2026-10-05 사용자 결정).
 */
export function NoteSheet({ visible, title, onClose, onDismiss, scroll = false, closeButton = false, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** 닫힘 애니메이션이 끝난 뒤 — iOS 에서만 불린다(RN Modal 의 onDismiss). 닫고 화면을 넘길 때 쓴다. */
  onDismiss?: () => void;
  scroll?: boolean;
  /** 제목 줄 오른쪽 × — 바탕 누르기 말고는 닫을 길이 안 보이는 시트(채팅 이용권 선물)에서 켠다. */
  closeButton?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <KeyboardArea style={styles.fill}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrimDim }]} onPress={onClose} accessibilityLabel="닫기" />
        <KeyboardDock stacked style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
          {closeButton ? (
            <View style={styles.titleRow}>
              <Text style={[typeScale.monoEyebrow, styles.title, { color: colors.textFaint }]}>{title}</Text>
              <View style={styles.close}>
                <IconButton onPress={onClose} accessibilityLabel="닫기">
                  <X size={ICON_SIZE} color={colors.text} {...iconStroke} />
                </IconButton>
              </View>
            </View>
          ) : (
            <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>{title}</Text>
          )}
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
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  // × 상자(44pt)의 여백만큼 위·오른쪽으로 내밀어 제목 줄 높이를 키우지 않는다.
  close: { marginVertical: -14, marginRight: -10 },
  // 내용이 85% 를 넘으면 줄어들어 안에서 스크롤한다.
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: spacing.md },
});
