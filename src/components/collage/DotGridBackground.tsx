import { useId } from 'react';
import { StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * 도트 종이 질감 — 16px 간격 1px 점.
 * View 를 수백 개 반복하지 않고 SVG Pattern 한 장(=네이티브 뷰 1개)으로 그린다.
 * 한 화면에 여러 장이 겹쳐도 충돌하지 않도록 pattern id 는 useId 로 고유화한다.
 */
export function DotGridBackground({ style }: { style?: ViewStyle }) {
  // useId 결과에는 콜론·guillemet 등 SVG id 로 못 쓰는 문자가 섞이므로 걸러낸다.
  const patternId = `dotgrid${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { colors } = useTheme();

  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <Pattern id={patternId} width={16} height={16} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill={colors.dotGrid} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}
