import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AppState, InputAccessoryView, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { libraryApi, sessionApi } from '@/api/endpoints';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import {
  Button, Loading, ProgressBar, Rule, formatClock, formatDuration, percent,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

const PAGE_INPUT_ACCESSORY_ID = 'timer-page-input-toolbar';

/**
 * 독서 타이머 (§F3).
 *
 * 경과 시간은 매초 더하는 대신 <b>시작 시각과 현재 시각의 차</b>로 계산한다.
 * 앱이 백그라운드로 가거나 죽어도 복원되고, 클라이언트 시계 조작에도 서버 판정이 흔들리지 않는다.
 * 포그라운드 유지 비율과 상호작용 횟수를 함께 보내 어뷰징 판정에 쓴다(§8.3).
 */
export default function TimerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { recordId } = useLocalSearchParams<{ recordId: string }>();
  const id = Number(recordId);

  const record = useQuery({
    queryKey: ['library', 'record', id],
    queryFn: () => libraryApi.detail(id),
    enabled: Number.isFinite(id),
  });
  const current = useQuery({ queryKey: ['session', 'current'], queryFn: sessionApi.current });

  const [elapsed, setElapsed] = useState(0);
  const [endPage, setEndPage] = useState('');
  const [totalPagesInput, setTotalPagesInput] = useState('');
  const [memo, setMemo] = useState('');
  const [endError, setEndError] = useState<string | null>(null);

  const interactions = useRef(0);
  const foregroundMs = useRef(0);
  const totalMs = useRef(0);
  const lastTick = useRef(Date.now());
  const appActive = useRef(AppState.currentState === 'active');

  const session = current.data?.readingRecordId === id ? current.data : null;
  const startedAt = session ? new Date(session.startedAt).getTime() : null;

  // 한 사용자에게 열린 타이머는 하나뿐이다. 다른 책의 타이머가 살아 있다면
  // 새 시작 버튼을 보여 충돌시키지 말고, 종료할 수 있도록 그 타이머로 복원한다.
  useEffect(() => {
    const activeRecordId = current.data?.readingRecordId;
    if (activeRecordId != null && activeRecordId !== id) {
      router.replace({ pathname: '/timer', params: { recordId: String(activeRecordId) } });
    }
  }, [current.data?.readingRecordId, id, router]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appActive.current = state === 'active';
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick.current;
      lastTick.current = now;
      totalMs.current += delta;
      if (appActive.current) {
        foregroundMs.current += delta;
      }
      setElapsed(Math.floor((now - startedAt) / 1000));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (record.data && !endPage) {
      setEndPage(String(record.data.progress.currentPage));
    }
  }, [record.data]);

  const start = useMutation({
    mutationFn: () => sessionApi.start(id, record.data?.progress.currentPage),
    onSuccess: () => {
      lastTick.current = Date.now();
      foregroundMs.current = 0;
      totalMs.current = 0;
      interactions.current = 0;
      queryClient.invalidateQueries({ queryKey: ['session', 'current'] });
    },
    onError: async (error) => {
      if (!(error instanceof ApiError) || error.status !== 409) return;
      const active = await queryClient.fetchQuery({
        queryKey: ['session', 'current'],
        queryFn: sessionApi.current,
      });
      if (active?.readingRecordId != null) {
        router.replace({ pathname: '/timer', params: { recordId: String(active.readingRecordId) } });
      }
    },
  });

  const saveTotalPages = useMutation({
    mutationFn: async () => {
      const total = Number(totalPagesInput);
      const updated = await libraryApi.updateGoal(id, { totalPagesOverride: total });
      // 총쪽수를 모를 때 잘못 들어간 과대 진척값은 새 범위 안으로 되돌린다.
      if (updated.progress.currentPage > total) {
        return libraryApi.updateProgress(id, total);
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['library', 'record', id], updated);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setTotalPagesInput('');
    },
  });

  const end = useMutation({
    mutationFn: () => {
      if (!session || end.isPending) {
        throw new Error('종료할 세션이 없습니다.');
      }
      const ratio = totalMs.current > 0 ? foregroundMs.current / totalMs.current : 1;
      return sessionApi.end(session.id, {
        endPage: endPage ? Number(endPage) : undefined,
        foregroundRatio: Math.min(1, Math.max(0, Number(ratio.toFixed(3)))),
        interactionCount: interactions.current,
        memo: memo.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      setEndError(null);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['session', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      // 완독이어도 책 id 를 모르면 /book/undefined 로 튄다 — 그때는 그냥 되돌아간다.
      const bookId = record.data?.book?.id;
      // 모임 책이면 끝나자마자 읽기로그 조각을 남기러 간다. 같은 책으로 여러 모임에 있으면 첫 모임으로.
      // 완독은 책 상세의 축하 흐름을 우선한다.
      const club = result.clubs[0];
      if (result.bookFinished && bookId != null) {
        router.replace(`/book/${bookId}?recordId=${id}`);
      } else if (club?.clubId != null) {
        router.replace({
          pathname: '/club/[id]/log/new',
          params: {
            id: String(club.clubId),
            sessionId: String(result.session.id),
            durationSec: String(result.session.durationSec),
            ...(result.session.startPage != null ? { startPage: String(result.session.startPage) } : {}),
            endPage: String(result.session.endPage ?? result.currentPage),
          },
        });
      } else {
        router.back();
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        queryClient.setQueryData(['session', 'current'], null);
        queryClient.invalidateQueries({ queryKey: ['library'] });
        setEndError('이미 종료된 세션입니다. 화면을 새로고침했습니다.');
        return;
      }
      setEndError(error instanceof Error ? error.message : '세션 종료에 실패했습니다.');
    },
  });

  if (record.isLoading || current.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="타이머" />
        <Loading />
      </PaperScreen>
    );
  }

  const progress = record.data?.progress;
  const running = Boolean(session);
  const totalPages = progress?.totalPages ?? 0;
  const typedPage = Number(endPage);
  const displayPage = running && Number.isFinite(typedPage) && endPage.length > 0
    ? Math.max(0, totalPages > 0 ? Math.min(typedPage, totalPages) : typedPage)
    : progress?.currentPage ?? 0;
  const displayRate = totalPages > 0
    ? Math.min(1, displayPage / totalPages)
    : progress?.completionRate;
  const startPage = session?.startPage ?? progress?.currentPage ?? 0;
  const pageError = running && endPage.length > 0
    ? typedPage < startPage
      ? `시작 쪽수(${startPage}쪽)보다 작게 기록할 수 없습니다.`
      : totalPages > 0 && typedPage > totalPages
        ? `전체 ${totalPages}쪽을 넘을 수 없습니다.`
        : typedPage > 20_000
          ? '쪽수는 20,000 이하로 입력해 주세요.'
          : null
    : null;

  return (
    <PaperScreen>
      <SubHeader category="타이머" />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => { interactions.current += 1; }}
      >
        <View style={styles.bookRow}>
          <TiltCover
            uri={record.data?.book?.coverUrl}
            title={record.data?.book?.title}
            width={46}
            tilt={0}
            entering={false}
          />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>
              {record.data?.book?.title}
            </Text>
            <Text style={[styles.bookMeta, { color: colors.textMuted }]}>
              {displayPage}
              {totalPages > 0 ? ` / ${totalPages}쪽` : '쪽'}
              {displayRate != null ? ` · ${percent(displayRate)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.clockBox}>
          <Text style={[styles.clock, { color: colors.text }]}>{formatClock(elapsed)}</Text>
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>
            {running ? '기록 중' : '시작을 누르면 기록됩니다'}
          </Text>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHead}>
            <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>현재 진척</Text>
            <Text style={[styles.progressPercent, { color: colors.accent }]}>
              {displayRate != null ? percent(displayRate) : '총쪽수 미등록'}
            </Text>
          </View>
          <ProgressBar value={displayRate} height={6} />
        </View>

        {progress && totalPages === 0 ? (
          <View style={[styles.totalPagesCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.totalPagesCopy}>
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>총쪽수를 알려주세요</Text>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>등록하면 진척률과 완독 검증에 사용됩니다.</Text>
            </View>
            <View style={styles.totalPagesRow}>
              <TextInput
                value={totalPagesInput}
                onChangeText={(text) => setTotalPagesInput(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="예: 320"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="책 총쪽수"
                style={[styles.totalPagesInput, { color: colors.text, borderColor: colors.lineStrong }]}
              />
              <Button
                label="등록"
                onPress={() => saveTotalPages.mutate()}
                loading={saveTotalPages.isPending}
                disabled={Number(totalPagesInput) < 1 || Number(totalPagesInput) > 20_000}
              />
            </View>
            {saveTotalPages.isError ? (
              <Text style={[styles.pageError, { color: colors.danger }]}>총쪽수를 저장하지 못했습니다.</Text>
            ) : null}
          </View>
        ) : null}

        {running ? (
          <View style={styles.endForm}>
            <Rule />
            <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>
              몇 쪽까지 읽었나요?
            </Text>
            <View style={styles.pageRow}>
              <TextInput
                value={endPage}
                onChangeText={(text) => {
                  interactions.current += 1;
                  setEndPage(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
                maxLength={5}
                inputAccessoryViewID={Platform.OS === 'ios' ? PAGE_INPUT_ACCESSORY_ID : undefined}
                onSubmitEditing={Keyboard.dismiss}
                style={[styles.pageInput, { borderBottomColor: colors.accent, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={[styles.pageSuffix, { color: colors.textMuted }]}>
                {progress && progress.totalPages > 0 ? `/ ${progress.totalPages}쪽` : '쪽'}
              </Text>
            </View>
            {pageError ? <Text style={[styles.pageError, { color: colors.danger }]}>{pageError}</Text> : null}
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="이번 세션 메모 (선택)"
              placeholderTextColor={colors.textFaint}
              style={[
                styles.memoInput,
                { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
              ]}
              multiline
            />
            <Button
              label="세션 종료"
              onPress={() => {
                Keyboard.dismiss();
                end.mutate();
              }}
              loading={end.isPending}
              disabled={!session || end.isPending || Boolean(pageError)}
            />
            {endError ? (
              <Text style={[styles.error, { color: colors.danger }]}>{endError}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.startArea}>
            <Button
              label="독서 시작"
              onPress={() => start.mutate()}
              loading={start.isPending}
            />
            {start.isError ? (
              <Text style={[styles.error, { color: colors.danger }]}>
                {start.error instanceof ApiError ? start.error.message : '독서를 시작하지 못했습니다.'}
              </Text>
            ) : null}
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              누적 {formatDuration(progress?.totalDurationSec ?? 0)} 읽었습니다.
            </Text>
          </View>
        )}
      </ScrollView>
        {Platform.OS === 'ios' ? (
          <InputAccessoryView nativeID={PAGE_INPUT_ACCESSORY_ID}>
            <View style={[styles.keyboardToolbar, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Pressable
                onPress={Keyboard.dismiss}
                accessibilityRole="button"
                accessibilityLabel="숫자 키패드 닫기"
                style={styles.keyboardDone}
              >
                <Text style={[typeScale.label, { color: colors.accent }]}>완료</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  keyboardArea: { flex: 1 },
  container: { ...layout.content, flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  bookRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  bookTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  bookMeta: { ...typeScale.caption, marginTop: 3 },
  progressBlock: { gap: spacing.sm },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressPercent: { ...typeScale.monoNumeral, fontSize: 16 },
  totalPagesCard: { borderWidth: hairline, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  totalPagesCopy: { gap: spacing.xs },
  totalPagesRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  totalPagesInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontFamily: mono.semiBold,
    fontSize: 18,
  },
  clockBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  // 경과 시간 — 화면의 주인공. 모노 숫자를 크게 앉힌다.
  clock: { fontFamily: mono.semiBold, fontSize: 58, letterSpacing: 2 },
  startArea: { gap: spacing.md },
  hint: { ...typeScale.caption, textAlign: 'center' },
  error: { ...typeScale.caption, lineHeight: 17 },
  endForm: { gap: spacing.md },
  pageRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  pageInput: {
    flex: 1,
    borderBottomWidth: 2,
    minWidth: 0,
    fontFamily: mono.semiBold,
    fontSize: 34,
    paddingVertical: spacing.sm,
  },
  pageSuffix: { fontFamily: mono.regular, fontSize: 15, flexShrink: 0 },
  pageError: { ...typeScale.caption, lineHeight: 18 },
  memoInput: {
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    fontFamily: serif.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  keyboardToolbar: {
    minHeight: 44,
    borderTopWidth: hairline,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  keyboardDone: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
