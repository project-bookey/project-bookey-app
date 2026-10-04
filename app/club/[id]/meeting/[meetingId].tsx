import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi } from '@/api/endpoints';
import { StatStrip, confirmAsync, notify } from '@/components/club';
import { todayKst } from '@/components/clubLog';
import {
  isTodayOrLater,
  meetingClock,
  meetingClock12,
  meetingDateLong,
  meetingDay,
  meetingFull,
  meetingState,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Avatar } from '@/components/Avatar';
import { Button, Card, EmptyState, Eyebrow, Loading, TextLink, formatClock, linkLabel } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle, sans } from '@/theme/tokens';

/**
 * 모임 상세 — 예전 골격(굵은 제목 · 큰 시간 카드 · 장소/설명/참여자/함께 독서 카드)을 그대로 두고
 * 이번 라운드의 수정만 이식했다(2026-09-29 사용자 결정 A + 숫자 띠): 글꼴은 토큰(sans.extraBold)으로,
 * 제목 아래 숫자 띠(날짜·시간·참여), 지도는 헤어라인 틀 + 잉크 점, 참여자는 표준 아바타,
 * 취소는 확인 창, 오류는 notify · EmptyState, 뒤로 가기는 SubHeader 기본 동작.
 * 함께 독서를 끝내면 그 모임의 공유 노트로 간다 — 멤버 모두가 같은 대형노트에 그날을 함께 남긴다.
 * 노트는 모임 상세에서 언제든 다시 열 수 있다.
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

  const openNote = () => router.push({
    pathname: '/club/[id]/note/[meetingId]',
    params: { id: String(clubId), meetingId: String(mid) },
  });

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
      qc.invalidateQueries({ queryKey: ['activityCards'] });
      notify(`같이 읽은 시간(${formatClock(card.durationSec)})을 기록했어요. 모임 노트에 기록 카드를 스티커로 붙일 수 있어요.`);
      openNote();
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
  // 시작 시각이 지나도 그날(KST)은 진행 중인 모임이다 — 같이 읽기는 모임 자리에서 쓰는 기능이라 그날 안에는 시작할 수 있다.
  const canStartTogether = isTodayOrLater(m, todayKst());
  const statusLine = state === 'open'
    ? '참여를 기다리고 있어요'
    : state === 'past'
      ? canStartTogether ? '진행 중인 모임이에요' : '지난 모임이에요'
      : '취소된 모임이에요';
  const attendees = m.attendees ?? [];
  const full = meetingFull(m);
  // 모임은 멤버 누구나 연다 — 취소는 연 사람(m.host)과 클럽 호스트만.
  const canCancel = isHost || m.host;
  const running = current.data?.meetingId === mid;
  const otherRunning = Boolean(current.data && !running);
  const otherMeetingId = otherRunning ? current.data?.meetingId : undefined;
  const elapsed = running && current.data
    ? Math.max(0, Math.floor((now - new Date(current.data.startedAt).getTime()) / 1000))
    : 0;
  const openMap = () => {
    const q = m.latitude != null && m.longitude != null ? `${m.latitude},${m.longitude}` : m.address;
    void Linking.openURL(m.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(q)}`);
  };
  // 주요 행동은 한 번에 하나 — 참여 전엔 '참여하기', 참여 뒤엔 '독서 실행'이 악센트 버튼이 된다.
  const joinFirst = state === 'open' && !m.attending;
  const heading = (label: string) => <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{label}</Text>;

  return (
    <PaperScreen>
      <SubHeader category="모임 상세" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ gap: spacing.xs }}>
          <Eyebrow>클럽 모임</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>{m.title}</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>{statusLine}</Text>
        </View>

        {/* 숫자 띠 — 클럽 홈과 같은 공용 StatStrip(날짜 · 시간 · 참여) */}
        <StatStrip
          cells={[
            { label: '날짜', value: meetingDay(m.startsAt), unit: ` ${meetingWeekday(m.startsAt)}` },
            { label: '시간', value: meetingClock(m.startsAt) },
            {
              label: '참여',
              value: String(m.attendeeCount),
              unit: m.maxAttendees != null ? ` / ${m.maxAttendees}명` : '명',
            },
          ]}
        />

        {/* 읽을 책 — 다가오는 모임의 책이 클럽의 지금 읽는 책이 된다. 누르면 책 상세 */}
        {m.book ? (
          <Pressable
            onPress={() => router.push(`/book/${m.book!.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`읽을 책 ${m.book.title}`}
            style={({ pressed }) => [styles.bookRow, pressed && pressedStyle]}
          >
            <TiltCover uri={m.book.coverUrl} title={m.book.title} width={44} tilt={0} entering={false} />
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow>읽을 책</Eyebrow>
              <Text numberOfLines={2} style={[typeScale.label, { color: colors.text }]}>{linkLabel(m.book.title)}</Text>
              {m.book.author ? (
                <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>{m.book.author}</Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        {/* 날짜 카드 — 가운데 큰 시간. 악센트는 아래 주요 버튼 몫이라 본문 잉크로 */}
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{meetingDateLong(m.startsAt)}</Text>
          <Text style={[styles.time, { color: colors.text }]}>{meetingClock12(m.startsAt)}</Text>
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
                  <Avatar uri={person.avatarUrl} nickname={person.nickname} size={34} />
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
            // 정원이 차면 새로 참여할 수 없다 — 이미 참여한 사람은 취소할 수 있다.
            <Button
              label={m.attending ? '참여 취소' : full ? '정원이 찼어요' : '참여하기'}
              variant={m.attending ? 'outline' : 'primary'}
              disabled={!m.attending && full}
              onPress={() => attend.mutate()}
              loading={attend.isPending}
              style={{ marginTop: spacing.xs }}
            />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          {heading('같이 읽기')}
          <Text style={[styles.timer, { color: running ? colors.text : colors.textFaint }]}>
            {formatClock(elapsed)}
          </Text>
          <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            {otherRunning
              ? '다른 모임에서 같이 읽는 중이에요. 그 모임에서 끝낼 수 있어요.'
              : running
                ? '같이 읽는 시간을 재고 있어요.'
                : state === 'cancelled'
                  ? '취소된 모임은 같이 읽기를 시작할 수 없어요.'
                  : !canStartTogether
                    ? '모임 날이 지나 같이 읽기를 시작할 수 없어요.'
                    : "모임에서 '같이 읽기 시작'을 누르고, 다 읽은 뒤 모임 노트에 소감을 함께 남겨 보세요."}
          </Text>
          {/* 재고 있으면 모임 날이 지났든 취소됐든 언제나 끝낼 수 있다 — 시작만 그날 안으로 묶는다. */}
          <Button
            label={running ? '같이 읽기 끝내기' : '같이 읽기 시작'}
            variant={running ? 'danger' : joinFirst ? 'outline' : 'primary'}
            disabled={!running && (otherRunning || !canStartTogether)}
            onPress={() => (running ? end.mutate() : start.mutate())}
            loading={start.isPending || end.isPending}
          />
          {otherMeetingId != null ? (
            <TextLink
              label="같이 읽는 모임"
              onPress={() => router.push({
                pathname: '/club/[id]/meeting/[meetingId]',
                params: { id: String(clubId), meetingId: String(otherMeetingId), ...(isHost ? { host: '1' } : {}) },
              })}
              accessibilityRole="link"
              style={styles.togetherLink}
            />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          {heading('모임 노트')}
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {state === 'cancelled'
              ? '취소된 모임의 노트는 볼 수만 있어요.'
              : '멤버 모두가 노트 한 장에 그날의 생각·사진·스티커를 붙여요. 다른 사람이 쓰는 모습도 바로 보여요.'}
          </Text>
          <TextLink
            label="모임 노트"
            onPress={openNote}
            accessibilityRole="link"
            accessibilityLabel="모임 노트 열기"
            hitSlop={null}
            style={styles.link}
          />
        </Card>

        {canCancel && state === 'open' ? (
          // 파괴적 동작 — 주요 버튼들과 섹션 간격(xl) 이상 떼어 둔다.
          <Button
            label="모임 취소"
            variant="danger"
            style={{ marginTop: spacing.xl }}
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
  // 읽을 책 — 표지와 제목 묶음이 한 줄, 줄 전체가 책 상세로 가는 링크.
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  container: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  // 예전의 굵은 산세리프 제목 — fontWeight 만 있던 것을 sans.extraBold 토큰으로.
  title: { fontFamily: sans.extraBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5, marginTop: 2 },
  time: { fontFamily: sans.extraBold, fontSize: 38, lineHeight: 46, letterSpacing: -0.5, marginTop: 2 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  // 다른 모임에서 재는 중일 때 그 모임으로 — 가운데 줄 맞춤(카드의 시계·안내와 같은 축).
  togetherLink: { alignSelf: 'center' },
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
