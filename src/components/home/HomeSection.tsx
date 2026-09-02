import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, spacing } from '@/theme/tokens';

/**
 * 서가 섹션 틀 — 가는 괘선 하나로 앞 섹션과 나눈 뒤 그 밑에 행(제목 포함)을 앉힌다.
 * 행들이 한 장에 흘러 붙어 섹션이 안 나뉜다는 피드백에서 나왔다. 처음엔 괘선 아래 모노
 * 번호·라벨(`01 — LIVE`)까지 뒀지만 군더더기라는 피드백으로 괘선만 남겼다.
 */
export function HomeSection({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.rule, { backgroundColor: colors.lineStrong }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 괘선 위·아래 여백을 비슷하게 — 위는 컨테이너 gap(24)+4=28, 아래는 제목까지 20(행간 여유 포함 ≈24).
  wrap: { paddingTop: spacing.xs },
  rule: { height: hairline, marginHorizontal: spacing.lg, marginBottom: 20 },
});
