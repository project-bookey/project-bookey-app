import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * 도트 종이 질감 — 웹 전용.
 * 네이티브는 react-native-svg 로 그리지만, 이 패키지의 SVG 엘리먼트가 항상
 * Fabric 코드젠 네이티브 컴포넌트(`codegenNativeComponent`)를 직접 import 해
 * Expo 웹 번들러가 이를 네이티브 전용 모듈로 판단해 빌드를 막는다
 * (react-native-svg 15.x, Expo SDK 57 조합에서 확인됨).
 * 웹에서는 react-native-svg 를 아예 불러오지 않고 CSS radial-gradient 로
 * 같은 16px 간격 1px 점 패턴을 재현한다.
 */
export function DotGridBackground({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundImage: `radial-gradient(circle, ${colors.dotGrid} 1px, transparent 1px)`,
          backgroundSize: '16px 16px',
        } as unknown as ViewStyle,
        style,
      ]}
    />
  );
}
