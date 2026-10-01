import { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

/**
 * 오려 붙인 메모 조각 — 점선 테두리에 살짝 기울어진 종잇조각.
 * `ruled` 는 활자·괘선 판면(클럽 홈)용: 기울이지 않고 괘선 한 겹만 두른 평평한 메모.
 */
export function MemoScrap({ children, rotate = 1.5, variant = 'scrap', style }: {
  children: ReactNode;
  /** 기울기(도). ruled 에서는 무시한다. */
  rotate?: number;
  variant?: 'scrap' | 'ruled';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const ruled = variant === 'ruled';

  return (
    <View
      style={[
        {
          backgroundColor: ruled ? 'transparent' : colors.surfaceDeep,
          // dashed 는 서브픽셀 두께에서 실선처럼 뭉개진다 — hairline 대신 1px 고정.
          borderWidth: 1,
          borderStyle: ruled ? 'solid' : 'dashed',
          borderColor: colors.lineStrong,
          borderRadius: radius.sm,
          padding: ruled ? spacing.lg : spacing.md,
          transform: [{ rotate: `${ruled ? 0 : rotate}deg` }],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
