import { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

/**
 * 스티키 노트 — 책상에 비스듬히 붙인 민트 메모지.
 * 안쪽 텍스트 색은 사용처에서 colors.onNote 로 지정한다.
 */
export function StickyNote({ children, rotate = -2, style }: {
  children: ReactNode;
  /** 기울기(도). */
  rotate?: number;
  style?: ViewStyle;
}) {
  const { colors, cardShadow } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.note,
          padding: spacing.md,
          borderRadius: radius.sm,
          transform: [{ rotate: `${rotate}deg` }],
        },
        cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
