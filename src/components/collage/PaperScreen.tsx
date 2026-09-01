import { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { DotGridBackground } from './DotGridBackground';

/**
 * 콜라주 화면 셸 — 배경색 + 도트 종이 질감.
 * 스크롤은 각 화면이 직접 만든다(여기서 ScrollView 를 두지 않는다).
 * withTopInset: 네이티브 헤더가 없는 화면에서 상단 세이프에어리어를 직접 밀어줄 때만.
 */
export function PaperScreen({ children, withTopInset = false, style }: {
  children: ReactNode;
  withTopInset?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg },
        withTopInset ? { paddingTop: insets.top } : null,
        style,
      ]}
    >
      <DotGridBackground />
      {children}
    </View>
  );
}
