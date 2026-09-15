import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPost } from '@/api/types';
import { MemoScrap, PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import {
  LogScrap, ReadingNowCard, SummaryNote, WeekStrip,
  addDays, clubLogKeys, mondayOf, todayKst, useMyClubRecord, weekTitle,
} from '@/components/clubLog';
import { Button, Eyebrow, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { mono, rowOffsetY } from '@/theme/tokens';

/**
 * 읽기로그 보드 — 모임의 하루 조각을 콜라주로 본다.
 * 요일 스트립으로 날을 고르고, 조각은 두 줄 지그재그로 흩어 놓는다(순서 기반이라 다시 그려도 제자리).
 */
export default function ClubLogBoardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const today = todayKst();
  const [date, setDate] = useState(today);
  const [openReactions, setOpenReactions] = useState<number | null>(null);
  const monday = mondayOf(date);

  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId), enabled: Number.isFinite(clubId) });
  const day = useQuery({
    queryKey: clubLogKeys.day(clubId, date),
    queryFn: () => clubApi.logs(clubId, date),
    enabled: Number.isFinite(clubId),
  });
  const week = useQuery({
    queryKey: clubLogKeys.days(clubId, monday),
    queryFn: () => clubApi.logDays(clubId, monday, addDays(monday, 6)),
    enabled: Number.isFinite(clubId),
  });
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    enabled: Number.isFinite(clubId) && date === today,
    refetchInterval: 30_000,
  });
  const myRecord = useMyClubRecord(club.data);
  const me = club.data?.members.find((m) => m.isMe);
  const ended = club.data?.status === 'ENDED' || club.data?.status === 'ARCHIVED';

  const refresh = () => queryClient.invalidateQueries({ queryKey: clubLogKeys.all(clubId) });
  const reveal = useMutation({ mutationFn: (postId: number) => clubApi.reveal(clubId, postId), onSuccess: refresh });
  const react = useMutation({
    mutationFn: ({ postId, kind }: { postId: number; kind: string }) => clubApi.react(clubId, postId, kind),
    onSuccess: refresh,
  });

  if (club.isLoading || day.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="읽기로그" />
        <Loading />
      </PaperScreen>
    );
  }
  if (!club.data || !day.data) {
    return (
      <PaperScreen>
        <SubHeader category="읽기로그" />
        <Text style={[styles.error, { color: colors.danger }]}>읽기로그를 불러오지 못했습니다.</Text>
      </PaperScreen>
    );
  }

  const logs = day.data.logs ?? [];
  const authors = new Set(logs.map((l) => l.authorId)).size;
  const summary = day.data.summary;
  // 두 줄 지그재그 — 오른쪽 줄 맨 위에는 합산 스티키를 먼저 붙인다.
  const left: { log: ClubPost; index: number }[] = [];
  const right: { log: ClubPost; index: number }[] = [];
  logs.forEach((log, index) => (index % 2 === 0 ? left : right).push({ log, index }));

  const renderScrap = ({ log, index }: { log: ClubPost; index: number }) => (
    <View key={log.id} style={{ marginTop: rowOffsetY[index % rowOffsetY.length] }}>
      <LogScrap
        log={log}
        index={index}
        myPage={me?.currentPage}
        selected={openReactions === log.id}
        onOpen={() => router.push({
          pathname: '/club/[id]/log/[postId]',
          params: { id: String(clubId), postId: String(log.id) },
        })}
        onToggleReactions={() => setOpenReactions((cur) => (cur === log.id ? null : log.id))}
        onReveal={() => reveal.mutate(log.id)}
        onReact={(kind) => react.mutate({ postId: log.id, kind })}
      />
    </View>
  );

  return (
    <PaperScreen>
      <SubHeader category="읽기로그" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TiltCover uri={club.data.book?.coverUrl} title={club.data.book?.title} width={44} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: colors.text }]}>{club.data.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              {weekTitle(monday)}{authors > 0 ? ` · ${authors}명이 남긴 조각` : ''}
            </Text>
          </View>
          <Button
            label="주간 카드"
            size="sm"
            variant="outline"
            onPress={() => router.push({ pathname: '/club/[id]/log/week', params: { id: String(clubId), weekOf: monday } })}
          />
        </View>

        {date === today ? (
          <ReadingNowCard
            readers={readingNow.data ?? []}
            onJoin={myRecord && !ended ? () => router.push(`/timer?recordId=${myRecord.id}`) : undefined}
          />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <View style={styles.weekNav}>
            <Pressable onPress={() => setDate(addDays(monday, -7))} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.weekNavLabel, { color: colors.textMuted }]}>‹ 지난주</Text>
            </Pressable>
            {monday < mondayOf(today) ? (
              <Pressable
                onPress={() => setDate(addDays(monday, 7) > today ? today : addDays(monday, 7))}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.weekNavLabel, { color: colors.textMuted }]}>다음주 ›</Text>
              </Pressable>
            ) : null}
          </View>
          <WeekStrip days={week.data ?? []} selected={date} today={today} onSelect={setDate} />
        </View>

        <View style={{ gap: spacing.md }}>
          <View style={styles.sectionHead}>
            <Eyebrow>{date === today ? '오늘의 조각' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일의 조각`}</Eyebrow>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {logs.length}조각{authors > 0 ? ` · ${authors}명` : ''}
            </Text>
          </View>

          {logs.length === 0 ? (
            <MemoScrap rotate={-1}>
              <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>
                {date === today ? '아직 오늘의 조각이 없어요.' : '이날은 남긴 조각이 없어요.'}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
                읽기를 마치면 사진 한 장과 한 줄로 남길 수 있어요.
              </Text>
            </MemoScrap>
          ) : (
            <View style={styles.board}>
              <View style={styles.column}>{left.map(renderScrap)}</View>
              <View style={[styles.column, { paddingTop: spacing.xl }]}>
                {summary.pagesRead > 0 || summary.readerCount > 0 ? (
                  <SummaryNote summary={summary} label={date === today ? '오늘 함께' : '이날 함께'} />
                ) : null}
                {right.map(renderScrap)}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {!ended ? (
        // 종이가 CTA 뒤로 흐려지며 사라지게 — 불투명 띠로 도트 질감을 자르지 않는다.
        <LinearGradient colors={[`${colors.bg}00`, colors.bg]} locations={[0, 0.45]} style={styles.cta}>
          <Button
            label="한 조각 남기기"
            onPress={() =>
              router.push({
                pathname: '/club/[id]/log/new',
                params: { id: String(clubId), ...(me?.currentPage != null ? { endPage: String(me.currentPage) } : {}) },
              })
            }
          />
        </LinearGradient>
      ) : null}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  title: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27 },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between' },
  weekNavLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 1.2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontFamily: mono.regular, fontSize: 11 },
  board: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.xl },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  error: { ...typeScale.body, padding: spacing.lg },
});
