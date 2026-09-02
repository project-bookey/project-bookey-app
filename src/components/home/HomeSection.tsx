import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, spacing, typeScale } from '@/theme/tokens';

/**
 * 서가 섹션 틀 — 가는 괘선 아래 모노 번호·라벨 아이브로우(`01 — LIVE`)를 두고 그 밑에 행을 앉힌다.
 * 행들이 한 장에 흘러 붙어 섹션이 안 나뉜다는 피드백에서 나온 잡지 목차식 구분(시안 A).
 * 번호는 화면 순서 그대로 사용처가 넘긴다 — 섹션을 옮기면 번호도 같이 고친다.
 */
export function HomeSection({ index, label, children }: {
  /** 화면 순서(1부터). 두 자리로 찍는다. */
  index: number;
  /** 모노 라벨 — LIVE · PLAZA · PICK 같은 짧은 영문 */
  label: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.rule, { backgroundColor: colors.lineStrong }]} />
      <Text style={[typeScale.monoEyebrow, styles.eyebrow, { color: colors.textFaint }]}>
        {String(index).padStart(2, '0')} — <Text style={{ color: colors.accent }}>{label}</Text>
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 괘선 위·아래 여백을 비슷하게 — 위는 컨테이너 gap(24)+4=28, 아래는 아이브로우까지 22.
  // (처음 14/24 는 괘선이 제목에 붙어 답답했고, 40/14 는 위만 벌어져 비율이 안 맞았다.)
  wrap: { paddingTop: spacing.xs },
  rule: { height: hairline, marginHorizontal: spacing.lg },
  eyebrow: { fontSize: 9, letterSpacing: 2.2, marginHorizontal: spacing.lg, marginTop: 22, marginBottom: 6 },
});
