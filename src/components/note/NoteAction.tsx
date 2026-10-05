import { Pressable, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { controlFace, iconSize, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 동작 버튼 높이 — 선택 프레임이 요소 위로 띄울 거리를 잴 때도 쓴다. */
export const NOTE_ACTION_HEIGHT = 44;

/**
 * 캔버스 위에 뜨는 작은 동작 버튼 — 선택 프레임의 맨 앞으로·편집·삭제, 업로드 실패 사진의 다시·지우기.
 * 면은 공용 FootAction 과 같은 회색 톤(위험은 연한 빨강)에 control 모서리.
 * icon 을 주면 아이콘만 그리고 label 은 읽어 줄 말이 된다(2026-10-05 사용자 결정 — 연필·휴지통·다시처럼 아이콘만 봐도 알 만한 동작).
 */
export function NoteAction({ label, icon: Icon, onPress, tone = 'default' }: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const { colors } = useTheme();
  const fg = tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        Icon ? styles.iconOnly : null,
        controlFace(tone === 'danger' ? colors.dangerSoft : colors.tonal),
        pressed ? pressedStyle : null,
      ]}
    >
      {Icon ? (
        <Icon size={iconSize.inline} color={fg} {...iconStroke} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 캔버스 위에 떠서 hitSlop 을 넓히면 옆 요소·핸들과 겹치기 쉽다 — 실제 상자를 44pt 로 키운다(UX 철칙 Fitts).
  action: {
    minHeight: NOTE_ACTION_HEIGHT,
    minWidth: NOTE_ACTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
  },
  // 아이콘만이면 정사각(44pt).
  iconOnly: { paddingHorizontal: 0 },
  label: { ...typeScale.label, fontSize: 12 },
});
