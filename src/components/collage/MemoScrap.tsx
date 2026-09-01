import { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

/** 오려 붙인 메모 조각 — 점선 테두리에 살짝 기울어진 종잇조각. */
export function MemoScrap({ children, rotate = 1.5, style }: {
  children: ReactNode;
  /** 기울기(도). */
  rotate?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceDeep,
          // dashed 는 서브픽셀 두께에서 실선처럼 뭉개진다 — hairline 대신 1px 고정.
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.lineStrong,
          borderRadius: radius.sm,
          padding: spacing.md,
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
