import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { challengeApi } from '@/api/endpoints';
import type { Challenge } from '@/api/types';
import { Confetti } from '@/components/Confetti';
import { ConfirmButton } from '@/components/ConfirmButton';
import { useRemainingSec } from '@/components/home/ChallengeRow';
import { formatClock } from '@/components/ui';
import { layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 챌린지 진행 — 타임워치·일시정지/재개·쪽수 기록·성공 폭죽·실패 재도전. */
export default function ChallengeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const challengeId = Number(id);

  const query = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => challengeApi.get(challengeId),
    enabled: Number.isFinite(challengeId),
  });
  const challenge = query.data;
  const remaining = useRemainingSec(challenge, query.dataUpdatedAt);

  // 로컬 티크가 0에 닿으면 서버로 확정(FAILED 판정은 서버가)
  useEffect(() => {
    if (challenge?.status === 'ACTIVE' && challenge.running && remaining === 0) {
      query.refetch();
    }
  }, [remaining, challenge?.status, challenge?.running]);

  const setCache = (c: Challenge) => {
    queryClient.setQueryData(['challenge', challengeId], c);
    queryClient.invalidateQueries({ queryKey: ['challenges', 'active'] });
  };
  const toggle = useMutation({
    mutationFn: () => (challenge?.running ? challengeApi.pause(challengeId) : challengeApi.start(challengeId)),
    onSuccess: setCache,
  });

  const [pageInput, setPageInput] = useState('');
  useEffect(() => {
    if (challenge && pageInput === '') {
      setPageInput(String(challenge.currentPage));
    }
  }, [challenge]);

  const progress = useMutation({
    mutationFn: () => challengeApi.progress(challengeId, Number(pageInput)),
    onSuccess: (c) => {
      setCache(c);
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => challengeApi.cancel(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges', 'active'] });
      router.back();
    },
  });

  const errorMessage = [toggle, progress, cancel]
    .map((m) => (m.isError && !m.isPending
      ? m.error instanceof ApiError ? m.error.message : '처리하지 못했어요 · 다시 시도'
      : null))
    .find((v) => v != null) ?? null;

  if (!challenge) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]} />;
  }

  const succeeded = challenge.status === 'SUCCEEDED';
  const failed = challenge.status === 'FAILED';
  const active = challenge.status === 'ACTIVE';
  const usedSec = challenge.budgetSec - challenge.remainingSec;
  const ratio = challenge.budgetSec > 0 ? remaining / challenge.budgetSec : 0;
  const gaugeColor = ratio < 0.2 ? colors.warn : colors.accent;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text numberOfLines={1} style={[typeScale.title, { color: colors.text, textAlign: 'center' }]}>
          {challenge.book?.title}
        </Text>

        {succeeded ? (
          <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.display, { color: colors.text, textAlign: 'center' }]}>완독! 🎉</Text>
            <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {formatClock(usedSec)} 만에 {challenge.totalPages}쪽을 읽었어요.
            </Text>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}>
              <Text style={[typeScale.label, { color: colors.onAccent }]}>홈으로</Text>
            </Pressable>
          </View>
        ) : failed ? (
          <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.display, { color: colors.text, textAlign: 'center' }]}>시간이 다 됐어요</Text>
            <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {challenge.currentPage}/{challenge.totalPages}쪽까지 읽었어요. 다시 도전해볼까요?
            </Text>
            <Pressable
              onPress={() =>
                router.replace(`/challenge/new?recordId=${challenge.readingRecordId}&budgetSec=${challenge.budgetSec}`)}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>재도전</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
              style={[styles.cta, { borderWidth: 1, borderColor: colors.lineStrong }]}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>홈으로</Text>
            </Pressable>
          </View>
        ) : challenge.status === 'CANCELLED' ? (
          <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.display, { color: colors.text, textAlign: 'center' }]}>포기한 챌린지예요</Text>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}>
              <Text style={[typeScale.label, { color: colors.onAccent }]}>홈으로</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.clock, { fontFamily: sans.extraBold, color: colors.text }]}>
              {formatClock(remaining)}
            </Text>
            <View style={[styles.gauge, { backgroundColor: colors.line }]}>
              <View style={[styles.gaugeFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: gaugeColor }]} />
            </View>
            <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              예산 {formatClock(challenge.budgetSec)} 중 남은 시간
            </Text>

            <Pressable
              disabled={toggle.isPending}
              onPress={() => toggle.mutate()}
              accessibilityRole="button"
              style={[styles.cta, {
                backgroundColor: challenge.running ? colors.surfaceRaised : colors.accent,
                opacity: toggle.isPending ? 0.6 : 1,
              }]}
            >
              <Text style={[typeScale.label, { color: challenge.running ? colors.text : colors.onAccent }]}>
                {challenge.running ? '⏸ 일시정지' : '▶ 재개'}
              </Text>
            </Pressable>

            <View style={[styles.pageCard, { backgroundColor: colors.surface }]}>
              <Text style={[typeScale.overline, { color: colors.accent }]}>지금 몇 쪽인가요?</Text>
              <View style={styles.pageRow}>
                <TextInput
                  value={pageInput}
                  onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={[styles.pageInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
                />
                <Text style={[typeScale.body, { color: colors.textMuted }]}>/ {challenge.totalPages}쪽</Text>
                <Pressable
                  disabled={progress.isPending || pageInput.trim() === '' || !Number.isFinite(Number(pageInput))}
                  onPress={() => progress.mutate()}
                  accessibilityRole="button"
                  style={[styles.recordButton, {
                    backgroundColor: colors.accent,
                    opacity: progress.isPending || pageInput.trim() === '' || !Number.isFinite(Number(pageInput)) ? 0.5 : 1,
                  }]}
                >
                  <Text style={[typeScale.label, { color: colors.onAccent }]}>기록</Text>
                </Pressable>
              </View>
            </View>

            <ConfirmButton
              label="포기하기"
              question="정말 포기할까요?"
              tone="danger"
              variant="ghost"
              pending={cancel.isPending}
              onConfirm={() => cancel.mutate()}
            />
          </>
        )}

        {errorMessage && active ? (
          <Text style={[typeScale.caption, { color: colors.warn, textAlign: 'center' }]}>{errorMessage}</Text>
        ) : null}
      </ScrollView>
      <Confetti run={succeeded} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  clock: { fontSize: 56, textAlign: 'center', letterSpacing: 1 },
  gauge: { height: 6, borderRadius: radius.none, overflow: 'hidden' },
  gaugeFill: { height: 6 },
  cta: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  resultCard: { borderRadius: radius.md, padding: spacing.xl, gap: spacing.md },
  pageCard: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageInput: { width: 88, borderRadius: radius.md, padding: spacing.md, fontSize: 18, textAlign: 'center' },
  recordButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, marginLeft: 'auto' },
});
