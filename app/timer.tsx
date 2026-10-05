import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AppState, InputAccessoryView, Keyboard, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { libraryApi, sessionApi } from '@/api/endpoints';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { KeyboardArea, useScrollReveal } from '@/components/keyboard';
import {
  Button, Loading, ProgressBar, Rule, formatClock, formatDuration, percent, playLabel,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

const PAGE_INPUT_ACCESSORY_ID = 'timer-page-input-toolbar';

/**
 * 독서 타이머 (§F3).
 *
 * 경과 시간은 매초 더하는 대신 <b>시작 시각과 현재 시각의 차</b>에서 쉰 시간을 빼서 계산한다.
 * 앱이 백그라운드로 가거나 죽어도 복원되고, 클라이언트 시계 조작에도 서버 판정이 흔들리지 않는다.
 * 잠깐 쉬기도 서버에 남는다(pausedAt · pausedSec) — 쉬는 동안 시계는 멈춰 있고, 쉰 시간은 독서 시간에서 빠진다.
 * 포그라운드 유지 비율과 상호작용 횟수를 함께 보내 어뷰징 판정에 쓴다(§8.3).
 */
export default function TimerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { recordId, autoStart } = useLocalSearchParams<{ recordId: string; autoStart?: string }>();
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
  // 쪽수·메모를 누르면 그 칸과 '독서 마치기'가 함께 키보드 위로 올라오게.
  const scrollRef = useRef<ScrollView>(null);
  const endFormRef = useRef<View>(null);
  const revealAbove = useScrollReveal(scrollRef);
  const [endError, setEndError] = useState<string | null>(null);

  const interactions = useRef(0);
  const foregroundMs = useRef(0);
  const totalMs = useRef(0);
  const lastTick = useRef(Date.now());
  const appActive = useRef(AppState.currentState === 'active');

  const session = current.data?.readingRecordId === id ? current.data : null;
  const startedAt = session ? new Date(session.startedAt).getTime() : null;
  const pausedAt = session?.pausedAt ? new Date(session.pausedAt).getTime() : null;
  const pausedSec = session?.pausedSec ?? 0;
  const [pauseError, setPauseError] = useState<string | null>(null);

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
    // 쉬는 중에는 쉬기 시작한 때의 값에 시계를 세워 둔다.
    if (pausedAt) {
      setElapsed(Math.max(0, Math.floor((pausedAt - startedAt) / 1000) - pausedSec));
      return;
    }
    // 쉰 동안은 포그라운드 비율에 넣지 않도록 다시 잴 때마다 기준을 지금으로 맞춘다.
    lastTick.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick.current;
      lastTick.current = now;
      totalMs.current += delta;
      if (appActive.current) {
        foregroundMs.current += delta;
      }
      setElapsed(Math.max(0, Math.floor((now - startedAt) / 1000) - pausedSec));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, pausedAt, pausedSec]);

  useEffect(() => {
    if (record.data && !endPage) {
      setEndPage(String(record.data.progress.currentPage));
    }
  }, [record.data]);

  const start = useMutation({
    mutationFn: () => sessionApi.start(id, record.data?.progress.currentPage),
    onSuccess: () => {
      setPauseError(null);
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

  const pauseToggle = useMutation({
    mutationFn: ({ sessionId, action }: { sessionId: number; action: 'pause' | 'resume' }) =>
      action === 'pause' ? sessionApi.pause(sessionId) : sessionApi.resume(sessionId),
    onSuccess: (view) => {
      setPauseError(null);
      queryClient.setQueryData(['session', 'current'], view);
    },
    onError: (error, { action }) => {
      if (error instanceof ApiError && error.status === 409) {
        queryClient.setQueryData(['session', 'current'], null);
        queryClient.invalidateQueries({ queryKey: ['library'] });
        setPauseError('이미 끝난 독서예요. 화면을 새로 불러왔어요.');
        return;
      }
      setPauseError(error instanceof ApiError
        ? error.message
        : action === 'pause'
          ? '잠깐 쉬기를 하지 못했어요. 다시 시도해 주세요.'
          : '이어서 읽기를 하지 못했어요. 다시 시도해 주세요.');
    },
  });

  // 도서 상세의 '읽기 시작'·'독서 시작', 홈의 '이어서'에서 왔으면 버튼을 한 번 더 누르게 하지 않고 바로 잰다.
  // 같은 책 타이머가 쉬는 중이면 이어서 재고, 이미 재고 있으면 그대로 둔다.
  // 다른 책의 타이머가 열려 있으면 건드리지 않는다 — 위 효과가 그 타이머로 옮긴다.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart !== '1' || autoStarted.current) return;
    if (!record.data || !current.isSuccess) return;
    const open = current.data;
    if (open && open.readingRecordId !== id) return;
    autoStarted.current = true;
    if (!open) {
      start.mutate();
    } else if (open.pausedAt) {
      pauseToggle.mutate({ sessionId: open.id, action: 'resume' });
    }
    // 뒤로 왔다가 다시 이 화면에 올 때(또는 쉬기를 누른 뒤) 또 시작하지 않도록 파라미터를 지운다.
    router.setParams({ autoStart: undefined });
  }, [autoStart, record.data, current.isSuccess, current.data, id, start, pauseToggle, router]);

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
        throw new Error('끝낼 독서가 없어요.');
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
      // 클럽 책이면 끝나자마자 읽기로그 조각을 남기러 간다. 같은 책으로 여러 클럽에 있으면 첫 클럽으로.
      // 완독은 책 상세의 축하 흐름을 우선한다 — finished=1 이면 책 상세가 완독 리뷰 시트를 띄운다.
      const club = result.clubs[0];
      if (result.bookFinished && bookId != null) {
        router.replace(`/book/${bookId}?recordId=${id}&finished=1`);
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
        setEndError('이미 끝난 독서예요. 화면을 새로 불러왔어요.');
        return;
      }
      setEndError(error instanceof Error ? error.message : '독서를 마치지 못했어요. 다시 시도해 주세요.');
    },
  });

  if (record.isLoading || current.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="타이머" sheet />
        <Loading />
      </PaperScreen>
    );
  }

  const progress = record.data?.progress;
  const running = Boolean(session);
  const paused = pausedAt != null;
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
      ? `시작한 쪽(${startPage}쪽)보다 앞쪽은 적을 수 없어요.`
      : totalPages > 0 && typedPage > totalPages
        ? `전체 ${totalPages}쪽보다 많이 적을 수 없어요.`
        : typedPage > 20_000
          ? '쪽수는 20,000 이하로 적어 주세요.'
          : null
    : null;

  return (
    <PaperScreen>
      <SubHeader category="타이머" sheet />

      {/* 시트로 뜨는 화면(iOS)이라 화면 맨 위에서 시작하지 않는다 — KeyboardArea 가 창 기준으로 재서 맞춘다. */}
      <KeyboardArea>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        // 한 화면에 들어오면 끌어도 출렁이지 않게(iOS) — 키보드가 떠서 넘칠 때만 스크롤된다.
        alwaysBounceVertical={false}
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
          <View style={styles.bookInfo}>
            <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>
              {record.data?.book?.title}
            </Text>
            {/* 진도는 이 줄 하나로 — 쪽수를 적는 대로 숫자와 막대가 같이 바뀐다. */}
            <Text style={[styles.bookMeta, { color: colors.textMuted }]}>
              {displayPage}
              {totalPages > 0 ? ` / ${totalPages}쪽` : '쪽'}
              {displayRate != null ? ` · ${percent(displayRate)}` : ''}
            </Text>
            {displayRate != null ? (
              <View style={styles.bookProgress}>
                <ProgressBar value={displayRate} height={4} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.clockBox}>
          <Text style={[styles.clock, { color: paused ? colors.textMuted : colors.text }]}>
            {formatClock(elapsed)}
          </Text>
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>
            {paused ? '잠깐 쉬는 중' : running ? '기록 중' : '시작을 누르면 기록됩니다'}
          </Text>
          {/* 쉬기·이어서는 이 버튼이 다루는 시계 바로 밑에 둔다 — 주요 버튼 '독서 마치기'는 아래 그대로. */}
          {session ? (
            <Button
              label={paused ? playLabel('이어서 읽기') : playLabel('잠깐 쉬기', '⏸')}
              variant="outline"
              onPress={() => pauseToggle.mutate({ sessionId: session.id, action: paused ? 'resume' : 'pause' })}
              loading={pauseToggle.isPending}
              disabled={end.isPending}
              style={styles.pauseButton}
            />
          ) : null}
          {pauseError ? (
            <Text style={[styles.error, styles.pauseError, { color: colors.danger }]}>{pauseError}</Text>
          ) : null}
        </View>

        {progress && totalPages === 0 ? (
          <View style={[styles.totalPagesCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.totalPagesCopy}>
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>이 책은 모두 몇 쪽인가요?</Text>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>적어 두면 진도를 계산하고 완독을 확인할 때 써요.</Text>
            </View>
            <View style={styles.totalPagesRow}>
              <TextInput
                value={totalPagesInput}
                onChangeText={(text) => setTotalPagesInput(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="예: 320"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="책 전체 쪽수"
                style={[styles.totalPagesInput, { color: colors.text, borderColor: colors.lineStrong }]}
              />
              <Button
                label="저장"
                variant="outline"
                onPress={() => saveTotalPages.mutate()}
                loading={saveTotalPages.isPending}
                disabled={Number(totalPagesInput) < 1 || Number(totalPagesInput) > 20_000}
              />
            </View>
            {saveTotalPages.isError ? (
              <Text style={[styles.pageError, { color: colors.danger }]}>쪽수를 저장하지 못했어요.</Text>
            ) : null}
          </View>
        ) : null}

        {running ? (
          <View ref={endFormRef} style={styles.endForm}>
            <Rule />
            {/* 질문·쪽수·오류는 한 묶음(sm) — 메모와 종료 버튼은 묶음 밖으로 띄운다(UX 철칙 Proximity). */}
            <View style={styles.pageGroup}>
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
                  onFocus={() => revealAbove(endFormRef)}
              onContentSizeChange={() => revealAbove(endFormRef, { onlyIfOpen: true })}
                  style={[styles.pageInput, { borderBottomColor: colors.accent, color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                />
                <Text style={[styles.pageSuffix, { color: colors.textMuted }]}>
                  {progress && progress.totalPages > 0 ? `/ ${progress.totalPages}쪽` : '쪽'}
                </Text>
              </View>
              {pageError ? <Text style={[styles.pageError, { color: colors.danger }]}>{pageError}</Text> : null}
            </View>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="독서 일지 (선택)"
              placeholderTextColor={colors.textFaint}
              onFocus={() => revealAbove(endFormRef)}
              style={[
                styles.memoInput,
                { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
              ]}
              multiline
            />
            <Button
              label="독서 마치기"
              style={styles.endButton}
              onPress={() => {
                Keyboard.dismiss();
                end.mutate();
              }}
              loading={end.isPending}
              disabled={!session || end.isPending || pauseToggle.isPending || Boolean(pageError)}
            />
            {endError ? (
              <Text style={[styles.error, { color: colors.danger }]}>{endError}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.startArea}>
            <Button
              label={playLabel('독서 시작')}
              onPress={() => start.mutate()}
              loading={start.isPending}
            />
            {start.isError ? (
              <Text style={[styles.error, { color: colors.danger }]}>
                {start.error instanceof ApiError ? start.error.message : '독서를 시작하지 못했어요.'}
              </Text>
            ) : null}
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              지금까지 {formatDuration(progress?.totalDurationSec ?? 0)} 읽었어요.
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
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // 묶음 사이는 최소 lg — 남는 자리는 시계 둘레가 가져가 큰 화면에서는 더 벌어진다.
  // 아래 여백은 홈 인디케이터·내비게이션 바만큼(화면에서 준다).
  container: { ...layout.content, flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  bookRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  bookInfo: { flex: 1 },
  bookTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  bookMeta: { ...typeScale.caption, marginTop: 3 },
  bookProgress: { marginTop: spacing.sm },
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
  // 시계는 남는 자리의 가운데 — 책 줄은 위에, 마치기·시작은 엄지가 닿는 아래에 붙고, 빈 곳은 시계 둘레로 모인다.
  // 자리가 모자라면(작은 화면·키보드) 먼저 이 둘레가 줄고, 그래도 넘칠 때만 스크롤된다.
  clockBox: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  // 경과 시간 — 화면의 주인공. 모노 숫자를 크게 앉힌다.
  clock: { fontFamily: mono.semiBold, fontSize: 58, letterSpacing: 2 },
  // 라벨이 '잠깐 쉬기'↔'이어서 읽기'로 바뀌어도 폭이 흔들리지 않게 긴 쪽에 맞춘 최소 폭.
  pauseButton: { alignSelf: 'center', minWidth: 168, marginTop: spacing.xs },
  pauseError: { textAlign: 'center' },
  startArea: { gap: spacing.md },
  hint: { ...typeScale.caption, textAlign: 'center' },
  error: { ...typeScale.caption, lineHeight: 17 },
  endForm: { gap: spacing.lg },
  pageGroup: { gap: spacing.sm },
  // 종료는 입력들과 떼어 둔다 — 묶음 간격(lg)에 sm 을 더해 xl.
  endButton: { marginTop: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  pageInput: {
    flex: 1,
    borderBottomWidth: 2,
    minWidth: 0,
    fontFamily: mono.semiBold,
    fontSize: 34,
    paddingVertical: spacing.xs,
  },
  pageSuffix: { fontFamily: mono.regular, fontSize: 15, flexShrink: 0 },
  pageError: { ...typeScale.caption, lineHeight: 18 },
  memoInput: {
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    maxHeight: 160, // 길어지면 칸 안에서 스크롤 — '독서 마치기'가 키보드 밑으로 밀려나지 않게
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
  keyboardDone: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
