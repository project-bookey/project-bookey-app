import { Pressable, StyleSheet, Text } from 'react-native';
import { Heart } from 'lucide-react-native';

import { iconStroke, pressedStyle, typeScale, useTheme } from '@/theme';

/**
 * 독후감 좋아요 — 하트 + 숫자. 카드 푸터와 상세 액션 행이 같은 모양·같은 크기로 쓴다.
 * 켜지면 초록으로 채운다(좋아요 하트는 사용자 결정으로 둔 악센트 예외). 획은 다른 선 아이콘처럼 각지게(iconStroke).
 */
export function LikeAction({ count, liked, onPress }: {
  count: number;
  liked: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const color = liked ? colors.accent : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={`좋아요 ${count}`}
      style={({ pressed }) => [styles.action, pressed ? pressedStyle : null]}
    >
      <Heart size={22} color={color} fill={liked ? color : 'transparent'} {...iconStroke} />
      <Text style={[styles.count, { color }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44pt 상자 — 웹은 hitSlop 을 무시하므로 상자를 진짜로 키운다. 위아래는 음수 마진으로 되돌려 행의 리듬은 그대로 둔다.
  action: {
    minWidth: 44,
    minHeight: 44,
    marginVertical: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: { ...typeScale.monoNumeral },
});
