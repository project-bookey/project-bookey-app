import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, clubCommunityApi } from '@/api/endpoints';
import type { ClubHome, NudgeMessageKey } from '@/api/types';
import { CopyCodeButton, MemberDetail, MemberStrip, StatStrip, confirmAsync, notify } from '@/components/club';
import { meetingDay } from '@/components/club/meetingTime';
import { clubLogKeys, mondayOf, todayKst } from '@/components/clubLog';
import { ICON_SIZE, IconButton, PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Button, EmptyState, Eyebrow, Loading, Rule, linkLabel, percent } from '@/components/ui';
import { iconStroke, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/**
 * 클럽 정보 — 클럽 홈의 ⋯ 와 홈의 '함께하는 사람'에서 들어온다. 홈은 소개 · 모임 · 노트 중심으로 두고,
 * 함께 읽는 사람(지금 읽는 책의 진척 · 찌르기) · 이번 주 카드 · 초대 코드 · 나가기는 여기로 모았다.
 * 운영(코드 재발급 · 자리 · 멤버 · 종료)은 여전히 호스트 전용 설정(/club/[id]/settings)이다.
 */
/**
 * 클럽 나가기 경고 — 나가면 클럽의 정보를 더는 볼 수 없고, 채팅에서는 '나간 멤버'가 되며,
 * 다시 참가해도 새 멤버라 채팅을 다시 열어야 한다(서버가 채팅 이용권을 지운다). 메모는 남는다(2026-10-05).
 */
function leaveWarning(chatCost: number | undefined) {
  const pay = chatCost ? `책갈피 ${chatCost}개를` : '책갈피를';
  return [
    '나가면 이 클럽의 모든 정보가 사라져요. 모임·노트·채팅을 더는 볼 수 없고, 참여하기로 한 모임에서도 빠져요.',
    `채팅에 남긴 메시지는 '나간 멤버'로 바뀌어요. 다시 참가해도 새 멤버로 시작해서, 채팅을 열려면 ${pay} 다시 내야 해요.`,
    '남긴 메모는 그대로 남아요.',
  ].join('\n\n');
}

export default function ClubInfoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const today = todayKst();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });
  // 멤버 칩의 '메모 n'과 '지금 읽는 중' 점 — 클럽 홈과 같은 캐시 키라 대개 이미 있다.
  const isMember = !!club.data;
  const day = useQuery({
    queryKey: clubLogKeys.day(clubId, today),
    queryFn: () => clubApi.logs(clubId, today),
    enabled: isMember,
  });
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    enabled: isMember,
    refetchInterval: 30_000,
  });
  // 나가기 경고에 적을 채팅 이용료 — 클럽 홈의 안 읽음 배지와 같은 캐시 키라 대개 이미 있다.
  const chatState = useQuery({
    queryKey: ['clubChat', clubId, 'state'],
    queryFn: () => clubCommunityApi.chatState(clubId),
    enabled: isMember,
  });

  const nudge = useMutation({
    mutationFn: ({ userId, key }: { userId: number; key: NudgeMessageKey }) =>
      clubApi.nudge(clubId, userId, key),
    onSuccess: (result) => {
      setSelectedUserId(null);
      notify(`찌르기를 보냈어요. 오늘 ${result.remainingToday}번 더 보낼 수 있어요.`);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '보내지 못했어요.'),
  });
  const leave = useMutation({
    mutationFn: () => clubApi.leave(clubId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      // 멤버일 때 받은 클럽 홈 · 미리보기(이미 멤버)가 캐시에 남으면 추천 클럽에서 다시 들어와도 참가 화면 대신
      // 멤버 홈이 열린다 — 둘 다 다시 받게 한다(홈은 403이 되고, 클럽 홈이 그걸 보고 미리보기로 바꾼다).
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      queryClient.invalidateQueries({ queryKey: ['club', 'preview', clubId] });
      // 나가면 채팅 이용권이 사라지고 다시 참가하면 새 멤버다 — 예전의 열린 채팅·내 메시지를 캐시에 남기지 않는다.
      queryClient.removeQueries({ queryKey: ['clubChat', clubId] });
      // 클럽 홈 · 정보 둘 다 걷어 내고 목록으로 — 목록이 스택에 없으면 이 화면을 목록으로 바꾼다.
      router.dismissTo('/clubs');
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '나가지 못했어요.'),
  });

  if (club.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="클럽 정보" />
        <Loading />
      </PaperScreen>
    );
  }
  if (!club.data) {
    return (
      <PaperScreen>
        <SubHeader category="클럽 정보" />
        <EmptyState
          title="클럽을 불러오지 못했어요"
          description={club.error instanceof ApiError ? club.error.message : undefined}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => club.refetch()} />}
        />
      </PaperScreen>
    );
  }

  const data: ClubHome = club.data;
  const ended = data.status === 'ENDED' || data.status === 'ARCHIVED';
  const isHost = data.myRole === 'HOST';
  // 자리 늘리기 — 초대하다 자리가 모자란 호스트가 바로 늘리게 초대 코드 밑에 둔다(클럽 설정에도 같은 버튼이 있다).
  const expandable = isHost && !ended && data.seatPolicy != null && data.memberLimit < data.seatPolicy.maxLimit;
  const selectedMember = data.members.find((m) => m.userId === selectedUserId) ?? null;
  const readingNowIds = new Set((readingNow.data ?? []).map((r) => r.userId));
  const logCounts = new Map<number, number>();
  (day.data?.logs ?? []).forEach((l) => logCounts.set(l.authorId, (logCounts.get(l.authorId) ?? 0) + 1));

  return (
    <PaperScreen>
      <SubHeader
        category="클럽 정보"
        right={
          isHost ? (
            <IconButton onPress={() => router.push(`/club/${clubId}/settings`)} accessibilityLabel="클럽 관리">
              <Settings size={ICON_SIZE.plain} color={colors.text} {...iconStroke} />
            </IconButton>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* 머리 — 명조 이름과 모노 책 줄, 괘선 사이 숫자 띠 */}
        <View style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <TiltCover uri={data.book?.coverUrl} title={data.book?.title} width={58} tilt={0} entering={false} />
            <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
              <Text style={[styles.title, { color: colors.text }]}>{data.name}</Text>
              <Text style={[styles.bookLine, { color: colors.textMuted }]}>
                {data.book
                  ? `지금 읽는 책 · ${[data.book.title, data.book.author].filter(Boolean).join(' · ')}`
                  : '읽을 책 미정'}
              </Text>
            </View>
          </View>
          <StatStrip
            cells={[
              { label: '역할', value: isHost ? '호스트' : '멤버' },
              { label: '인원', value: String(data.memberCount), unit: ` / ${data.memberLimit}명` },
              ended
                ? { label: '상태', value: '종료' }
                : { label: '다음 모임', value: data.nextMeetingAt ? meetingDay(data.nextMeetingAt) : '미정' },
            ]}
          />
        </View>

        {/* 함께 읽는 사람 — 누르면 그 사람의 자세한 진척과 찌르기 */}
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHead}>
            <Eyebrow>함께하는 사람</Eyebrow>
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

        {/* 이번 주 카드 · 초대 코드 · 자리(호스트) — 괘선 아래 한 묶음 */}
        <View style={{ gap: spacing.sm }}>
          <Rule />
          <Pressable
            onPress={() =>
              router.push({ pathname: '/club/[id]/log/week', params: { id: String(clubId), weekOf: mondayOf(today) } })
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, pressed && pressedStyle]}
          >
            <Text style={[typeScale.label, { color: colors.text }]}>{linkLabel('이번 주 카드')}</Text>
          </Pressable>
          <View style={styles.codeRow}>
            <View style={styles.inlineLabel}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>초대 코드</Text>
              <Text style={[styles.code, { color: colors.text }]} selectable>{data.joinCode}</Text>
            </View>
            <CopyCodeButton code={data.joinCode} />
          </View>
          {isHost ? (
            <View style={styles.codeRow}>
              <View style={styles.inlineLabel}>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>자리</Text>
                <Text style={[typeScale.label, { color: colors.text }]}>
                  {data.memberCount} / {data.memberLimit}명
                </Text>
              </View>
              {expandable ? (
                <Button
                  label="자리 늘리기"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/club/${clubId}/seats`)}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 파괴적 동작 — 위 묶음과 섹션 간격(xl)으로 떼어 맨 아래에 둔다 */}
        <Button
          label="클럽 나가기"
          variant="danger"
          loading={leave.isPending}
          onPress={async () => {
            if (await confirmAsync(leaveWarning(chatState.data?.unlockCost), '나가기', '클럽에서 나갈까요?')) {
              leave.mutate();
            }
          }}
        />
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', gap: spacing.md },
  title: { ...typeScale.displaySerif, fontSize: 27, lineHeight: 34 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontFamily: mono.regular, fontSize: 11 },
  // 글자 한 줄이라 여백으로 44pt 상자를 만든다(UX 철칙 Fitts).
  linkRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  code: { fontFamily: mono.semiBold, fontSize: 14, letterSpacing: 3 },
  inlineLabel: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
});
