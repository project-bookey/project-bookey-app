import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { challengeApi } from '@/api/endpoints';
import type { Challenge } from '@/api/types';
import { formatClock } from '@/components/ui';
import { radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 서버 remainingSec 스냅샷 + 로컬 1초 티크 — 표시 전용, 판정은 서버. */
export function useRemainingSec(challenge: Challenge | undefined, dataUpdatedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  const running = challenge?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  if (!challenge) return 0;
  const drift = running ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)) : 0;
  return Math.max(0, challenge.remainingSec - drift);
}

function ChallengeCard({ challenge, dataUpdatedAt }: { challenge: Challenge; dataUpdatedAt: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const remaining = useRemainingSec(challenge, dataUpdatedAt);
  return (
    <Pressable
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      accessibilityRole="button"
      accessibilityLabel={challenge.book?.title ?? '챌린지'}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
        {challenge.book?.coverUrl ? (
          <Image source={{ uri: challenge.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text numberOfLines={3} style={[typeScale.caption, { color: colors.textMuted, padding: spacing.xs }]}>
            {challenge.book?.title}
          </Text>
        )}
      </View>
      <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
        {challenge.book?.title}
      </Text>
      <Text style={[{ fontFamily: sans.extraBold, fontSize: 18 }, { color: colors.accent }]}>
        {formatClock(remaining)}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>
        {challenge.running ? '▶ 진행 중' : '⏸ 일시정지'} · {challenge.currentPage}/{challenge.totalPages}쪽
      </Text>
    </Pressable>
  );
}

/** 홈 챌린지 섹션 — 진행 중 카드 + 맨 끝 '+ 새 챌린지' 타일. 0건이어도 유지. */
export function ChallengeRow() {
  const router = useRouter();
  const { colors } = useTheme();
  const challenges = useQuery({ queryKey: ['challenges', 'active'], queryFn: challengeApi.active });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>챌린지</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={challenges.data ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/challenge/new')}
            accessibilityRole="button"
            accessibilityLabel="새 챌린지"
            style={[styles.card, styles.createTile, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.title, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>새 챌린지</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <ChallengeCard challenge={item} dataUpdatedAt={challenges.dataUpdatedAt} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { width: 150, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  cover: { width: 52, height: 78, borderRadius: radius.sm, overflow: 'hidden' },
  createTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
});
