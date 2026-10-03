import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  BackHandler, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { clubApi, libraryApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Button, Eyebrow, Field, Loading, Segmented, Toggle, linkLabel } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';

/** 무료 정원은 3명까지 — 더 필요하면 만든 뒤 클럽 홈에서 책갈피로 자리를 늘린다(서버가 같은 상한을 검사한다). */
const MEMBER_LIMITS = [
  { value: '2', label: '2명' },
  { value: '3', label: '3명' },
] as const;

const DURATIONS = [
  { value: '2', label: '2주' },
  { value: '4', label: '4주' },
  { value: '6', label: '6주' },
  { value: '8', label: '8주' },
] as const;

/** 단계 이름 — 위 '1 / 3 · 책' 표기에 쓴다. */
const STEPS = ['책', '기간·정원', '이름·공개'] as const;

/**
 * 클럽 만들기 (§12.1) — ① 책 고르기 → ② 기간·정원 → ③ 이름·소개·공개 설정.
 * 한 화면에 모든 선택지를 펼치지 않고 단계마다 하나씩 고르게 한다(UX 철칙 Hick).
 * 클럽 탭·홈 클럽 줄 모두 이 화면으로 들어온다.
 */
export default function ClubCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bookId, setBookId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<'2' | '4' | '6' | '8'>('4');
  const [memberLimit, setMemberLimit] = useState<'2' | '3'>('3');
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
        memberLimit: Number(memberLimit),
        autoCheckpoints,
      }),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace(`/club/${club.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '클럽을 만들지 못했습니다.'),
  });

  const canSubmit = name.trim().length > 0 && bookId !== null;

  const last = step === STEPS.length - 1;
  // 단계마다 채워야 넘어간다 — 기간·정원은 기본값이 골라져 있어 늘 넘어갈 수 있다.
  const stepReady = step === 0 ? bookId !== null : step === 1 ? true : canSubmit;
  const goPrev = () => setStep((s) => Math.max(0, s - 1));
  // 빠른 연타로 마지막 단계를 넘지 않게 끝에서 멈춘다.
  const goNext = () => (last ? create.mutate() : setStep((s) => Math.min(STEPS.length - 1, s + 1)));

  // 안드로이드 뒤로 버튼도 위 화살표처럼 한 단계씩 되돌린다 — 화면째 닫혀 고른 값이 날아가지 않게.
  useFocusEffect(
    useCallback(() => {
      if (step === 0) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setStep((s) => Math.max(0, s - 1));
        return true;
      });
      return () => sub.remove();
    }, [step]),
  );

  // 단계 표기 — 뮤트 모노 한 줄. 아래 섹션 아이브로우보다 한 톤 흐리게 두어 위계를 나눈다.
  const stepLabel = (
    <Text
      style={[typeScale.monoEyebrow, { color: colors.textFaint }]}
      accessibilityLabel={`${STEPS.length}단계 중 ${step + 1}단계, ${STEPS[step]}`}
    >
      {step + 1} / {STEPS.length} · {STEPS[step]}
    </Text>
  );

  const renderBook = ({ item: record }: { item: ReadingRecord }) => {
    const selected = record.book!.id === bookId;
    return (
      <Pressable
        onPress={() => setBookId(record.book!.id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.bookRow,
          {
            borderBottomColor: colors.line,
            backgroundColor: selected ? colors.surfaceRaised : colors.surface,
            borderLeftColor: selected ? colors.ink : 'transparent',
          },
          pressed ? pressedStyle : null,
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
          <Text numberOfLines={1} style={[styles.bookMeta, { color: colors.textFaint }]}>
            {record.book?.totalPages ? `${record.book.totalPages}쪽` : '페이지 수 미상'}
            {record.book?.author ? ` · ${record.book.author}` : ''}
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: colors.ink, borderColor: colors.ink }
              : { borderColor: colors.textFaint },
          ]}
        />
      </Pressable>
    );
  };

  return (
    <PaperScreen>
      {/* 2·3단계의 뒤로는 앞 단계로 — 1단계에서만 화면을 닫는다. */}
      <SubHeader category="클럽 만들기" onBack={step > 0 ? goPrev : undefined} />

      {/* 오프셋 없음 — 헤더가 없어 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(독후감 쓰기와 같은 이유). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 0 ? (
          // ① 책 — 목록 상자만 스크롤한다. 서재가 길어도 상자가 남은 높이 안에서 줄어 하단 띠를 밀어내지 않는다.
          <View style={styles.pickStep}>
            {stepLabel}
            <Text style={[styles.helper, { color: colors.textFaint }]}>
              내 서재의 책 중에서 고릅니다.
            </Text>
            <View style={[styles.bookList, { borderColor: colors.line }]}>
              <FlatList
                data={candidates}
                extraData={bookId}
                keyExtractor={(record) => String(record.book!.id)}
                renderItem={renderBook}
                ListEmptyComponent={
                  library.isLoading ? (
                    <View style={styles.pending}>
                      <Loading />
                    </View>
                  ) : library.isError ? (
                    <View style={styles.emptyRow}>
                      <Text style={[typeScale.caption, styles.emptyText, { color: colors.textFaint }]}>
                        서재를 불러오지 못했어요.
                      </Text>
                      <Button label={linkLabel('다시 시도', 'action')} variant="ghost" onPress={() => library.refetch()} />
                    </View>
                  ) : (
                    <Text style={[styles.empty, { color: colors.textFaint }]}>
                      서재가 비어 있어요. 먼저 책을 검색해 담아주세요.
                    </Text>
                  )
                }
              />
            </View>
          </View>
        ) : (
          // 단계가 바뀌면 스크롤을 맨 위에서 다시 시작한다(key).
          <ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
            {stepLabel}

            {step === 1 ? (
              <>
                {/* ② 기간·정원 — 기본값(4주 · 3명)이 골라져 있어 그대로 넘어가도 된다. */}
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

                <View>
                  <Eyebrow>정원</Eyebrow>
                  <View style={{ marginTop: spacing.sm }}>
                    <Segmented
                      options={MEMBER_LIMITS.map((m) => ({ value: m.value, label: m.label }))}
                      value={memberLimit}
                      onChange={(v) => setMemberLimit(v as typeof memberLimit)}
                    />
                  </View>
                  <Text style={[styles.helper, { color: colors.textFaint }]}>
                    호스트 포함 3명까지 무료예요. 더 필요하면 클럽을 만든 뒤 책갈피로 자리를 늘릴 수 있어요.
                  </Text>
                </View>

                {/* 체크포인트는 기간을 주차로 나누는 설정이라 기간 옆에 둔다(UX 철칙 Proximity). */}
                <View style={[styles.options, { borderTopColor: colors.line }]}>
                  <Toggle
                    label="주차별 체크포인트 자동 생성"
                    description="총 페이지를 주차 수로 균등 분배해 목표를 만듭니다."
                    value={autoCheckpoints}
                    onChange={setAutoCheckpoints}
                  />
                </View>
              </>
            ) : (
              <>
                {/* ③ 이름·소개 — 한 묶음이라 md 로 붙이고, 아래 옵션과는 섹션 간격(xl)으로 띄운다. */}
                <View style={styles.fields}>
                  <Field
                    label="클럽 이름"
                    value={name}
                    onChangeText={setName}
                    placeholder="예: 회사 독서 클럽"
                    maxLength={60}
                  />
                  <Field
                    label="소개 (선택)"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="어떤 클럽인지 한 줄로"
                    multiline
                  />
                </View>

                {/* 옵션 — 카드 대신 위 괘선 한 줄로 나눈다 */}
                <View style={[styles.options, { borderTopColor: colors.line }]}>
                  <Toggle
                    label="공개 클럽"
                    description={
                      isPublic
                        ? '발견 탭에 노출되고 누구나 참가할 수 있습니다.'
                        : '초대 코드를 아는 사람만 참가할 수 있습니다.'
                    }
                    value={isPublic}
                    onChange={setIsPublic}
                  />
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/*
          하단 띠 — 독후감 쓰기와 같은 자리(ScrollView 의 형제)라 키보드가 뜨면 그 위에 붙는다.
          앱 공통 순서 [이전][주요 버튼] — 주요 버튼은 엄지가 닿는 오른쪽에 넓게(UX 철칙 Fitts).
          실패 안내도 버튼 바로 위에 붙인다(UX 철칙 Proximity).
        */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.line,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          {error ? (
            <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text>
          ) : null}
          <View style={styles.bottomRow}>
            {step > 0 ? (
              <Button label="이전" variant="outline" onPress={goPrev} disabled={create.isPending} />
            ) : null}
            <Button
              label={last ? '클럽 만들기' : '다음'}
              disabled={!stepReady}
              loading={last && create.isPending}
              onPress={goNext}
              style={styles.next}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  // ① 책 단계 — 스크롤 대신 남은 높이를 채우는 기둥. 목록 상자만 줄어든다.
  pickStep: { ...layout.content, flex: 1, padding: spacing.lg },
  helper: { ...typeScale.caption, marginTop: spacing.sm },
  // Field 는 아래 여백(lg)을 스스로 갖는다 — 그대로 두면 묶음의 gap 과 겹쳐 같은 묶음 안이
  // 묶음 사이보다 멀어진다. 여백을 상쇄하고 간격은 묶음의 gap 하나로만 정한다.
  fields: { gap: spacing.md },
  options: { borderTopWidth: hairline, paddingTop: spacing.lg, gap: spacing.md },
  // 내용만큼 자라다가 넘치면 남은 높이에 맞춰 줄고 안에서 스크롤한다.
  bookList: {
    marginTop: spacing.sm,
    flexShrink: 1,
    borderWidth: hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  // 선택된 행은 잉크 띠 2px — 띠 자리는 항상 잡아 두어 글이 흔들리지 않는다(설정의 재촉 톤과 같은 말).
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: hairline,
    borderLeftWidth: 2,
  },
  bookMeta: { ...typeScale.caption, marginTop: 2 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: radius.round,
    borderWidth: hairline,
  },
  empty: { ...typeScale.caption, padding: spacing.lg },
  pending: { padding: spacing.lg },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  emptyText: { flexShrink: 1 },
  // 하단 고정 띠 — 독후감 쓰기의 띠와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bottomRow: { flexDirection: 'row', gap: spacing.sm },
  // 화면의 유일한 악센트 — 남은 폭을 모두 차지한다.
  next: { flex: 1 },
});
