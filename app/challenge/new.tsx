import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { challengeApi, libraryApi } from '@/api/endpoints';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 새 챌린지 — 읽는 중 책 선택 + 예산(시간·분) 입력. 재도전 프리필 지원. */
export default function NewChallengeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ recordId?: string; budgetSec?: string }>();

  const [recordId, setRecordId] = useState<number | null>(
    params.recordId ? Number(params.recordId) : null,
  );
  const preBudget = params.budgetSec ? Number(params.budgetSec) : 0;
  const [hours, setHours] = useState(preBudget ? String(Math.floor(preBudget / 3600)) : '');
  const [minutes, setMinutes] = useState(preBudget ? String(Math.floor((preBudget % 3600) / 60)) : '');

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const records = reading.data?.content ?? [];

  const budgetSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
  const valid = recordId != null && budgetSec >= 600;

  const create = useMutation({
    mutationFn: () => challengeApi.create({ readingRecordId: recordId!, budgetSec }),
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      router.replace(`/challenge/${challenge.id}`);
    },
  });
  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError ? create.error.message : '만들지 못했어요 · 다시 시도'
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={records}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[typeScale.section, { color: colors.text, marginBottom: spacing.sm }]}>
            어떤 책으로 도전할까요?
          </Text>
        }
        ListEmptyComponent={
          reading.isLoading ? null : (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              읽는 중인 책이 없어요. 서재에서 책을 먼저 시작해주세요.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const selected = item.id === recordId;
          return (
            <Pressable
              onPress={() => setRecordId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.book?.title ?? '책'}
              style={[
                styles.row,
                { backgroundColor: colors.surface },
                selected && { borderWidth: 1, borderColor: colors.accent },
              ]}
            >
              <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
                {item.book?.coverUrl ? (
                  <Image source={{ uri: item.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {item.book?.title}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                  {item.progress.currentPage}/{item.progress.totalPages}쪽
                </Text>
              </View>
              {selected ? <Text style={[typeScale.label, { color: colors.accent }]}>✓</Text> : null}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={[typeScale.section, { color: colors.text }]}>예산 시간</Text>
            <View style={styles.budgetRow}>
              <TextInput
                value={hours}
                onChangeText={(t) => setHours(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
              />
              <Text style={[typeScale.body, { color: colors.textMuted }]}>시간</Text>
              <TextInput
                value={minutes}
                onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
              />
              <Text style={[typeScale.body, { color: colors.textMuted }]}>분</Text>
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>최소 10분부터 시작할 수 있어요.</Text>
            {errorMessage ? (
              <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
            ) : null}
            <Pressable
              disabled={!valid || create.isPending}
              onPress={() => create.mutate()}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent, opacity: !valid || create.isPending ? 0.5 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>
                {create.isPending ? '만드는 중…' : '⏱ 챌린지 시작'}
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { ...layout.content, padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cover: { width: 40, height: 60, borderRadius: radius.sm, overflow: 'hidden' },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetInput: {
    width: 72,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 18,
    textAlign: 'center',
  },
  cta: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
});
