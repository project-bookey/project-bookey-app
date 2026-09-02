import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, libraryApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Button, Card, Eyebrow, Field, Rule, Segmented, Toggle } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

const DURATIONS = [
  { value: '2', label: '2주' },
  { value: '4', label: '4주' },
  { value: '6', label: '6주' },
  { value: '8', label: '8주' },
] as const;

/** 모임 만들기 (§12.1) — 책 선택 → 기간 → 체크포인트 → 공개 범위 */
export default function ClubCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bookId, setBookId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<'2' | '4' | '6' | '8'>('4');
  const [memberLimit, setMemberLimit] = useState('6');
  const [autoCheckpoints, setAutoCheckpoints] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const library = useQuery({ queryKey: ['library', 'all'], queryFn: () => libraryApi.list() });
  const candidates = useMemo(() => {
    const byBookId = new Map<number, ReadingRecord>();
    for (const record of library.data?.content ?? []) {
      const id = record.book?.id;
      if (id != null && !byBookId.has(id)) {
        byBookId.set(id, record);
      }
    }
    return [...byBookId.values()];
  }, [library.data?.content]);

  const today = new Date();
  const endsAt = new Date(today.getTime() + Number(weeks) * 7 * 86400000);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);

  const create = useMutation({
    mutationFn: () =>
      clubApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        bookId: bookId!,
        startsAt: toIso(today),
        endsAt: toIso(endsAt),
        visibility: isPublic ? 'PUBLIC' : 'CODE_ONLY',
        memberLimit: Number(memberLimit) || 6,
        autoCheckpoints,
      }),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace(`/club/${club.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '모임을 만들지 못했습니다.'),
  });

  const canSubmit = name.trim().length > 0 && bookId !== null;

  return (
    <PaperScreen>
      <SubHeader category="모임 만들기" />

      <ScrollView contentContainerStyle={styles.container}>
        <Field
          label="모임 이름"
          value={name}
          onChangeText={setName}
          placeholder="예: 회사 독서 모임"
          maxLength={60}
        />
        <Field
          label="소개 (선택)"
          value={description}
          onChangeText={setDescription}
          placeholder="어떤 모임인지 한 줄로"
          multiline
        />

        <View>
          <Eyebrow>선정 도서</Eyebrow>
          <Text style={[styles.helper, { color: colors.textFaint }]}>
            내 서재의 책 중에서 고릅니다.
          </Text>
          <View style={[styles.bookList, { borderColor: colors.line }]}>
            {candidates.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textFaint }]}>
                서재가 비어 있어요. 먼저 책을 검색해 담아주세요.
              </Text>
            ) : null}
            {candidates.map((record: ReadingRecord) => {
              const selected = record.book!.id === bookId;
              return (
                <Pressable
                  key={record.book!.id}
                  onPress={() => setBookId(record.book!.id)}
                  style={[
                    styles.bookRow,
                    { borderBottomColor: colors.line, backgroundColor: colors.surface },
                    selected && { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <TiltCover
                    uri={record.book?.coverUrl}
                    title={record.book?.title}
                    width={38}
                    tilt={0}
                    entering={false}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[typeScale.label, { color: colors.text }]}>
                      {record.book?.title}
                    </Text>
                    <Text style={[styles.bookMeta, { color: colors.textFaint }]}>
                      {record.book?.totalPages ? `${record.book.totalPages}쪽` : '페이지 수 미상'}
                      {record.book?.author ? ` · ${record.book.author}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: colors.textFaint },
                      selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Eyebrow>기간</Eyebrow>
          <View style={{ marginTop: spacing.sm }}>
            <Segmented
              options={DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
              value={weeks}
              onChange={(v) => setWeeks(v as typeof weeks)}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textFaint }]}>
            {toIso(today)} → {toIso(endsAt)}
          </Text>
        </View>

        <Field
          label="정원"
          value={memberLimit}
          onChangeText={(text) => setMemberLimit(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          hint="2~50명. 소규모일수록 완독률이 높다는 가설을 검증 중입니다."
        />

        <Card style={{ gap: spacing.md }}>
          <Toggle
            label="주차별 체크포인트 자동 생성"
            description="총 페이지를 주차 수로 균등 분배해 목표를 만듭니다."
            value={autoCheckpoints}
            onChange={setAutoCheckpoints}
          />
          <Rule />
          <Toggle
            label="공개 모임"
            description={
              isPublic
                ? '발견 탭에 노출되고 누구나 참가할 수 있습니다.'
                : '초대 코드를 아는 사람만 참가할 수 있습니다.'
            }
            value={isPublic}
            onChange={setIsPublic}
          />
        </Card>

        {error ? (
          <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <Button
          label="모임 만들기"
          disabled={!canSubmit}
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  helper: { ...typeScale.caption, marginTop: spacing.sm },
  bookList: {
    marginTop: spacing.sm,
    borderWidth: hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: hairline,
  },
  bookMeta: { ...typeScale.caption, marginTop: 2 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: hairline,
  },
  empty: { ...typeScale.caption, padding: spacing.lg },
});
