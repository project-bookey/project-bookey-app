import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ellipsis, MessageSquare } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiError } from "@/api/client";
import { clubApi, clubCommunityApi } from "@/api/endpoints";
import type {
  Checkpoint,
  ClubHome,
  ClubLogSummary,
  ClubPost,
  ClubPreview,
} from "@/api/types";
import { Avatar } from "@/components/Avatar";
import {
  ClubTabs,
  type ClubTabKey,
  clubTabOf,
  notify,
} from "@/components/club";
import { meetingDay } from "@/components/club/meetingTime";
import { SwipeableTabs } from "@/components/SwipeableTabs";
import { ClubMeetingsBody } from "./meetings";
import {
  FeedDayHeader,
  LogScrap,
  ReadingNowLine,
  clubLogKeys,
  todayKst,
  useClubLogFeed,
  useMyClubRecord,
} from "@/components/clubLog";
import {
  MemoScrap,
  PaperScreen,
  SubHeader,
  TiltCover,
} from "@/components/collage";
import {
  Button,
  Card,
  EmptyState,
  Eyebrow,
  KeyValue,
  Loading,
  Rule,
  Tag,
  Toggle,
  linkLabel,
  percent,
} from "@/components/ui";
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from "@/theme";
import { mono, sans } from "@/theme/tokens";

const CLUB_TAB_VALUES: readonly ClubTabKey[] = ["home", "meetings"];
/** 머리의 멤버 아바타 — 이만큼 겹쳐 보이고 나머지는 +n. */
const HEAD_AVATARS = 4;

/** 소식 피드 한 줄 — 날짜 구분 또는 조각 하나. */
type FeedRow =
  | { key: string; kind: "day"; date: string; summary: ClubLogSummary }
  | { key: string; kind: "log"; log: ClubPost };

/**
 * 클럽 홈 (§12.2) — 머리(이름 · 책 · D-day · 내 진척 · 멤버)와 소식 · 모임 두 탭.
 * 소식은 멤버들이 남긴 조각을 날짜별로 이어 붙인 한 줄 피드다(요일 스트립·주 이동 없이 내려 보며 지난날로).
 * 채팅은 탭이 아니라 헤더 말풍선(안 읽음 배지)으로 여는 전체 화면(/club/[id]/chat)이다 — 키보드가 올라와도
 * 머리·탭에 자리를 뺏기지 않고, 옆으로 밀어 탭이 바뀌며 쓰던 글이 날아가지 않게.
 * 함께 읽는 사람 · 체크포인트 · 초대 코드 · 나가기는 ⋯ 의 클럽 정보(/club/[id]/info)로,
 * 운영은 호스트 전용 설정(/club/[id]/settings)으로 뺐다.
 */
export default function ClubHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const clubId = Number(id);
  // 탭은 화면 이동 없이 아래 영역만 바꾼다. 딥링크(?tab=)로 들어오면 그 탭으로 연다.
  const [tab, setTab] = useState<ClubTabKey>(clubTabOf(tabParam) ?? "home");
  useEffect(() => {
    // 예전 ?tab=chat 링크 — 홈을 깔고 그 위에 채팅 화면을 연다(뒤로 가면 홈).
    if (tabParam === "chat") {
      router.setParams({ tab: undefined });
      router.push({ pathname: "/club/[id]/chat", params: { id } });
      return;
    }
    const next = clubTabOf(tabParam);
    if (next) setTab(next);
  }, [tabParam, id, router]);
  const today = todayKst();
  const [openReactions, setOpenReactions] = useState<number | null>(null);
  // 당겨서 새로고침 표시는 손으로 당겼을 때만 — 반응·펼쳐 보기 뒤 피드를 다시 받을 때는 띄우지 않는다.
  const [refreshing, setRefreshing] = useState(false);
  const [shareProgress, setShareProgress] = useState(true);
  const [adoptTarget, setAdoptTarget] = useState(true);

  const club = useQuery({
    queryKey: ["club", clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });

  const preview = useQuery({
    queryKey: ["club", "preview", clubId],
    queryFn: () => clubApi.previewById(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });

  // 읽기로그는 멤버에게만 열린다 — 홈이 오기 전엔 부르지 않는다(비멤버는 403).
  const isMember = !!club.data;
  const feed = useClubLogFeed(clubId, club.data?.startsAt.slice(0, 10), isMember);
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    enabled: isMember,
    refetchInterval: 30_000,
  });
  const myRecord = useMyClubRecord(club.data);
  // 헤더 말풍선의 안 읽음 배지 — 채팅 화면을 나오면 그쪽에서 무효화해 다시 받는다.
  const chatState = useQuery({
    queryKey: ["clubChat", clubId, "state"],
    queryFn: () => clubCommunityApi.chatState(clubId),
    enabled: isMember,
    refetchInterval: 30_000,
  });

  const rows = useMemo<FeedRow[]>(
    () =>
      (feed.data?.pages ?? [])
        .flatMap((page) => page.days)
        .flatMap((day): FeedRow[] => [
          { key: `d-${day.date}`, kind: "day", date: day.date, summary: day.summary },
          ...day.logs.map((log): FeedRow => ({ key: `l-${log.id}`, kind: "log", log })),
        ]),
    [feed.data],
  );

  const refreshLogs = () =>
    queryClient.invalidateQueries({ queryKey: clubLogKeys.all(clubId) });
  const reveal = useMutation({
    mutationFn: (postId: number) => clubApi.reveal(clubId, postId),
    onSuccess: refreshLogs,
  });
  const react = useMutation({
    mutationFn: ({ postId, kind }: { postId: number; kind: string }) =>
      clubApi.react(clubId, postId, kind),
    onSuccess: refreshLogs,
  });

  const join = useMutation({
    mutationFn: () =>
      clubApi.joinPublic(clubId, {
        adoptTargetDate: adoptTarget,
        shareProgress,
      }),
    onSuccess: (joined) => {
      queryClient.invalidateQueries({ queryKey: ["clubs"] });
      queryClient.invalidateQueries({ queryKey: ["club", "preview", clubId] });
      queryClient.setQueryData(["club", joined.id], joined);
      router.replace(`/club/${joined.id}`);
    },
    onError: (e) =>
      notify(e instanceof ApiError ? e.message : "참가하지 못했습니다."),
  });

  if (club.isLoading && !preview.data) {
    return (
      <PaperScreen>
        <SubHeader category="클럽" />
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
        <SubHeader category="클럽" />
        <Text style={[styles.error, { color: colors.danger }]}>
          클럽을 불러오지 못했습니다.
        </Text>
      </PaperScreen>
    );
  }

  const data: ClubHome = club.data;
  const ended = data.status === "ENDED" || data.status === "ARCHIVED";
  const me = data.members.find((m) => m.isMe);
  const myProgress = me?.finished
    ? "완독"
    : me?.completionRate != null
      ? `내 진척 ${percent(me.completionRate)}`
      : null;
  const metaLine = [
    data.book?.title,
    ended ? "종료" : `D-${Math.max(0, data.daysLeft)}`,
    myProgress,
  ]
    .filter(Boolean)
    .join(" · ");
  const extraMembers = data.memberCount - Math.min(HEAD_AVATARS, data.members.length);
  const readers = readingNow.data ?? [];
  const lastPage = feed.data?.pages[feed.data.pages.length - 1];

  const unreadChat = chatState.data?.unreadCount ?? 0;
  const openInfo = () => router.push(`/club/${clubId}/info`);
  const openChat = () => router.push(`/club/${clubId}/chat`);
  const writeLog = () =>
    router.push({
      pathname: "/club/[id]/log/new",
      params: {
        id: String(clubId),
        ...(me?.currentPage != null ? { endPage: String(me.currentPage) } : {}),
      },
    });
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([feed.refetch(), club.refetch(), readingNow.refetch()]);
    setRefreshing(false);
  };

  return (
    <PaperScreen>
      <SubHeader
        category="클럽"
        right={
          // 두 아이콘은 44pt 상자를 sm 만큼 떼어 둔다(오터치 방지).
          <View style={styles.headerActions}>
            <Pressable
              onPress={openChat}
              accessibilityRole="button"
              accessibilityLabel={unreadChat > 0 ? `클럽 채팅, 안 읽은 메시지 ${unreadChat}개` : "클럽 채팅"}
              style={({ pressed }) => [styles.headerButton, pressed && pressedStyle]}
            >
              <MessageSquare size={22} color={colors.text} {...iconStroke} />
              {unreadChat > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.badgeText, { color: colors.onAccent }]}>
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={openInfo}
              accessibilityRole="button"
              accessibilityLabel="클럽 정보"
              style={({ pressed }) => [styles.headerButton, pressed && pressedStyle]}
            >
              <Ellipsis size={22} color={colors.text} {...iconStroke} />
            </Pressable>
          </View>
        }
      />
      {/* 머리 — 명조 이름 한 줄과 모노 요약 한 줄, 오른쪽 멤버 아바타(누르면 클럽 정보) */}
      <View style={styles.top}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
            {data.name}
          </Text>
          <Text numberOfLines={1} style={[styles.metaLine, { color: colors.textMuted }]}>
            {metaLine}
          </Text>
        </View>
        <Pressable
          onPress={openInfo}
          accessibilityRole="button"
          accessibilityLabel={`멤버 ${data.memberCount}명 보기`}
          style={({ pressed }) => [styles.members, pressed && pressedStyle]}
        >
          {data.members.slice(0, HEAD_AVATARS).map((m, i) => (
            <View
              key={m.userId}
              style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.bg }]}
            >
              <Avatar uri={m.avatarUrl} nickname={m.nickname} size={28} />
            </View>
          ))}
          {extraMembers > 0 ? (
            <Text style={[styles.more, { color: colors.textMuted }]}>+{extraMembers}</Text>
          ) : null}
        </Pressable>
      </View>

      <ClubTabs clubId={clubId} active={tab} onSelect={setTab} />

      <SwipeableTabs values={CLUB_TAB_VALUES} value={tab} onChange={setTab} style={styles.body}>
        {tab === "home" ? (
          <>
            <FlatList
              data={rows}
              keyExtractor={(row) => row.key}
              contentContainerStyle={styles.feed}
              refreshing={refreshing}
              onRefresh={refresh}
              onEndReached={() => {
                if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
              }}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                readers.length > 0 || data.nextCheckpoint ? (
                  <View style={styles.feedTop}>
                    <ReadingNowLine
                      readers={readers}
                      onJoin={
                        myRecord && !ended
                          ? () => router.push(`/timer?recordId=${myRecord.id}`)
                          : undefined
                      }
                    />
                    {data.nextCheckpoint ? <CheckpointLine checkpoint={data.nextCheckpoint} /> : null}
                  </View>
                ) : null
              }
              renderItem={({ item, index }) =>
                item.kind === "day" ? (
                  // 날짜가 바뀌는 곳은 조각 사이(lg)보다 한 번 더 띄운다.
                  <View style={index > 0 ? styles.dayGap : undefined}>
                    <FeedDayHeader date={item.date} today={today} summary={item.summary} />
                  </View>
                ) : (
                  <LogScrap
                    log={item.log}
                    myPage={me?.currentPage}
                    selected={openReactions === item.log.id}
                    onOpen={() =>
                      router.push({
                        pathname: "/club/[id]/log/[postId]",
                        params: { id: String(clubId), postId: String(item.log.id) },
                      })
                    }
                    onToggleReactions={() =>
                      setOpenReactions((cur) => (cur === item.log.id ? null : item.log.id))
                    }
                    onReveal={() => reveal.mutate(item.log.id)}
                    onReact={(kind) => react.mutate({ postId: item.log.id, kind })}
                  />
                )
              }
              ListEmptyComponent={
                feed.isLoading ? (
                  <Loading />
                ) : feed.isError ? (
                  <EmptyState
                    title="소식을 불러오지 못했어요"
                    description={feed.error instanceof ApiError ? feed.error.message : undefined}
                    action={
                      <Button
                        label={linkLabel("다시 시도", "action")}
                        variant="outline"
                        onPress={() => feed.refetch()}
                      />
                    }
                  />
                ) : (
                  <MemoScrap variant="ruled">
                    <Text style={[typeScale.quote, { color: colors.text, fontSize: 16, lineHeight: 26 }]}>
                      아직 남긴 조각이 없어요.
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                      읽기를 마치면 사진 한 장과 한 줄로 남길 수 있어요.
                    </Text>
                  </MemoScrap>
                )
              }
              ListFooterComponent={
                feed.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : feed.hasNextPage && lastPage && lastPage.days.length === 0 ? (
                  // 조각이 없는 기간이 길면 끝에 닿아도 다음 페이지가 오지 않으니 손으로 더 받는다.
                  <Button
                    label={linkLabel("지난 조각 더 보기", "action")}
                    variant="ghost"
                    onPress={() => void feed.fetchNextPage()}
                  />
                ) : null
              }
            />

            {!ended ? (
              // 종이가 CTA 뒤로 흐려지며 사라지게 — 불투명 띠로 도트 질감을 자르지 않는다.
              <LinearGradient
                colors={[`${colors.bg}00`, colors.bg]}
                locations={[0, 0.45]}
                style={styles.cta}
              >
                <Button label="한 조각 남기기" onPress={writeLog} />
              </LinearGradient>
            ) : null}
          </>
        ) : null}
        {tab === "meetings" ? <ClubMeetingsBody isHost={data.myRole === "HOST"} /> : null}
      </SwipeableTabs>
    </PaperScreen>
  );
}

/** 다음 체크포인트 — 소식 맨 위 괘선 사이 한 줄. 지난 체크포인트 격자는 클럽 정보에 있다. */
function CheckpointLine({ checkpoint }: { checkpoint: Checkpoint }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.checkpoint, { borderColor: colors.line }]}>
      <Eyebrow>다음 체크포인트</Eyebrow>
      <View style={styles.checkpointRow}>
        <Text numberOfLines={1} style={[typeScale.label, { color: colors.text, flexShrink: 1 }]}>
          {checkpoint.title} · {checkpoint.targetPage}쪽까지
        </Text>
        <Text style={[styles.metaLine, { color: colors.textMuted }]}>
          {meetingDay(checkpoint.dueAt)} 마감 · {checkpoint.achievedCount}/{checkpoint.memberCount}명
        </Text>
      </View>
    </View>
  );
}

/** '사피엔스 · 유발 하라리' — 저자가 없으면 제목만. */
function bookLine(book?: { title?: string; author?: string } | null): string {
  return [book?.title, book?.author].filter(Boolean).join(" · ");
}

/** 08-31 → 8/31 */
function compactDate(iso: string): string {
  const [, month, day] = iso.split("-");
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
  const ended = club.status === "ENDED" || club.status === "ARCHIVED";

  return (
    <PaperScreen>
      <SubHeader category="추천 클럽" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TiltCover
            uri={club.book?.coverUrl}
            title={club.book?.title}
            width={58}
            tilt={0}
            entering={false}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[styles.title, { color: colors.text }]}>
              {club.name}
            </Text>
            <Text style={[styles.bookLine, { color: colors.textMuted }]}>
              {bookLine(club.book)}
            </Text>
            <View style={styles.headerTags}>
              <Tag label={`${club.memberCount}/${club.memberLimit}명`} />
              {ended ? (
                <Tag label="종료" />
              ) : (
                <Tag
                  label={club.status === "RECRUITING" ? "모집 중" : "진행 중"}
                />
              )}
            </View>
          </View>
        </View>

        {club.description ? (
          <Card>
            <Text
              style={[
                typeScale.body,
                { color: colors.textMuted, lineHeight: 22 },
              ]}
            >
              {club.description}
            </Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Eyebrow>클럽 정보</Eyebrow>
          <KeyValue label="호스트" value={club.hostNickname ?? "-"} />
          <Rule />
          <KeyValue
            label="인원"
            value={`${club.memberCount} / ${club.memberLimit}`}
          />
          <Rule />
          <KeyValue
            label="기간"
            value={`${compactDate(club.startsAt)}-${compactDate(club.endsAt)}`}
          />
        </Card>

        {club.joinable ? (
          <Card style={{ gap: spacing.md }}>
            <Eyebrow>참가 설정</Eyebrow>
            <Toggle
              label="진척 공개"
              description="끄면 리더보드에 비공개로 표시되고 클럽 평균 계산에서 빠집니다."
              value={shareProgress}
              onChange={onShareProgressChange}
            />
            <Toggle
              label="클럽 목표일을 내 목표로"
              description={`${club.endsAt}을 내 완독 목표일로 삼습니다.`}
              value={adoptTarget}
              onChange={onAdoptTargetChange}
            />
          </Card>
        ) : club.joinBlockedReason ? (
          <Text style={[styles.error, { color: colors.danger }]}>
            {club.joinBlockedReason}
          </Text>
        ) : null}

        <Button
          label={club.alreadyMember ? "클럽 홈 보기" : "참가하기"}
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


const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: spacing.sm },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  // 서가 헤더의 알림 종과 같은 배지 — 숫자 배지는 악센트를 쓰는 예외다.
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: sans.bold, fontSize: 10 },
  top: {
    ...layout.content,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  name: { ...typeScale.displaySerif, fontSize: 22, lineHeight: 30 },
  metaLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  // 아바타 줄 전체가 하나의 버튼 — 44pt 높이를 지킨다(UX 철칙 Fitts).
  members: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  avatarWrap: { borderRadius: radius.round, borderWidth: 2 },
  more: { fontFamily: mono.semiBold, fontSize: 11, marginLeft: spacing.xs },
  body: { flex: 1 },
  // 조각 사이는 lg, 조각 안(머리 줄 · 사진 · 한 줄)은 sm — 그룹 안 간격이 늘 더 좁다(UX 철칙 Proximity).
  // 아래는 고정 CTA 에 가리지 않을 만큼 비운다.
  feed: {
    ...layout.content,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  feedTop: { gap: spacing.sm },
  dayGap: { marginTop: spacing.lg },
  checkpoint: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
  },
  checkpointRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  // 아래는 비멤버가 보는 추천 클럽 미리보기.
  container: {
    ...layout.content,
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: 120,
  },
  header: { flexDirection: "row", gap: spacing.md },
  title: { ...typeScale.displaySerif, fontSize: 27, lineHeight: 34 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  headerTags: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  error: { ...typeScale.body, padding: spacing.lg },
});
