import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import type { Checkpoint, ClubHome, ClubPost, ClubPreview, NudgeMessageKey } from '@/api/types';
import { MemberDetail, MemberStrip, confirmAsync, notify } from '@/components/club';
import {
  LogScrap, ReadingNowCard, SummaryNote, WeekStrip,
  addDays, clubLogKeys, mondayOf, todayKst, useMyClubRecord,
} from '@/components/clubLog';
import { MemoScrap, PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Loading, Numeral, Rule, Tag, Toggle, percent,
} from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, rowOffsetY } from '@/theme/tokens';

/**
 * 모임 홈 (§12.2) — 누르면 바로 서로의 읽기로그가 보이는 보드.
 * 위에서부터 함께 읽는 사람(진척 스트립) · 지금 읽는 중 · 요일 스트립 · 그날의 조각 콜라주 · 체크포인트.
 * 초대 코드 재발급·자리·멤버·종료 같은 운영은 호스트 전용 설정(/club/[id]/settings)으로 뺐다.
 */
export default function ClubHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const today = todayKst();
  const [date, setDate] = useState(today);
  const [openReactions, setOpenReactions] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [shareProgress, setShareProgress] = useState(true);
  const [adoptTarget, setAdoptTarget] = useState(true);
  const monday = mondayOf(date);

  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });

  const preview = useQuery({
    queryKey: ['club', 'preview', clubId],
    queryFn: () => clubApi.previewById(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });

  // 읽기로그는 멤버에게만 열린다 — 홈이 오기 전엔 부르지 않는다(비멤버는 403).
  const isMember = !!club.data;
  const day = useQuery({
    queryKey: clubLogKeys.day(clubId, date),
    queryFn: () => clubApi.logs(clubId, date),
    enabled: isMember,
  });
  const week = useQuery({
    queryKey: clubLogKeys.days(clubId, monday),
    queryFn: () => clubApi.logDays(clubId, monday, addDays(monday, 6)),
    enabled: isMember,
  });
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    enabled: isMember && date === today,
    refetchInterval: 30_000,
  });
  const myRecord = useMyClubRecord(club.data);

  const refreshLogs = () => queryClient.invalidateQueries({ queryKey: clubLogKeys.all(clubId) });
  const reveal = useMutation({ mutationFn: (postId: number) => clubApi.reveal(clubId, postId), onSuccess: refreshLogs });
  const react = useMutation({
    mutationFn: ({ postId, kind }: { postId: number; kind: string }) => clubApi.react(clubId, postId, kind),
    onSuccess: refreshLogs,
  });

  const join = useMutation({
    mutationFn: () => clubApi.joinPublic(clubId, { adoptTargetDate: adoptTarget, shareProgress }),
    onSuccess: (joined) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club', 'preview', clubId] });
      queryClient.setQueryData(['club', joined.id], joined);
      router.replace(`/club/${joined.id}`);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '참가하지 못했습니다.'),
  });

  const nudge = useMutation({
    mutationFn: ({ userId, key }: { userId: number; key: NudgeMessageKey }) =>
      clubApi.nudge(clubId, userId, key),
    onSuccess: (result) => {
      setSelectedUserId(null);
      notify(`찌르기를 보냈어요. 오늘 ${result.remainingToday}번 남았습니다.`);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '보내지 못했습니다.'),
  });

  const leave = useMutation({
    mutationFn: () => clubApi.leave(clubId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace('/clubs');
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '나가지 못했습니다.'),
  });

  if (club.isLoading && !preview.data) {
    return (
      <PaperScreen>
        <SubHeader category="모임" />
        <Loading />
      </PaperScreen>
    );
  }
  if (!club.data) {
    if (preview.data) {
      return (
        <PublicClubPreview
          club={preview.data}
          adoptTarget={adoptTarget}
          shareProgress={shareProgress}
          onAdoptTargetChange={setAdoptTarget}
          onShareProgressChange={setShareProgress}
          onJoin={() => join.mutate()}
          joining={join.isPending}
        />
      );
    }
    return (
      <PaperScreen>
        <SubHeader category="모임" />
        <Text style={[styles.error, { color: colors.danger }]}>모임을 불러오지 못했습니다.</Text>
      </PaperScreen>
    );
  }

  const data: ClubHome = club.data;
  const ended = data.status === 'ENDED' || data.status === 'ARCHIVED';
  const isHost = data.myRole === 'HOST';
  const me = data.members.find((m) => m.isMe);
  const selectedMember = data.members.find((m) => m.userId === selectedUserId) ?? null;

  const logs = day.data?.logs ?? [];
  const summary = day.data?.summary;
  const authors = new Set(logs.map((l) => l.authorId)).size;
  const readingNowIds = new Set((readingNow.data ?? []).map((r) => r.userId));
  const logCounts = new Map<number, number>();
  logs.forEach((l) => logCounts.set(l.authorId, (logCounts.get(l.authorId) ?? 0) + 1));
  const isToday = date === today;
  const dayLabel = isToday ? '오늘' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

  // 두 줄 지그재그 — 오른쪽 줄 맨 위에는 합산 스티키를 먼저 붙인다.
  const left: { log: ClubPost; index: number }[] = [];
  const right: { log: ClubPost; index: number }[] = [];
  logs.forEach((log, index) => (index % 2 === 0 ? left : right).push({ log, index }));

  const writeLog = () =>
    router.push({
      pathname: '/club/[id]/log/new',
      params: { id: String(clubId), ...(me?.currentPage != null ? { endPage: String(me.currentPage) } : {}) },
    });

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
      <SubHeader
        category="모임"
        right={
          <View style={styles.headerActions}>
            <HeaderAction label="토론" onPress={() => router.push(`/club/${clubId}/posts`)} colors={colors} />
            {isHost ? (
              <HeaderAction label="관리" onPress={() => router.push(`/club/${clubId}/settings`)} colors={colors} />
            ) : null}
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TiltCover uri={data.book?.coverUrl} title={data.book?.title} width={58} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: colors.text }]}>{data.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{data.book?.title}</Text>
            <View style={styles.headerTags}>
              <Tag label={isHost ? '호스트' : '멤버'} />
              <Tag label={`${data.memberCount}/${data.memberLimit}명`} />
              {ended ? <Tag label="종료" /> : <Tag label={`D-${Math.max(0, data.daysLeft)}`} />}
            </View>
          </View>
        </View>

        {/* 함께 읽는 사람 — 서로의 진척을 먼저, 누르면 그 사람의 자세한 진척과 찌르기 */}
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHead}>
            <Eyebrow>함께 읽는 사람</Eyebrow>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              평균 {percent(data.averageCompletionRate)} · 내 순위 {data.myRank}/{data.memberCount}
            </Text>
          </View>
          <MemberStrip
            members={data.members}
            readingNowIds={readingNowIds}
            logCounts={logCounts}
            selectedUserId={selectedUserId}
            onSelect={(member) => setSelectedUserId((cur) => (cur === member.userId ? null : member.userId))}
          />
          {selectedMember ? (
            <MemberDetail
              member={selectedMember}
              nudging={nudge.isPending}
              onNudge={ended ? undefined : (userId, key) => nudge.mutate({ userId, key })}
              onClose={() => setSelectedUserId(null)}
            />
          ) : null}
        </View>

        {isToday ? (
          <ReadingNowCard
            readers={readingNow.data ?? []}
            onJoin={myRecord && !ended ? () => router.push(`/timer?recordId=${myRecord.id}`) : undefined}
          />
        ) : null}

        {/* 요일 스트립 — 날을 고르면 그날의 조각으로 바뀐다 */}
        <View style={{ gap: spacing.sm }}>
          <View style={styles.weekNav}>
            <Pressable onPress={() => setDate(addDays(monday, -7))} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.weekNavLabel, { color: colors.textMuted }]}>‹ 지난주</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/club/[id]/log/week', params: { id: String(clubId), weekOf: monday } })}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.weekNavLabel, { color: colors.accent }]}>주간 카드</Text>
            </Pressable>
            {monday < mondayOf(today) ? (
              <Pressable
                onPress={() => setDate(addDays(monday, 7) > today ? today : addDays(monday, 7))}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.weekNavLabel, { color: colors.textMuted }]}>다음주 ›</Text>
              </Pressable>
            ) : (
              // 자리만 지켜 '주간 카드'가 늘 가운데에 오게 한다.
              <Text style={[styles.weekNavLabel, { color: 'transparent' }]}>다음주 ›</Text>
            )}
          </View>
          <WeekStrip days={week.data ?? []} selected={date} today={today} onSelect={setDate} />
        </View>

        {/* 그날의 조각 — 두 줄 지그재그 콜라주 */}
        <View style={{ gap: spacing.md }}>
          <View style={styles.sectionHead}>
            <Eyebrow>{dayLabel}의 조각</Eyebrow>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {logs.length}조각{authors > 0 ? ` · ${authors}명` : ''}
            </Text>
          </View>

          {day.isLoading ? (
            <Loading />
          ) : logs.length === 0 ? (
            <MemoScrap rotate={-1}>
              <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>
                {isToday ? '아직 오늘의 조각이 없어요.' : '이날은 남긴 조각이 없어요.'}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
                읽기를 마치면 사진 한 장과 한 줄로 남길 수 있어요.
              </Text>
            </MemoScrap>
          ) : (
            <View style={styles.board}>
              <View style={styles.column}>{left.map(renderScrap)}</View>
              <View style={[styles.column, { paddingTop: spacing.xl }]}>
                {summary && (summary.pagesRead > 0 || summary.readerCount > 0) ? (
                  <SummaryNote summary={summary} label={isToday ? '오늘 함께' : '이날 함께'} />
                ) : null}
                {right.map(renderScrap)}
              </View>
            </View>
          )}
        </View>

        {data.nextCheckpoint || data.checkpoints.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Eyebrow>체크포인트</Eyebrow>
            {data.nextCheckpoint ? (
              <Card style={{ gap: spacing.xs }}>
                <View style={styles.checkpointHead}>
                  <Text style={[styles.checkpointTitle, { color: colors.text }]}>
                    {data.nextCheckpoint.title}
                  </Text>
                  <Numeral style={[styles.checkpointTarget, { color: colors.accent }]}>
                    ~{data.nextCheckpoint.targetPage}쪽
                  </Numeral>
                </View>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                  마감 {new Date(data.nextCheckpoint.dueAt).toLocaleDateString('ko-KR')} ·{' '}
                  {data.nextCheckpoint.achievedCount}/{data.nextCheckpoint.memberCount}명 달성
                </Text>
              </Card>
            ) : null}
            {data.checkpoints.length > 0 ? (
              <CheckpointGrid checkpoints={data.checkpoints} colors={colors} />
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Rule />
          <View style={styles.codeRow}>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>초대 코드</Text>
            <Text style={[styles.code, { color: colors.textMuted }]}>{data.joinCode}</Text>
          </View>
          {ended ? (
            <Button
              label="모임 결산 보기"
              variant="outline"
              onPress={() => router.push(`/club/${clubId}/result`)}
            />
          ) : null}
          <Button
            label="모임 나가기"
            variant="ghost"
            size="sm"
            loading={leave.isPending}
            onPress={async () => {
              if (await confirmAsync('모임에서 나갈까요? 남긴 조각과 글은 그대로 남아요.', '나가기')) leave.mutate();
            }}
          />
        </View>
      </ScrollView>

      {!ended ? (
        // 종이가 CTA 뒤로 흐려지며 사라지게 — 불투명 띠로 도트 질감을 자르지 않는다.
        <LinearGradient colors={[`${colors.bg}00`, colors.bg]} locations={[0, 0.45]} style={styles.cta}>
          <Button label="한 조각 남기기" onPress={writeLog} />
        </LinearGradient>
      ) : null}
    </PaperScreen>
  );
}

/** 서브 헤더 우측 글자 버튼 — '토론' · '관리'. 아이콘 없이 모노 라벨로 뜻을 그대로 적는다. */
function HeaderAction({ label, onPress, colors }: { label: string; onPress: () => void; colors: ColorTokens }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={styles.headerAction}>
      <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

/** 08-31 → 8/31 */
function compactDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function PublicClubPreview({
  club,
  adoptTarget,
  shareProgress,
  onAdoptTargetChange,
  onShareProgressChange,
  onJoin,
  joining,
}: {
  club: ClubPreview;
  adoptTarget: boolean;
  shareProgress: boolean;
  onAdoptTargetChange: (value: boolean) => void;
  onShareProgressChange: (value: boolean) => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';

  return (
    <PaperScreen>
      <SubHeader category="추천 모임" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TiltCover uri={club.book?.coverUrl} title={club.book?.title} width={58} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: colors.text }]}>{club.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{club.book?.title}</Text>
            <View style={styles.headerTags}>
              <Tag label={`${club.memberCount}/${club.memberLimit}명`} />
              {ended ? (
                <Tag label="종료" />
              ) : (
                <Tag label={club.status === 'RECRUITING' ? '모집 중' : '진행 중'} />
              )}
            </View>
          </View>
        </View>

        {club.description ? (
          <Card>
            <Text style={[typeScale.body, { color: colors.textMuted, lineHeight: 22 }]}>
              {club.description}
            </Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Eyebrow plain>모임 정보</Eyebrow>
          <KeyValue label="호스트" value={club.hostNickname ?? '-'} />
          <Rule />
          <KeyValue label="인원" value={`${club.memberCount} / ${club.memberLimit}`} />
          <Rule />
          <KeyValue label="기간" value={`${compactDate(club.startsAt)}-${compactDate(club.endsAt)}`} />
        </Card>

        {club.joinable ? (
          <Card style={{ gap: spacing.md }}>
            <Eyebrow plain>참가 설정</Eyebrow>
            <Toggle
              label="진척 공개"
              description="끄면 리더보드에 비공개로 표시되고 모임 평균 계산에서 빠집니다."
              value={shareProgress}
              onChange={onShareProgressChange}
            />
            <Toggle
              label="모임 목표일을 내 목표로"
              description={`${club.endsAt}을 내 완독 목표일로 삼습니다.`}
              value={adoptTarget}
              onChange={onAdoptTargetChange}
            />
          </Card>
        ) : club.joinBlockedReason ? (
          <Text style={[styles.error, { color: colors.danger }]}>{club.joinBlockedReason}</Text>
        ) : null}

        <Button
          label={club.alreadyMember ? '모임 홈 보기' : '참가하기'}
          disabled={!club.joinable && !club.alreadyMember}
          loading={joining}
          onPress={() => {
            if (club.alreadyMember) router.replace(`/club/${club.id}`);
            else onJoin();
          }}
        />
      </ScrollView>
    </PaperScreen>
  );
}

function CheckpointGrid({ checkpoints, colors }: {
  checkpoints: Checkpoint[];
  colors: ColorTokens;
}) {
  return (
    <View style={styles.grid}>
      {checkpoints.map((cp) => {
        const state = !cp.evaluated ? 'pending' : cp.myAchieved ? 'met' : 'missed';
        return (
          <View key={cp.id} style={styles.gridCell}>
            <View
              style={[
                styles.gridMark,
                { borderColor: colors.line, backgroundColor: colors.surface },
                state === 'met' && { backgroundColor: colors.accent, borderColor: colors.accent },
                state === 'missed' && { borderColor: colors.danger },
              ]}
            >
              <Text
                style={[
                  styles.gridMarkText,
                  { color: colors.textFaint },
                  state === 'met' && { color: colors.onAccent },
                  state === 'missed' && { color: colors.danger },
                ]}
              >
                {state === 'met' ? '✓' : state === 'missed' ? '×' : '·'}
              </Text>
            </View>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{cp.seq}주</Text>
            <Numeral style={[styles.gridPage, { color: colors.textFaint }]}>{cp.targetPage}</Numeral>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  headerActions: { flexDirection: 'row', gap: spacing.md },
  headerAction: { paddingVertical: spacing.xs },
  header: { flexDirection: 'row', gap: spacing.md },
  title: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27 },
  headerTags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontFamily: mono.regular, fontSize: 11 },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekNavLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 1.2 },
  board: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.xl },
  checkpointHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  checkpointTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  checkpointTarget: { fontSize: 14 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontFamily: mono.semiBold, fontSize: 14, letterSpacing: 3 },
  grid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  gridCell: { alignItems: 'center', gap: 4, width: 52 },
  gridMark: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridMarkText: { fontFamily: mono.semiBold, fontSize: 14 },
  gridPage: { fontSize: 10 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  error: { ...typeScale.body, padding: spacing.lg },
});
