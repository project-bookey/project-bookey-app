import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingRecord } from '@/api/types';
import { darkColors, radius, spacing, typeScale, useTheme } from '@/theme';

const HERO_H = 360;

/**
 * 풀블리드 히어로 — 표지를 확대·블러해 배경으로 깔고 스크림 위에 정보·CTA.
 * 항상 어두운 영역이므로 오버레이 색은 darkColors 고정.
 */
export function HeroContinue({ record, streakLine, loading, onContinue, onDetail, onSearch }: {
  record: ReadingRecord | null;
  streakLine?: string;
  loading?: boolean;
  onContinue: (record: ReadingRecord) => void;
  onDetail: (record: ReadingRecord) => void;
  onSearch: () => void;
}) {
  const { colors } = useTheme();

  if (loading) {
    return <View style={[styles.hero, { backgroundColor: colors.surface }]} />;
  }

  if (!record) {
    return (
      <View style={[styles.hero, styles.onboarding, { backgroundColor: colors.surface }]}>
        <Text style={[typeScale.title, { color: colors.text, textAlign: 'center' }]}>
          첫 책을 찾아보세요
        </Text>
        <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
          책을 등록하고 목표일을 정하면{'\n'}페이스가 밀릴 때 알려드립니다.
        </Text>
        <Pressable onPress={onSearch} style={[styles.cta, { backgroundColor: colors.accent }]}>
          <Text style={[typeScale.label, { color: colors.onAccent }]}>책 찾기</Text>
        </Pressable>
      </View>
    );
  }

  const progress = record.progress.completionRate ?? 0;
  const hasPages = record.progress.totalPages > 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: darkColors.surfaceRaised }]}>
        {record.book?.coverUrl ? (
          <Image
            source={{ uri: record.book.coverUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={16}
          />
        ) : null}
        <LinearGradient
          colors={[...darkColors.scrimStops]}
          start={{ x: 0, y: 0.15 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.info}>
          <Text style={[typeScale.overline, { color: darkColors.accent }]}>이어 읽기</Text>
          <Text numberOfLines={2} style={[typeScale.display, { color: darkColors.text }]}>
            {record.book?.title}
          </Text>
          <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
            {record.book?.author ?? '저자 미상'}
            {hasPages
              ? ` · ${record.progress.currentPage}/${record.progress.totalPages}쪽 · ${Math.round(progress * 100)}%`
              : ''}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => onContinue(record)} style={[styles.cta, { backgroundColor: darkColors.accent }]}>
              <Text style={[typeScale.label, { color: darkColors.onAccent }]}>▶ 이어서 읽기</Text>
            </Pressable>
            <Pressable onPress={() => onDetail(record)} style={[styles.cta, styles.ghost]}>
              <Text style={[typeScale.label, { color: darkColors.text }]}>상세</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {streakLine ? (
        <Text style={[typeScale.caption, { color: colors.textMuted, paddingHorizontal: spacing.lg }]}>
          {streakLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hero: {
    height: HERO_H,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  onboarding: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  info: { padding: spacing.lg, gap: spacing.xs },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.none,
    marginVertical: spacing.sm,
  },
  fill: { height: 3, backgroundColor: darkColors.accent },
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ghost: { borderWidth: 1, borderColor: darkColors.lineStrong },
});
