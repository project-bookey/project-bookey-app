import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clubCommunityApi } from "@/api/endpoints";
import { PaperScreen, SubHeader } from "@/components/collage";
import { PlaceMap } from "@/components/club/PlaceMap";
import { Button, Card, Loading, formatClock } from "@/components/ui";
import { spacing, typeScale, useTheme } from "@/theme";

export default function MeetingDetailScreen() {
  const { id, meetingId, host } = useLocalSearchParams<{
    id: string;
    meetingId: string;
    host?: string;
  }>();
  const clubId = Number(id),
    mid = Number(meetingId),
    isHost = host === "1";
  const router = useRouter(),
    qc = useQueryClient();
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const meeting = useQuery({
    queryKey: ["clubMeeting", clubId, mid],
    queryFn: () => clubCommunityApi.meeting(clubId, mid),
  });
  const current = useQuery({
    queryKey: ["clubActivity", clubId, "current"],
    queryFn: () => clubCommunityApi.currentActivity(clubId),
  });
  useEffect(() => {
    if (!current.data) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [current.data]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["clubMeeting", clubId, mid] });
    qc.invalidateQueries({ queryKey: ["clubMeetings", clubId] });
  };
  const attend = useMutation({
    mutationFn: () =>
      meeting.data?.attending
        ? clubCommunityApi.unattend(clubId, mid)
        : clubCommunityApi.attend(clubId, mid),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => clubCommunityApi.cancelMeeting(clubId, mid),
    onSuccess: refresh,
  });
  const start = useMutation({
    mutationFn: () => clubCommunityApi.startActivity(clubId, mid),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["clubActivity", clubId, "current"] }),
  });
  const end = useMutation({
    mutationFn: () => clubCommunityApi.endActivity(clubId),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["clubActivity", clubId] });
      router.push({
        pathname: "/club/[id]/activity",
        params: { id: String(clubId), cardId: String(card.id) },
      });
    },
  });
  if (meeting.isLoading || current.isLoading)
    return (
      <PaperScreen>
        <SubHeader category="약속 상세" onBack={() => router.back()} />
        <Loading />
      </PaperScreen>
    );
  const m = meeting.data;
  if (!m)
    return (
      <PaperScreen>
        <SubHeader category="약속 상세" onBack={() => router.back()} />
        <Text style={{ color: colors.danger }}>약속을 불러오지 못했어요.</Text>
      </PaperScreen>
    );
  const running = current.data?.meetingId === mid,
    otherRunning = Boolean(current.data && !running),
    elapsed = running
      ? Math.max(
          0,
          Math.floor(
            (now - new Date(current.data!.startedAt).getTime()) / 1000,
          ),
        )
      : 0;
  const openMap = () => {
    const q =
      m.latitude != null && m.longitude != null
        ? `${m.latitude},${m.longitude}`
        : m.address;
    void Linking.openURL(
      m.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(q)}`,
    );
  };
  return (
    <PaperScreen>
      <SubHeader category="약속 상세" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.container}>
        <View>
          <Text style={[s.eyebrow, { color: colors.accent }]}>
            BOOKEY MEETING
          </Text>
          <Text style={[s.title, { color: colors.text }]}>{m.title}</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            {m.status === "OPEN"
              ? "참여를 기다리고 있어요"
              : "취소된 약속입니다"}
          </Text>
        </View>
        <Card>
          <Text style={[s.date, { color: colors.text }]}>
            {new Date(m.startsAt).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </Text>
          <Text style={[s.time, { color: colors.accent }]}>
            {new Date(m.startsAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Card>
        <Card>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
            {m.placeName}
          </Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            {m.address}
          </Text>
          {m.latitude != null ? (
            <PlaceMap latitude={m.latitude} longitude={m.longitude} />
          ) : null}
          <Button
            label="지도 앱에서 보기"
            variant="outline"
            onPress={openMap}
          />
        </Card>
        {m.description ? (
          <Card>
            <Text style={[typeScale.body, { color: colors.text }]}>
              {m.description}
            </Text>
          </Card>
        ) : null}
        <Card>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
            참여자 {m.attendeeCount}명
          </Text>
          {(m.attendees ?? []).length ? (
            <View style={s.attendeeList}>
              {(m.attendees ?? []).map((person) => (
                <View
                  key={person.userId}
                  style={[s.attendeeRow, { borderBottomColor: colors.line }]}
                >
                  {person.avatarUrl ? (
                    <Image
                      source={{ uri: person.avatarUrl }}
                      style={s.avatar}
                    />
                  ) : (
                    <View
                      style={[s.avatar, { backgroundColor: colors.accentSoft }]}
                    >
                      <Text style={[s.avatarText, { color: colors.accent }]}>
                        {person.nickname.trim().charAt(0) || "·"}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[typeScale.body, { color: colors.text, flex: 1 }]}
                  >
                    {person.nickname}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.accent }]}>
                    참여
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              아직 참여자가 없어요. 첫 참여자가 되어보세요.
            </Text>
          )}
          {m.status === "OPEN" ? (
            <Button
              label={m.attending ? "참여 취소" : "이 약속에 참여하기"}
              variant={m.attending ? "outline" : "primary"}
              onPress={() => attend.mutate()}
              loading={attend.isPending}
            />
          ) : null}
        </Card>
        <Card>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
            함께 독서
          </Text>
          <Text style={[s.timer, { color: colors.text }]}>
            {formatClock(elapsed)}
          </Text>
          <Text
            style={[
              typeScale.caption,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {otherRunning
              ? "다른 약속에서 독서를 실행 중이에요."
              : running
                ? "이 약속의 독서 시간을 기록하고 있어요."
                : "약속 현장에서 독서 실행을 눌러 기록을 남겨보세요."}
          </Text>
          <Button
            label={running ? "독서 종료" : "독서 실행"}
            variant={running ? "danger" : "primary"}
            disabled={otherRunning || m.status !== "OPEN"}
            onPress={() => (running ? end.mutate() : start.mutate())}
            loading={start.isPending || end.isPending}
          />
        </Card>
        {isHost && m.status === "OPEN" ? (
          <Button
            label="약속 취소"
            variant="ghost"
            onPress={() => cancel.mutate()}
            loading={cancel.isPending}
          />
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}
const s = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 80 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  date: { ...typeScale.bodyStrong, textAlign: "center" },
  time: { fontSize: 38, fontWeight: "800", textAlign: "center", marginTop: 6 },
  timer: {
    fontSize: 48,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginVertical: spacing.md,
  },
  attendeeList: { marginTop: spacing.sm },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "800" },
});
