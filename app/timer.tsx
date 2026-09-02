import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { libraryApi, sessionApi } from '@/api/endpoints';
import { BookCover } from '@/components/BookCover';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Loading, ProgressBar, Rule, formatClock, formatDuration, percent,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

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
  const [memo, setMemo] = useState('');
  const [endError, setEndError] = useState<string | null>(null);

  const interactions = useRef(0);
  const foregroundMs = useRef(0);
  const totalMs = useRef(0);
  const lastTick = useRef(Date.now());
  const appActive = useRef(AppState.currentState === 'active');

  const session = current.data?.readingRecordId === id ? current.data : null;
  const startedAt = session ? new Date(session.startedAt).getTime() : null;

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
      if (result.bookFinished) {
        router.replace(`/book/${record.data?.book?.id}?recordId=${id}&finished=1`);
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

  return (
    <PaperScreen>
      <SubHeader category="타이머" />

      <Pressable style={styles.container} onPress={() => { interactions.current += 1; }}>
        <View style={styles.bookRow}>
          <BookCover url={record.data?.book?.coverUrl} title={record.data?.book?.title} width={46} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.text }]}>
              {record.data?.book?.title}
            </Text>
            <Text style={[styles.bookMeta, { color: colors.textMuted }]}>
              {progress?.currentPage}
              {progress && progress.totalPages > 0 ? ` / ${progress.totalPages}쪽` : '쪽'}
              {progress?.completionRate != null ? ` · ${percent(progress.completionRate)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.clockBox}>
          <Text style={[styles.clock, { color: colors.text }]}>{formatClock(elapsed)}</Text>
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>
            {running ? '기록 중' : '시작을 누르면 기록됩니다'}
          </Text>
        </View>

        <ProgressBar value={progress?.completionRate} height={4} />

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
                style={[styles.pageInput, { borderBottomColor: colors.accent, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={[styles.pageSuffix, { color: colors.textMuted }]}>
                {progress && progress.totalPages > 0 ? `/ ${progress.totalPages}쪽` : '쪽'}
              </Text>
            </View>
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
              onPress={() => end.mutate()}
              loading={end.isPending}
              disabled={!session || end.isPending}
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
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              누적 {formatDuration(progress?.totalDurationSec ?? 0)} 읽었습니다.
            </Text>
          </View>
        )}
      </Pressable>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, flex: 1, padding: spacing.lg, gap: spacing.xl },
  bookRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  bookTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  bookMeta: { ...typeScale.caption, marginTop: 3 },
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
  memoInput: {
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    fontFamily: serif.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
