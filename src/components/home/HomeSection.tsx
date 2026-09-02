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
  // 앞 섹션 행과 괘선 사이 — 컨테이너 gap(24)에 16을 더해 40px. 24만으로는 답답하다는 피드백.
  wrap: { paddingTop: spacing.lg },
  rule: { height: hairline, marginHorizontal: spacing.lg },
  // 시안: 괘선 14px 아래 아이브로우, 그 6px 아래 세리프 제목(행 헤더).
  eyebrow: { fontSize: 9, letterSpacing: 2.2, marginHorizontal: spacing.lg, marginTop: 14, marginBottom: 6 },
});
