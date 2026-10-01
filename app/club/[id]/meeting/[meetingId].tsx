import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi } from '@/api/endpoints';
import { StatStrip, confirmAsync, notify } from '@/components/club';
import {
  meetingClock,
  meetingClock12,
  meetingDateLong,
  meetingDay,
  meetingState,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Button, Card, EmptyState, Eyebrow, Loading, formatClock, linkLabel } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';
import { sans } from '@/theme/tokens';

/**
 * 모임 상세 — 예전 골격(굵은 제목 · 큰 민트 시간 카드 · 장소/설명/참여자/함께 독서 카드)을 그대로 두고
 * 이번 라운드의 수정만 이식했다(2026-09-29 사용자 결정 A + 숫자 띠): 글꼴은 토큰(Pretendard ExtraBold)으로,
 * 제목 아래 숫자 띠(날짜·시간·참여), 지도는 헤어라인 틀 + 잉크 점, 참여자는 표준 아바타,
 * 취소는 확인 창, 오류는 notify · EmptyState, 뒤로 가기는 SubHeader 기본 동작.
 */
export default function MeetingDetailScreen() {
  const { id, meetingId, host } = useLocalSearchParams<{ id: string; meetingId: string; host?: string }>();
  const clubId = Number(id);
  const mid = Number(meetingId);
  const isHost = host === '1';
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());

  const meeting = useQuery({
    queryKey: ['clubMeeting', clubId, mid],
    queryFn: () => clubCommunityApi.meeting(clubId, mid),
  });
  const current = useQuery({
    queryKey: ['clubActivity', clubId, 'current'],
    queryFn: () => clubCommunityApi.currentActivity(clubId),
  });
  useEffect(() => {
    if (!current.data) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [current.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['clubMeeting', clubId, mid] });
    qc.invalidateQueries({ queryKey: ['clubMeetings', clubId] });
  };
  const fail = (fallback: string) => (e: unknown) => notify(e instanceof ApiError ? e.message : fallback);
  const attend = useMutation({
    mutationFn: () =>
      meeting.data?.attending ? clubCommunityApi.unattend(clubId, mid) : clubCommunityApi.attend(clubId, mid),
    onSuccess: refresh,
    onError: fail('참여 상태를 바꾸지 못했어요.'),
  });
  const cancel = useMutation({
    mutationFn: () => clubCommunityApi.cancelMeeting(clubId, mid),
    onSuccess: () => {
      refresh();
      notify('모임을 취소했어요.');
    },
    onError: fail('모임을 취소하지 못했어요.'),
  });
  const start = useMutation({
    mutationFn: () => clubCommunityApi.startActivity(clubId, mid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clubActivity', clubId, 'current'] }),
    onError: fail('독서를 시작하지 못했어요.'),
  });
  const end = useMutation({
    mutationFn: () => clubCommunityApi.endActivity(clubId),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ['clubActivity', clubId] });
      router.push({ pathname: '/club/[id]/activity', params: { id: String(clubId), cardId: String(card.id) } });
    },
    onError: fail('독서를 끝내지 못했어요.'),
  });

  if (meeting.isLoading || current.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="모임 상세" />
        <Loading />
      </PaperScreen>
    );
  }
  const m = meeting.data;
  if (!m) {
    return (
      <PaperScreen>
        <SubHeader category="모임 상세" />
        <EmptyState
          title="모임을 불러오지 못했어요"
          description={meeting.error instanceof ApiError ? meeting.error.message : undefined}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => meeting.refetch()} />}
        />
      </PaperScreen>
    );
  }

  const state = meetingState(m);
  const statusLine =
    state === 'open' ? '참여를 기다리고 있어요' : state === 'past' ? '지난 모임이에요' : '취소된 모임입니다';
  const attendees = m.attendees ?? [];
  const running = current.data?.meetingId === mid;
  const otherRunning = Boolean(current.data && !running);
  const elapsed = running && current.data
    ? Math.max(0, Math.floor((now - new Date(current.data.startedAt).getTime()) / 1000))
    : 0;
  const openMap = () => {
    const q = m.latitude != null && m.longitude != null ? `${m.latitude},${m.longitude}` : m.address;
    void Linking.openURL(m.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(q)}`);
  };
  const heading = (label: string) => <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{label}</Text>;

  return (
    <PaperScreen>
      <SubHeader category="모임 상세" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ gap: 4 }}>
          <Eyebrow>클럽 모임</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>{statusLine}</Text>
        </View>

        {/* 숫자 띠 — 클럽 홈과 같은 공용 StatStrip(날짜 · 시간 · 참여) */}
        <StatStrip
          cells={[
            { label: '날짜', value: meetingDay(m.startsAt), unit: ` ${meetingWeekday(m.startsAt)}` },
            { label: '시간', value: meetingClock(m.startsAt) },
            { label: '참여', value: String(m.attendeeCount), unit: '명' },
          ]}
        />

        {/* 날짜 카드 — 예전처럼 가운데 큰 민트 시간 */}
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{meetingDateLong(m.startsAt)}</Text>
          <Text style={[styles.time, { color: colors.accent }]}>{meetingClock12(m.startsAt)}</Text>
          {m.endsAt ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>{meetingClock12(m.endsAt)}까지</Text>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{m.placeName}</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>{m.address}</Text>
          {m.latitude != null ? <PlaceMap latitude={m.latitude} longitude={m.longitude} /> : null}
          <Button label="지도 앱에서 보기" variant="outline" onPress={openMap} />
        </Card>

        {m.description ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={[typeScale.body, { color: colors.text }]}>{m.description}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          {heading(`참여자 ${m.attendeeCount}명`)}
          {attendees.length > 0 ? (
            <View>
              {attendees.map((person) => (
                <View key={person.userId} style={[styles.personRow, { borderBottomColor: colors.line }]}>
                  <QuoteAvatar uri={person.avatarUrl} nickname={person.nickname} size={34} />
                  <Text style={[typeScale.body, { color: colors.text, flex: 1 }]}>{person.nickname}</Text>
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>참여</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              아직 참여자가 없어요. 첫 참여자가 되어 보세요.
            </Text>
          )}
          {state === 'open' ? (
            <Button
              label={m.attending ? '참여 취소' : '이 모임에 참여하기'}
              variant={m.attending ? 'outline' : 'primary'}
              onPress={() => attend.mutate()}
              loading={attend.isPending}
              style={{ marginTop: spacing.xs }}
            />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          {heading('함께 독서')}
          <Text style={[styles.timer, { color: running ? colors.text : colors.textFaint }]}>
            {formatClock(elapsed)}
          </Text>
          <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            {otherRunning
              ? '다른 모임에서 독서를 실행 중이에요.'
              : running
                ? '이 모임의 독서 시간을 기록하고 있어요.'
                : '모임 현장에서 독서 실행을 눌러 기록을 남겨 보세요.'}
          </Text>
          <Button
            label={running ? '독서 종료' : '독서 실행'}
            variant={running ? 'danger' : 'primary'}
            disabled={otherRunning || state !== 'open'}
            onPress={() => (running ? end.mutate() : start.mutate())}
            loading={start.isPending || end.isPending}
          />
        </Card>

        {isHost && state === 'open' ? (
          <Button
            label="모임 취소"
            variant="ghost"
            loading={cancel.isPending}
            onPress={async () => {
              if (await confirmAsync('이 모임을 취소할까요? 참여자에게도 취소로 보여요.', '모임 취소')) cancel.mutate();
            }}
          />
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  // 예전의 굵은 산세리프 제목 — fontWeight 만 있던 것을 Pretendard ExtraBold 토큰으로.
  title: { fontFamily: sans.extraBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5, marginTop: 2 },
  time: { fontFamily: sans.extraBold, fontSize: 38, lineHeight: 46, letterSpacing: -0.5, marginTop: 2 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
  },
  timer: {
    fontFamily: sans.extraBold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
});
