import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi } from '@/api/endpoints';
import { StatStrip, confirmAsync, notify } from '@/components/club';
import {
  MEETING_STATE_LABEL,
  meetingClock,
  meetingDateLine,
  meetingDay,
  meetingState,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Button, EmptyState, Eyebrow, FootAction, Loading, formatClock, linkLabel } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';

/**
 * 약속 상세 — 활자·괘선 판면. 상태 아이브로우 · 큰 명조 제목 · 모노 날짜 줄 · 숫자 띠(날짜·시간·참여) 아래로
 * 장소(지도) · 설명 · 참여자 · 함께 독서 순. 호스트의 '약속 취소'는 맨 아래 위험 톤 글자 링크.
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
      notify('약속을 취소했어요.');
    },
    onError: fail('약속을 취소하지 못했어요.'),
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
        <SubHeader category="약속" />
        <Loading />
      </PaperScreen>
    );
  }
  const m = meeting.data;
  if (!m) {
    return (
      <PaperScreen>
        <SubHeader category="약속" />
        <EmptyState
          title="약속을 불러오지 못했어요"
          description={meeting.error instanceof ApiError ? meeting.error.message : undefined}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => meeting.refetch()} />}
        />
      </PaperScreen>
    );
  }

  const state = meetingState(m);
  // 상태는 링크·CTA 가 아니라 잉크로 — 목록의 상태 글자와 같은 색 규칙.
  const stateColor = state === 'cancelled' ? colors.danger : state === 'past' ? colors.textFaint : colors.text;
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

  return (
    <PaperScreen>
      <SubHeader category="약속" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[typeScale.monoEyebrow, { color: stateColor }]}>{MEETING_STATE_LABEL[state]}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
          <Text style={[styles.dateLine, { color: colors.textMuted }]}>{meetingDateLine(m.startsAt, m.endsAt)}</Text>
        </View>

        <StatStrip
          cells={[
            { label: '날짜', value: meetingDay(m.startsAt), unit: ` ${meetingWeekday(m.startsAt)}` },
            { label: '시간', value: meetingClock(m.startsAt) },
            { label: '참여', value: String(m.attendeeCount), unit: '명' },
          ]}
        />

        <View style={styles.section}>
          <Eyebrow>장소</Eyebrow>
          <Text style={[styles.place, { color: colors.text }]}>{m.placeName}</Text>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>{m.address}</Text>
          {m.latitude != null ? <PlaceMap latitude={m.latitude} longitude={m.longitude} /> : null}
          <View style={styles.link}>
            <FootAction label="지도 앱에서 열기" kind="nav" tone="accent" onPress={openMap} />
          </View>
        </View>

        {m.description ? (
          <View style={styles.section}>
            <Eyebrow>설명</Eyebrow>
            <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>{m.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Eyebrow>참여자 {m.attendeeCount}명</Eyebrow>
          {attendees.length > 0 ? (
            <View>
              {attendees.map((person) => (
                <View key={person.userId} style={[styles.personRow, { borderBottomColor: colors.line }]}>
                  <QuoteAvatar uri={person.avatarUrl} nickname={person.nickname} size={30} />
                  <Text style={[typeScale.label, { color: colors.text }]}>{person.nickname}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              아직 참여자가 없어요. 첫 참여자가 되어 보세요.
            </Text>
          )}
          {state === 'open' ? (
            <Button
              label={m.attending ? '참여 취소' : '이 약속에 참여하기'}
              variant={m.attending ? 'outline' : 'primary'}
              onPress={() => attend.mutate()}
              loading={attend.isPending}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Eyebrow>함께 독서</Eyebrow>
          <Text style={[styles.timer, { color: running ? colors.text : colors.textFaint }]}>{formatClock(elapsed)}</Text>
          <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            {otherRunning
              ? '다른 약속에서 독서를 실행 중이에요.'
              : running
                ? '이 약속의 독서 시간을 기록하고 있어요.'
                : '약속 현장에서 독서 실행을 눌러 기록을 남겨 보세요.'}
          </Text>
          <Button
            label={running ? '독서 종료' : '독서 실행'}
            variant={running ? 'danger' : 'primary'}
            disabled={otherRunning || state !== 'open'}
            onPress={() => (running ? end.mutate() : start.mutate())}
            loading={start.isPending || end.isPending}
          />
        </View>

        {isHost && state === 'open' ? (
          <View style={styles.footer}>
            <FootAction
              label="약속 취소"
              kind="action"
              tone="danger"
              onPress={async () => {
                if (await confirmAsync('이 약속을 취소할까요? 참여자에게도 취소로 보여요.', '약속 취소')) cancel.mutate();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  title: { ...typeScale.displaySerif, fontSize: 27, lineHeight: 34 },
  dateLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  section: { gap: spacing.sm },
  place: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23 },
  link: { flexDirection: 'row' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
  },
  timer: {
    fontFamily: mono.semiBold,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  footer: { alignItems: 'center', paddingTop: spacing.sm },
});
