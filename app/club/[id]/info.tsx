import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import type { ClubHome, NudgeMessageKey } from '@/api/types';
import { MemberDetail, MemberStrip, StatStrip, confirmAsync, notify } from '@/components/club';
import { meetingDay } from '@/components/club/meetingTime';
import { clubLogKeys, mondayOf, todayKst } from '@/components/clubLog';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Button, EmptyState, Eyebrow, Loading, Rule, linkLabel, percent } from '@/components/ui';
import { iconStroke, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/**
 * 클럽 정보 — 클럽 홈의 ⋯ 와 홈의 '함께하는 사람'에서 들어온다. 홈은 소개 · 모임 · 노트 중심으로 두고,
 * 함께 읽는 사람(지금 읽는 책의 진척 · 찌르기) · 이번 주 카드 · 초대 코드 · 나가기는 여기로 모았다.
 * 운영(코드 재발급 · 자리 · 멤버 · 종료)은 여전히 호스트 전용 설정(/club/[id]/settings)이다.
 */
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
  // 멤버 칩의 '오늘 n조각'과 '지금 읽는 중' 점 — 클럽 홈과 같은 캐시 키라 대개 이미 있다.
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
      // 클럽 홈 · 정보 둘 다 걷어 내고 목록으로 — 목록이 스택에 없으면 이 화면을 목록으로 바꾼다.
      router.dismissTo('/clubs');
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '나가지 못했습니다.'),
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
            <Pressable
              onPress={() => router.push(`/club/${clubId}/settings`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="클럽 관리"
              style={styles.menuButton}
            >
              <Settings size={22} color={colors.text} {...iconStroke} />
            </Pressable>
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

        {/* 이번 주 카드 · 초대 코드 — 괘선 아래 한 묶음 */}
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
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>초대 코드</Text>
            <Text style={[styles.code, { color: colors.textMuted }]}>{data.joinCode}</Text>
          </View>
        </View>

        {/* 파괴적 동작 — 위 묶음과 섹션 간격(xl)으로 떼어 맨 아래에 둔다 */}
        <Button
          label="클럽 나가기"
          variant="danger"
          loading={leave.isPending}
          onPress={async () => {
            if (await confirmAsync('클럽에서 나갈까요? 남긴 조각과 글은 그대로 남아요.', '나가기')) leave.mutate();
          }}
        />
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: spacing.md },
  title: { ...typeScale.displaySerif, fontSize: 27, lineHeight: 34 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontFamily: mono.regular, fontSize: 11 },
  // 글자 한 줄이라 여백으로 44pt 상자를 만든다(UX 철칙 Fitts).
  linkRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  code: { fontFamily: mono.semiBold, fontSize: 14, letterSpacing: 3 },
});
