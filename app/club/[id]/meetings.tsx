import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubMeeting, type ClubMeetingInput } from '@/api/endpoints';
import { MeetingFormFields, useMeetingForm } from '@/components/club/MeetingForm';
import {
  MEETING_STATE_LABEL,
  attendeeLabel,
  isTodayOrLater,
  meetingClock,
  meetingDay,
  meetingState,
  meetingFull,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { ReturnToClubHome } from '@/components/club/ReturnToClubHome';
import { todayKst } from '@/components/clubLog';
import { KeyboardScroll, useScrollReveal } from '@/components/keyboard';
import { Avatar } from '@/components/Avatar';
import { Button, EmptyState, Eyebrow, Loading } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, mono, pressedStyle } from '@/theme/tokens';

/**
 * 모임 탭 — 클럽 홈 '모임' 탭의 본문. 위는 괘선 머리줄(개수 · 만들기), 아래는 모임을
 * 활자·괘선 판면으로 한 줄씩(왼쪽 모노 날짜 칸, 오른쪽 명조 제목·장소·참여). 모임은 멤버 누구나 연다 —
 * '모임 만들기'를 누르면 목록 위에 새 모임 폼이 펼쳐진다(끝난 클럽에선 버튼이 없다). 모임마다 읽을 책을
 * 고를 수 있고(선택), 다가오는 모임의 책이 클럽의 지금 읽는 책이 된다 — 진척 · 스포일러 가림 · 지금 읽는 중이 그 책을 본다.
 */
export function ClubMeetingsBody({ isHost, ended, initialOpen = false }: {
  /** 클럽 호스트 — 모임 상세에서 남이 연 모임도 취소할 수 있다. */
  isHost: boolean;
  /** 끝난 클럽 — 새 모임을 열 수 없다. */
  ended: boolean;
  /** 클럽 홈의 '모임 만들기'로 들어오면 새 모임 폼을 펼친 채로 연다. */
  initialOpen?: boolean;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [open, setOpen] = useState(initialOpen && !ended);
  // 폼 아래쪽 칸(최대 인원·설명)을 누르면 '모임 열기'까지 키보드 위로 올린다.
  const scrollRef = useRef<ScrollView>(null);
  const submitRef = useRef<View>(null);
  const revealAbove = useScrollReveal(scrollRef);
  const form = useMeetingForm();

  const list = useQuery({
    queryKey: ['clubMeetings', clubId],
    queryFn: () => clubCommunityApi.meetings(clubId),
  });
  const create = useMutation({
    mutationFn: (body: ClubMeetingInput) => clubCommunityApi.createMeeting(clubId, body),
    onSuccess: () => {
      setOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['clubMeetings', clubId] });
      // 다가오는 모임의 책이 바뀌었을 수 있다 — 클럽 홈의 지금 읽는 책 · 진척을 다시 받는다.
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
  const canCreate = form.ready && !create.isPending;
  const meetings = list.data ?? [];

  return (
    <View style={styles.fill}>
      <View style={[styles.head, { borderBottomColor: colors.line }]}>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 · {meetings.length}개</Text>
        {!ended ? (
          // 이 탭의 주요 행동 — 글자 링크가 아니라 테두리 버튼으로 크게(악센트는 폼의 '모임 열기' 몫).
          <Button label={open ? '닫기' : '모임 만들기'} variant="outline" onPress={() => setOpen((v) => !v)} />
        ) : null}
      </View>
      <KeyboardScroll ref={scrollRef} contentContainerStyle={styles.container}>
        {open ? (
          <View style={[styles.form, { borderColor: colors.lineStrong }]}>
            <Eyebrow>새 모임</Eyebrow>
            <MeetingFormFields
              clubId={clubId}
              form={form}
              onLowerFieldFocus={() => revealAbove(submitRef)}
              onLowerFieldGrow={() => revealAbove(submitRef, { onlyIfOpen: true })}
            />
            <View ref={submitRef} style={styles.submit}>
              <Button label="모임 열기" onPress={() => create.mutate(form.toInput())} disabled={!canCreate} loading={create.isPending} />
            </View>
            {form.missing ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                제목과 장소를 정하면 열 수 있어요.
              </Text>
            ) : null}
            {create.error ? (
              <Text style={[typeScale.caption, { color: colors.danger }]}>
                {create.error instanceof ApiError ? create.error.message : '모임을 만들지 못했어요. 입력 내용을 확인해 주세요.'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {list.isLoading ? (
          <Loading />
        ) : meetings.length === 0 ? (
          <EmptyState
            title="아직 모임이 없어요"
            description={ended ? undefined : '첫 모임을 열고 함께 읽을 날을 잡아 보세요.'}
          />
        ) : (
          <View>
            {meetings.map((m) => (
              <MeetingRow
                key={m.id}
                meeting={m}
                onPress={() =>
                  router.push({
                    pathname: '/club/[id]/meeting/[meetingId]',
                    params: { id: String(clubId), meetingId: String(m.id), host: isHost ? '1' : '0' },
                  })
                }
              />
            ))}
          </View>
        )}
      </KeyboardScroll>
    </View>
  );
}

/**
 * 모임 한 줄 — 왼쪽 모노 날짜 칸(10.1 / 목 19:30), 오른쪽 명조 제목 · 읽을 책 · 장소 · 참여자 아바타.
 * 지난 모임·취소는 글자를 죽인다. 줄 전체가 상세로 가는 링크라 별도 '자세히 보기'는 없다.
 * 내가 참여한 오늘 이후의 모임은 초록 테두리로 감싸고 상태를 '참여해요'로 — 홈 탭 다가오는 모임 카드와 같은 기준.
 */
function MeetingRow({ meeting: m, onPress }: { meeting: ClubMeeting; onPress: () => void }) {
  const { colors } = useTheme();
  const state = meetingState(m);
  const mine = m.attending && isTodayOrLater(m, todayKst());
  const dim = state !== 'open' && !mine;
  const attendees = m.attendees ?? [];
  const stateColor = mine || state === 'open' ? colors.text : state === 'cancelled' ? colors.danger : colors.textFaint;
  // 열린 모임이라도 정원이 찼으면 '정원 마감'으로 알린다.
  const stateLabel = mine
    ? '참여해요'
    : state === 'open' && meetingFull(m)
      ? '정원 마감'
      : MEETING_STATE_LABEL[state];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.title} 모임 상세`}
      style={({ pressed }) => [
        styles.row,
        mine ? [styles.mineRow, { borderColor: colors.accent }] : { borderBottomColor: colors.line },
        pressed ? pressedStyle : null,
      ]}
    >
      <View style={styles.dateCell}>
        <Text style={[styles.dateDay, { color: dim ? colors.textFaint : colors.text }]}>{meetingDay(m.startsAt)}</Text>
        <Text style={[styles.dateSub, { color: colors.textFaint }]}>
          {meetingWeekday(m.startsAt)} {meetingClock(m.startsAt)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: dim ? colors.textMuted : colors.text }]}>
            {m.title}
          </Text>
          <Text style={[typeScale.monoEyebrow, { color: stateColor }]}>{stateLabel}</Text>
        </View>
        {m.book ? (
          <Text numberOfLines={1} style={[typeScale.caption, { color: colors.text }]}>읽을 책 · {m.book.title}</Text>
        ) : null}
        <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>{m.placeName}</Text>
        <View style={styles.people}>
          {attendees.length > 0 ? (
            <View style={styles.avatars}>
              {attendees.slice(0, 4).map((p, i) => (
                <View key={p.userId} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -6, borderColor: colors.bg }]}>
                  <Avatar uri={p.avatarUrl} nickname={p.nickname} size={20} />
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[styles.peopleText, { color: colors.textFaint }]}>
            {attendees.length > 0 || m.maxAttendees != null ? attendeeLabel(m) : '아직 참여자 없음'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: hairline,
  },
  container: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  form: { marginTop: spacing.lg, borderWidth: hairline, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  // 입력들과 떼어 둔다 — 폼 간격(md)에 md 를 더해 xl.
  submit: { marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: hairline },
  // 내가 참여한 모임 — 줄을 테두리 상자로 감싸되, 음수 마진 짝으로 글자 줄은 다른 줄과 맞춘다.
  mineRow: {
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    marginVertical: spacing.xs,
  },
  dateCell: { width: 58, gap: 2, paddingTop: 2 },
  dateDay: { fontFamily: mono.semiBold, fontSize: 18, lineHeight: 22 },
  dateSub: { fontFamily: mono.regular, fontSize: 9.5, letterSpacing: 0.3 },
  rowBody: { flex: 1, gap: 3 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  rowTitle: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23, flexShrink: 1 },
  people: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: radius.round, borderWidth: 2 },
  peopleText: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.3 },
});

/** 딥링크 호환 — 모임은 이제 클럽 홈의 탭이다. */
export default function ClubMeetingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReturnToClubHome clubId={id} tab="meetings" />;
}
