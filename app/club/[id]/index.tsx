import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import type { Checkpoint, ClubHome, ClubPreview, MemberProgress, NudgeMessageKey } from '@/api/types';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Loading, Numeral, ProgressBar, Rule, Tag, Toggle,
  formatDuration, formatRelative, percent,
} from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { getPaceStyle, hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

const NUDGES: { key: NudgeMessageKey; label: string }[] = [
  { key: 'READ_TOGETHER', label: '같이 읽어요' },
  { key: 'CHECKPOINT_SOON', label: '체크포인트 임박' },
  { key: 'WAITING', label: '기다리고 있어요' },
];

/** 모임 홈 (§12.2) — 멤버 진척 리스트 · 체크포인트 그리드 */
export default function ClubHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const [nudgeTarget, setNudgeTarget] = useState<MemberProgress | null>(null);
  const [shareProgress, setShareProgress] = useState(true);
  const [adoptTarget, setAdoptTarget] = useState(true);

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
      setNudgeTarget(null);
      notify(`찌르기를 보냈어요. 오늘 ${result.remainingToday}번 남았습니다.`);
    },
    onError: (e) => {
      setNudgeTarget(null);
      notify(e instanceof ApiError ? e.message : '보내지 못했습니다.');
    },
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

  return (
    <PaperScreen>
      <SubHeader category="모임" />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={undefined}
      >
        <View style={styles.header}>
          <TiltCover uri={data.book?.coverUrl} title={data.book?.title} width={58} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: colors.text }]}>{data.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{data.book?.title}</Text>
            <View style={styles.headerTags}>
              <Tag label={data.myRole === 'HOST' ? '호스트' : '멤버'} />
              <Tag label={`${data.memberCount}/${data.memberLimit}명`} />
              {ended ? (
                <Tag label="종료" />
              ) : (
                <Tag label={`D-${Math.max(0, data.daysLeft)}`} />
              )}
            </View>
          </View>
        </View>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.summaryRow}>
            <SummaryCell
              label="모임 평균"
              value={percent(data.averageCompletionRate)}
              colors={colors}
            />
            <View style={[styles.vRule, { backgroundColor: colors.line }]} />
            <SummaryCell
              label="내 순위"
              value={`${data.myRank} / ${data.memberCount}`}
              colors={colors}
            />
            <View style={[styles.vRule, { backgroundColor: colors.line }]} />
            <SummaryCell
              label="기간"
              value={`${compactDate(data.startsAt)}–${compactDate(data.endsAt)}`}
              colors={colors}
            />
          </View>
          <Rule />
          <View style={styles.codeRow}>
            <View>
              <Eyebrow>초대 코드</Eyebrow>
              <Text style={[styles.code, { color: colors.text }]}>{data.joinCode}</Text>
            </View>
            <Button
              label="토론 열기"
              size="sm"
              variant="outline"
              onPress={() => router.push(`/club/${clubId}/posts`)}
            />
          </View>
        </Card>

        {data.nextCheckpoint ? (
          <View>
            <Eyebrow>다음 체크포인트</Eyebrow>
            <Card style={{ marginTop: spacing.sm, gap: spacing.sm }}>
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
          </View>
        ) : null}

        <View>
          <Eyebrow>멤버 진척</Eyebrow>
          <Card style={{ marginTop: spacing.sm, padding: 0 }}>
            {data.members.map((member, index) => (
              <View key={member.clubMemberId}>
                {index > 0 ? <Rule /> : null}
                <MemberRow
                  member={member}
                  rank={index + 1}
                  colors={colors}
                  onNudge={() => setNudgeTarget(member)}
                />
              </View>
            ))}
          </Card>
        </View>

        {data.checkpoints.length > 0 ? (
          <View>
            <Eyebrow>체크포인트 진행</Eyebrow>
            <CheckpointGrid checkpoints={data.checkpoints} colors={colors} />
          </View>
        ) : null}

        {nudgeTarget ? (
          <Card style={{ gap: spacing.sm }}>
            <Eyebrow>{nudgeTarget.nickname}님에게 보내기</Eyebrow>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              프리셋 문구만 보낼 수 있습니다. 같은 사람에게 24시간에 한 번.
            </Text>
            <View style={styles.nudgeButtons}>
              {NUDGES.map((item) => (
                <Button
                  key={item.key}
                  label={item.label}
                  size="sm"
                  variant="outline"
                  style={{ flexGrow: 1 }}
                  loading={nudge.isPending}
                  onPress={() => nudge.mutate({ userId: nudgeTarget.userId, key: item.key })}
                />
              ))}
            </View>
            <Button label="취소" variant="ghost" size="sm" onPress={() => setNudgeTarget(null)} />
          </Card>
        ) : null}

        {ended ? (
          <Button
            label="모임 결산 보기"
            variant="outline"
            onPress={() => router.push(`/club/${clubId}/result`)}
          />
        ) : null}

        <ClubFooterActions
          club={data}
          onLeft={() => {
            queryClient.invalidateQueries({ queryKey: ['clubs'] });
            router.replace('/clubs');
          }}
        />
      </ScrollView>
    </PaperScreen>
  );
}

/** 08-31 → 8/31 */
function compactDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function SummaryCell({ label, value, colors }: {
  label: string;
  value: string;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
      <Numeral style={[styles.summaryValue, { color: colors.text }]}>{value}</Numeral>
    </View>
  );
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

function MemberRow({ member, rank, colors, onNudge }: {
  member: MemberProgress;
  rank: number;
  colors: ColorTokens;
  onNudge: () => void;
}) {
  const pace = member.paceStatus ? getPaceStyle(colors)[member.paceStatus] : null;

  return (
    <View style={[styles.memberRow, member.isMe && { backgroundColor: colors.surfaceRaised }]}>
      <Numeral style={[styles.rank, { color: colors.textFaint }]}>{rank}</Numeral>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.memberHead}>
          <Text style={[typeScale.label, { color: colors.text }]}>
            {member.nickname}
            {member.isMe ? ' (나)' : ''}
          </Text>
          {member.role === 'HOST' ? <Tag label="호스트" /> : null}
          {member.finished ? <Tag label="완독" fg={colors.accent} bg={colors.accentSoft} /> : null}
          {pace && !member.finished ? <Tag label={pace.label} fg={pace.fg} bg={pace.bg} /> : null}
        </View>

        {member.shareProgress ? (
          <>
            <ProgressBar value={member.completionRate} height={5} />
            <View style={styles.memberMeta}>
              <Numeral style={[styles.memberNumeral, { color: colors.textMuted }]}>
                {member.currentPage}쪽 · {percent(member.completionRate)} ·{' '}
                {formatDuration(member.totalDurationSec)}
              </Numeral>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                {formatRelative(member.lastReadAt)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>진척 비공개</Text>
        )}
      </View>

      {member.nudgeable ? (
        <Pressable onPress={onNudge} style={[styles.nudgeButton, { borderColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>찌르기</Text>
        </Pressable>
      ) : null}
    </View>
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

function ClubFooterActions({ club, onLeft }: { club: ClubHome; onLeft: () => void }) {
  const queryClient = useQueryClient();
  const leave = useMutation({
    mutationFn: () => clubApi.leave(club.id),
    onSuccess: onLeft,
    onError: (e) => notify(e instanceof ApiError ? e.message : '나가지 못했습니다.'),
  });
  const rotate = useMutation({
    mutationFn: () => clubApi.rotateCode(club.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      notify('초대 코드를 새로 발급했습니다.');
    },
  });

  return (
    <View style={{ gap: spacing.sm }}>
      <Rule />
      {club.myRole === 'HOST' ? (
        <Button
          label="초대 코드 재발급"
          variant="ghost"
          size="sm"
          loading={rotate.isPending}
          onPress={() => rotate.mutate()}
        />
      ) : null}
      <Button
        label="모임 나가기"
        variant="ghost"
        size="sm"
        loading={leave.isPending}
        onPress={() => leave.mutate()}
      />
    </View>
  );
}

function notify(message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', gap: spacing.md },
  title: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27 },
  headerTags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  summaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  summaryCell: { flex: 1, gap: 4 },
  summaryValue: { fontSize: 14 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontFamily: mono.semiBold, fontSize: 22, letterSpacing: 5 },
  checkpointHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  checkpointTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  checkpointTarget: { fontSize: 14 },
  memberRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  rank: { fontSize: 12, width: 14 },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  memberMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  memberNumeral: { fontSize: 11 },
  nudgeButton: {
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  nudgeButtons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
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
  error: { ...typeScale.body, padding: spacing.lg },
});
