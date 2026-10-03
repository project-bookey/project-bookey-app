import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ellipsis, MessageSquare } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { ApiError } from "@/api/client";
import { clubApi, clubCommunityApi, meetingNoteApi, type ClubMeeting } from "@/api/endpoints";
import type { ClubHome, ClubPreview } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import {
  ClubTabs,
  type ClubTabKey,
  clubTabOf,
  notify,
} from "@/components/club";
import { MeetingNoteCell, MeetingNoteGrid } from "@/components/club/MeetingNoteGrid";
import { meetingClock, meetingDay, meetingState, meetingWeekday } from "@/components/club/meetingTime";
import { meetingNotesKey } from "@/components/club/useMeetingNoteSync";
import { SwipeableTabs } from "@/components/SwipeableTabs";
import { ClubMeetingsBody } from "./meetings";
import {
  LogLine,
  ReadingNowLine,
  clubLogKeys,
  useClubLogFeed,
  useMyClubRecord,
} from "@/components/clubLog";
import {
  PaperScreen,
  SubHeader,
  TiltCover,
} from "@/components/collage";
import {
  Button,
  Card,
  Eyebrow,
  KeyValue,
  Loading,
  Rule,
  Tag,
  Toggle,
  linkLabel,
} from "@/components/ui";
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from "@/theme";
import { mono, sans, serif } from "@/theme/tokens";

const CLUB_TAB_VALUES: readonly ClubTabKey[] = ["home", "meetings", "notes"];
/** 함께하는 사람 줄에 겹쳐 보일 프로필 수. */
const MEMBER_AVATARS = 5;
/** 소개가 길면 이 줄까지만 보이고 '더 보기'. */
const INTRO_LINES = 4;
/** 이 글자 수를 넘거나 줄이 많으면 긴 소개로 본다 — 웹은 줄 수를 재 주지 않아 길이로 가늠한다. */
const INTRO_LONG_CHARS = 140;
/** 홈에 보여 줄 최근 노트 · 읽기 조각 수. */
const RECENT_NOTES = 3;
const RECENT_LOGS = 3;

/**
 * 클럽 홈 (§12.2) — 머리(이름 · 호스트 · 멤버 수 · 공개)와 홈 · 모임 · 노트 세 탭.
 * 홈은 클럽을 처음 보는 사람도 한눈에 알 수 있게 위에서부터 소개 → 함께하는 사람(겹친 프로필, 누르면 클럽 정보)
 * → 다음 모임(참여하기) → 최근 노트 → 읽기 조각(지금 읽는 책이 있을 때만) 순서로 쌓는다.
 * 클럽은 기간 없이 이어지고, 다가오는 모임의 책이 지금 읽는 책이 된다(서버가 맞춘다).
 * 채팅은 탭이 아니라 헤더 말풍선(안 읽음 배지)으로 여는 전체 화면(/club/[id]/chat)이다.
 * 이번 주 카드 · 초대 코드 · 나가기는 ⋯ 의 클럽 정보(/club/[id]/info)로, 운영은 호스트 전용 설정으로 뺐다.
 */
export default function ClubHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const clubId = Number(id);
  // 탭은 화면 이동 없이 아래 영역만 바꾼다. 딥링크(?tab=)로 들어오면 그 탭으로 연다.
  const [tab, setTab] = useState<ClubTabKey>(clubTabOf(tabParam) ?? "home");
  // 홈의 '모임 만들기'로 모임 탭을 열 때만 새 모임 폼을 펼친다.
  const [formOpen, setFormOpen] = useState(false);
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
  const changeTab = (next: ClubTabKey) => {
    if (next !== "meetings") setFormOpen(false);
    setTab(next);
  };
  const [shareProgress, setShareProgress] = useState(true);

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

  const isMember = !!club.data;
  // 헤더 말풍선의 안 읽음 배지 — 채팅 화면을 나오면 그쪽에서 무효화해 다시 받는다.
  const chatState = useQuery({
    queryKey: ["clubChat", clubId, "state"],
    queryFn: () => clubCommunityApi.chatState(clubId),
    enabled: isMember,
    refetchInterval: 30_000,
  });

  const join = useMutation({
    mutationFn: () => clubApi.joinPublic(clubId, { shareProgress }),
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
          shareProgress={shareProgress}
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
  const isHost = data.myRole === "HOST";
  const host = data.members.find((m) => m.role === "HOST");
  const metaLine = [
    host ? `호스트 ${host.nickname}` : null,
    `멤버 ${data.memberCount}/${data.memberLimit}`,
    data.visibility === "PUBLIC" ? "공개" : "초대 코드로 참가",
    ended ? "종료" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const unreadChat = chatState.data?.unreadCount ?? 0;

  return (
    <PaperScreen>
      <SubHeader
        category="클럽"
        right={
          // 두 아이콘은 44pt 상자를 sm 만큼 떼어 둔다(오터치 방지).
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push(`/club/${clubId}/chat`)}
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
              onPress={() => router.push(`/club/${clubId}/info`)}
              accessibilityRole="button"
              accessibilityLabel="클럽 정보"
              style={({ pressed }) => [styles.headerButton, pressed && pressedStyle]}
            >
              <Ellipsis size={22} color={colors.text} {...iconStroke} />
            </Pressable>
          </View>
        }
      />
      {/* 머리 — 명조 이름과 모노 한 줄(호스트 · 멤버 수 · 공개). 소개는 홈 탭 맨 위에 쓴다 */}
      <View style={styles.top}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
          {data.name}
        </Text>
        <Text numberOfLines={1} style={[styles.metaLine, { color: colors.textMuted }]}>
          {metaLine}
        </Text>
      </View>

      <ClubTabs clubId={clubId} active={tab} onSelect={changeTab} />

      <SwipeableTabs values={CLUB_TAB_VALUES} value={tab} onChange={changeTab} style={styles.body}>
        {tab === "home" ? (
          <ClubHomeTab
            club={data}
            onOpenMeetings={(withForm) => {
              setFormOpen(withForm);
              setTab("meetings");
            }}
            onOpenNotes={() => changeTab("notes")}
          />
        ) : null}
        {tab === "meetings" ? <ClubMeetingsBody isHost={isHost} initialOpen={formOpen} /> : null}
        {tab === "notes" ? (
          <MeetingNoteGrid clubId={clubId} onOpenMeetings={() => changeTab("meetings")} />
        ) : null}
      </SwipeableTabs>
    </PaperScreen>
  );
}

/**
 * 홈 탭 — 소개 · 함께하는 사람 · 다음 모임 · 최근 노트 · 읽기 조각.
 * 주요 행동은 다음 모임의 '이 모임에 참여하기' 하나뿐이다(UX 철칙 Von Restorff) — 나머지는 링크·테두리 버튼.
 */
function ClubHomeTab({ club, onOpenMeetings, onOpenNotes }: {
  club: ClubHome;
  /** withForm — 호스트가 '모임 만들기'로 들어오면 새 모임 폼을 펼쳐 둔다. */
  onOpenMeetings: (withForm: boolean) => void;
  onOpenNotes: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const clubId = club.id;
  const ended = club.status === "ENDED" || club.status === "ARCHIVED";
  const isHost = club.myRole === "HOST";
  const hasBook = club.book != null;
  const me = club.members.find((m) => m.isMe);
  const [introOpen, setIntroOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const meetings = useQuery({
    queryKey: ["clubMeetings", clubId],
    queryFn: () => clubCommunityApi.meetings(clubId),
  });
  // 모임은 시작 순으로 온다 — 아직 시작하지 않은 첫 모임이 다음 모임이다.
  const next = useMemo(
    () => (meetings.data ?? []).find((m) => meetingState(m) === "open") ?? null,
    [meetings.data],
  );
  // 노트 화면을 나오면 meetingNotesKey 를 무효화한다 — 그 아래 키라 최근 노트도 새로 받는다.
  const notes = useQuery({
    queryKey: [...meetingNotesKey(clubId), "recent"],
    queryFn: () => meetingNoteApi.clubNotes(clubId, 0, RECENT_NOTES),
  });
  const recentNotes = notes.data?.content ?? [];
  // 읽기 조각은 지금 읽는 책이 있을 때만 — 조각은 그 책을 읽으며 남긴다.
  const feed = useClubLogFeed(clubId, club.startsAt.slice(0, 10), hasBook);
  const recentLogs = useMemo(
    () => (feed.data?.pages ?? []).flatMap((p) => p.days).flatMap((d) => d.logs).slice(0, RECENT_LOGS),
    [feed.data],
  );
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    enabled: hasBook,
    refetchInterval: 30_000,
  });
  const myRecord = useMyClubRecord(club);

  const attend = useMutation({
    mutationFn: (meeting: ClubMeeting) => clubCommunityApi.attend(clubId, meeting.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubMeetings", clubId] }),
    onError: (e) => notify(e instanceof ApiError ? e.message : "참여하지 못했어요."),
  });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["club", clubId], exact: true }),
      meetings.refetch(),
      notes.refetch(),
      hasBook ? feed.refetch() : null,
      hasBook ? readingNow.refetch() : null,
    ]);
    setRefreshing(false);
  };

  const intro = club.description?.trim() ?? "";
  const introLong = intro.length > INTRO_LONG_CHARS || intro.split("\n").length > INTRO_LINES;
  const contentWidth = Math.min(width, layout.content.maxWidth) - spacing.lg * 2;
  const noteSize = Math.floor((contentWidth - spacing.xs * (RECENT_NOTES - 1)) / RECENT_NOTES);
  const deadlinePassed = next?.responseDeadline != null && new Date(next.responseDeadline).getTime() < Date.now();
  const writeLog = () =>
    router.push({
      pathname: "/club/[id]/log/new",
      params: {
        id: String(clubId),
        ...(me?.currentPage != null ? { endPage: String(me.currentPage) } : {}),
      },
    });

  return (
    <ScrollView
      contentContainerStyle={styles.home}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {/* 소개 — 클럽을 처음 보는 사람이 가장 먼저 읽는 글. 없으면 호스트에게만 적으러 가는 링크 */}
      <View style={styles.section}>
        {intro ? (
          <View style={{ gap: spacing.xs }}>
            <Text numberOfLines={introOpen ? undefined : INTRO_LINES} style={[styles.intro, { color: colors.text }]}>
              {intro}
            </Text>
            {introLong ? (
              <Pressable
                onPress={() => setIntroOpen((v) => !v)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linkBox, pressed && pressedStyle]}
              >
                <Text style={[typeScale.label, { color: colors.textMuted }]}>{introOpen ? "접기" : "더 보기"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : isHost ? (
          <Pressable
            onPress={() => router.push(`/club/${clubId}/settings`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkBox, pressed && pressedStyle]}
          >
            <Text style={[typeScale.label, { color: colors.text }]}>{linkLabel("클럽 소개 적기")}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              멤버와 참가하려는 사람이 가장 먼저 보는 글이에요.
            </Text>
          </Pressable>
        ) : null}

        {/* 함께하는 사람 — 겹친 프로필과 인원만 짧게. 누르면 클럽 정보에서 진척 · 찌르기 */}
        <Pressable
          onPress={() => router.push(`/club/${clubId}/info`)}
          accessibilityRole="button"
          accessibilityLabel={`함께하는 사람 ${club.memberCount}명 보기`}
          style={({ pressed }) => [styles.members, pressed && pressedStyle]}
        >
          <View style={styles.avatars}>
            {club.members.slice(0, MEMBER_AVATARS).map((m, i) => (
              <View
                key={m.userId}
                style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.bg }]}
              >
                <Avatar uri={m.avatarUrl} nickname={m.nickname} size={28} />
              </View>
            ))}
          </View>
          <Text style={[typeScale.label, { color: colors.text }]}>
            {linkLabel(`함께하는 사람 ${club.memberCount}명`)}
          </Text>
        </Pressable>
      </View>

      {/* 다음 모임 — 카드 본문은 모임 상세로, 참여하기는 본문의 형제(웹에서 button 안에 button 이 들어가지 않게) */}
      <View style={styles.section}>
        <Eyebrow>다음 모임</Eyebrow>
        {meetings.isLoading ? (
          <Loading />
        ) : next ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/club/[id]/meeting/[meetingId]",
                  params: { id: String(clubId), meetingId: String(next.id), host: isHost ? "1" : "0" },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${next.title} 모임 상세`}
              style={({ pressed }) => [styles.cardBody, pressed && pressedStyle]}
            >
              <Text style={[styles.when, { color: colors.text }]}>
                {meetingDay(next.startsAt)} {meetingWeekday(next.startsAt)} · {meetingClock(next.startsAt)}
              </Text>
              <Text numberOfLines={2} style={[styles.meetingTitle, { color: colors.text }]}>
                {next.title}
              </Text>
              {next.book ? (
                <View style={styles.bookRow}>
                  <TiltCover uri={next.book.coverUrl} title={next.book.title} width={28} tilt={0} entering={false} />
                  <Text numberOfLines={1} style={[typeScale.caption, styles.flex, { color: colors.text }]}>
                    읽을 책 · {next.book.title}
                  </Text>
                </View>
              ) : null}
              <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
                {next.placeName} · 참여 {next.attendeeCount}명
              </Text>
            </Pressable>
            {next.attending ? (
              <Text style={[styles.attending, { color: colors.text }]}>참여해요 · 바꾸려면 모임 상세에서</Text>
            ) : !deadlinePassed && !ended ? (
              <Button label="이 모임에 참여하기" loading={attend.isPending} onPress={() => attend.mutate(next)} />
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyMeeting}>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              {isHost
                ? "아직 잡힌 모임이 없어요. 모임을 열며 읽을 책도 고를 수 있어요."
                : "아직 잡힌 모임이 없어요. 호스트가 모임을 열면 여기에 보여요."}
            </Text>
            {isHost && !ended ? (
              <Button label="모임 만들기" variant="outline" onPress={() => onOpenMeetings(true)} />
            ) : null}
          </View>
        )}
      </View>

      {/* 최근 노트 — 모임을 마치며 함께 쓴 노트 세 칸. 모두 보기는 노트 탭 */}
      {recentNotes.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>최근 노트</Eyebrow>
            <Pressable onPress={onOpenNotes} accessibilityRole="button" style={({ pressed }) => [styles.headLink, pressed && pressedStyle]}>
              <Text style={[typeScale.label, { color: colors.text }]}>{linkLabel("모두 보기")}</Text>
            </Pressable>
          </View>
          <View style={styles.noteRow}>
            {recentNotes.slice(0, RECENT_NOTES).map((note) => (
              <MeetingNoteCell
                key={note.meetingId}
                note={note}
                size={noteSize}
                onPress={() =>
                  router.push({
                    pathname: "/club/[id]/note/[meetingId]",
                    params: { id: String(clubId), meetingId: String(note.meetingId) },
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* 읽기 조각 — 지금 읽는 책을 읽고 남긴 사진 한 장 + 한 줄. 지금 책이 있을 때만 */}
      {hasBook ? (
        <View style={styles.section}>
          <Text numberOfLines={1} style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>
            읽기 조각 · {club.book!.title}
          </Text>
          <ReadingNowLine
            readers={readingNow.data ?? []}
            onJoin={myRecord && !ended ? () => router.push(`/timer?recordId=${myRecord.id}`) : undefined}
          />
          {recentLogs.length > 0 ? (
            <View>
              {recentLogs.map((log) => (
                <LogLine
                  key={log.id}
                  log={log}
                  onOpen={() =>
                    router.push({
                      pathname: "/club/[id]/log/[postId]",
                      params: { id: String(clubId), postId: String(log.id) },
                    })
                  }
                />
              ))}
            </View>
          ) : feed.isLoading ? null : (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              타이머로 읽고 나면 사진 한 장과 한 줄로 조각을 남길 수 있어요. 멤버가 남긴 조각이 여기 모여요.
            </Text>
          )}
          {!ended ? <Button label="한 조각 남기기" variant="outline" onPress={writeLog} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** '사피엔스 · 유발 하라리' — 저자가 없으면 제목만. */
function bookLine(book?: { title?: string; author?: string } | null): string {
  return [book?.title, book?.author].filter(Boolean).join(" · ");
}

function PublicClubPreview({
  club,
  shareProgress,
  onShareProgressChange,
  onJoin,
  joining,
}: {
  club: ClubPreview;
  shareProgress: boolean;
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
              {club.book ? `지금 읽는 책 · ${bookLine(club.book)}` : "읽을 책 미정"}
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
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  name: { ...typeScale.displaySerif, fontSize: 22, lineHeight: 30 },
  metaLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  body: { flex: 1 },
  // 홈 — 섹션 사이 xl, 섹션 안 sm~md(UX 철칙 Proximity).
  home: {
    ...layout.content,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // 글자 링크도 44pt 상자로(UX 철칙 Fitts).
  headLink: { minHeight: 44, justifyContent: "center" },
  linkBox: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", gap: 2 },
  intro: { fontFamily: serif.regular, fontSize: 15, lineHeight: 25 },
  flex: { flex: 1 },
  // 함께하는 사람 줄 전체가 하나의 버튼 — 44pt 높이를 지킨다.
  members: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, alignSelf: "flex-start" },
  avatars: { flexDirection: "row" },
  avatarWrap: { borderRadius: radius.round, borderWidth: 2 },
  card: { borderWidth: hairline, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  cardBody: { gap: spacing.xs },
  when: { fontFamily: mono.semiBold, fontSize: 13 },
  meetingTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 25 },
  bookRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  attending: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 0.3 },
  emptyMeeting: { gap: spacing.md },
  noteRow: { flexDirection: "row", gap: spacing.xs },
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
