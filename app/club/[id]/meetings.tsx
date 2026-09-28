import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clubCommunityApi,
  type ClubMeetingInput,
  type ClubPlace,
} from "@/api/endpoints";
import { PaperScreen, SubHeader } from "@/components/collage";
import {
  AddressSearchModal,
  type AddressSelection,
} from "@/components/club/AddressSearchModal";
import { PlaceMap } from "@/components/club/PlaceMap";
import { Button, Card, Loading } from "@/components/ui";
import { radius, spacing, typeScale, useTheme } from "@/theme";

const freshDate = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(19, 0, 0, 0);
  return value;
};
const emptyForm = () => ({
  title: "",
  description: "",
  placeName: "",
  address: "",
  mapUrl: "",
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
});

export default function ClubMeetingsScreen() {
  const { id, host } = useLocalSearchParams<{ id: string; host?: string }>();
  const clubId = Number(id),
    isHost = host === "1";
  const router = useRouter(),
    qc = useQueryClient();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false),
    [showDate, setShowDate] = useState(false),
    [showTime, setShowTime] = useState(false),
    [showAddress, setShowAddress] = useState(false);
  const [date, setDate] = useState(freshDate),
    [time, setTime] = useState(freshDate),
    [form, setForm] = useState(emptyForm),
    [placeQuery, setPlaceQuery] = useState(""),
    [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(placeQuery.trim()), 500);
    return () => clearTimeout(timer);
  }, [placeQuery]);
  const list = useQuery({
    queryKey: ["clubMeetings", clubId],
    queryFn: () => clubCommunityApi.meetings(clubId),
  });
  const places = useQuery({
    queryKey: ["clubPlaces", clubId, debouncedQuery],
    queryFn: () => clubCommunityApi.searchPlaces(clubId, debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["clubMeetings", clubId] });
  const create = useMutation({
    mutationFn: (body: ClubMeetingInput) =>
      clubCommunityApi.createMeeting(clubId, body),
    onSuccess: () => {
      setOpen(false);
      setForm(emptyForm());
      setPlaceQuery("");
      setDate(freshDate());
      setTime(freshDate());
      refresh();
    },
  });
  const attend = useMutation({
    mutationFn: ({ mid, on }: { mid: number; on: boolean }) =>
      on
        ? clubCommunityApi.unattend(clubId, mid)
        : clubCommunityApi.attend(clubId, mid),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (mid: number) => clubCommunityApi.cancelMeeting(clubId, mid),
    onSuccess: refresh,
  });
  const selectPlace = (place: ClubPlace) => {
    setForm((f) => ({
      ...f,
      placeName: place.name,
      address: place.roadAddress || place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      mapUrl: place.mapUrl ?? "",
    }));
    setPlaceQuery("");
    setDebouncedQuery("");
  };
  const selectAddress = (value: AddressSelection) => {
    setShowAddress(false);
    const address = value.roadAddress || value.address;
    setForm((f) => ({
      ...f,
      address,
      placeName: value.buildingName || f.placeName || "약속 장소",
      latitude: value.latitude,
      longitude: value.longitude,
    }));
    setPlaceQuery("");
  };
  const changeDate = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== "ios") setShowDate(false);
    if (value) setDate(value);
  };
  const changeTime = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== "ios") setShowTime(false);
    if (value) setTime(value);
  };
  const submit = () => {
    const startsAt = new Date(date);
    startsAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
    create.mutate({
      ...form,
      mapUrl: form.mapUrl || undefined,
      startsAt: startsAt.toISOString(),
    });
  };
  const openMap = (m: {
    mapUrl?: string;
    latitude?: number;
    longitude?: number;
    address: string;
  }) => {
    const query =
      m.latitude != null && m.longitude != null
        ? `${m.latitude},${m.longitude}`
        : m.address;
    void Linking.openURL(
      m.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(query)}`,
    );
  };
  const canCreate = Boolean(
    form.title.trim() &&
      form.placeName.trim() &&
      form.address.trim() &&
      !create.isPending,
  );
  return (
    <PaperScreen>
      <SubHeader
        category="모임 약속"
        onBack={() => router.back()}
        right={
          isHost ? (
            <Button
              label={open ? "닫기" : "약속 만들기"}
              size="sm"
              variant="ghost"
              onPress={() => setOpen((v) => !v)}
            />
          ) : undefined
        }
      />
      <AddressSearchModal
        clubId={clubId}
        visible={showAddress}
        onClose={() => setShowAddress(false)}
        onSelect={selectAddress}
      />
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        {open ? (
          <Card>
            <Text style={[s.heading, { color: colors.text }]}>새 약속</Text>
            <TextInput
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="약속 제목"
              placeholderTextColor={colors.textFaint}
              style={[
                s.input,
                { color: colors.text, borderColor: colors.lineStrong },
              ]}
            />
            <View style={s.pickerRow}>
              <Pressable
                style={[s.picker, { borderColor: colors.lineStrong }]}
                onPress={() => setShowDate(true)}
              >
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  날짜
                </Text>
                <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {date.toLocaleDateString("ko-KR")}
                </Text>
              </Pressable>
              <Pressable
                style={[s.picker, { borderColor: colors.lineStrong }]}
                onPress={() => setShowTime(true)}
              >
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  시간
                </Text>
                <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {time.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>
            </View>
            {showDate ? (
              <View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "calendar"}
                  minimumDate={new Date()}
                  onChange={changeDate}
                />
                {Platform.OS === "ios" ? (
                  <Button
                    label="날짜 선택 완료"
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowDate(false)}
                  />
                ) : null}
              </View>
            ) : null}
            {showTime ? (
              <View>
                <DateTimePicker
                  value={time}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "clock"}
                  minuteInterval={5}
                  onChange={changeTime}
                />
                {Platform.OS === "ios" ? (
                  <Button
                    label="시간 선택 완료"
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowTime(false)}
                  />
                ) : null}
              </View>
            ) : null}
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
              장소
            </Text>
            <Button
              label="주소 검색"
              variant="outline"
              onPress={() => setShowAddress(true)}
            />
            <TextInput
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="또는 카페·서점 등 장소명 검색"
              placeholderTextColor={colors.textFaint}
              style={[
                s.input,
                { color: colors.text, borderColor: colors.lineStrong },
              ]}
            />
            {places.isFetching ? (
              <Loading />
            ) : (
              (places.data ?? []).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => selectPlace(p)}
                  style={[s.placeRow, { borderBottomColor: colors.line }]}
                >
                  <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                    {p.name}
                  </Text>
                  <Text
                    style={[typeScale.caption, { color: colors.textMuted }]}
                  >
                    {p.roadAddress || p.address}
                  </Text>
                </Pressable>
              ))
            )}
            {form.address ? (
              <>
                <TextInput
                  value={form.placeName}
                  onChangeText={(placeName) =>
                    setForm((f) => ({ ...f, placeName }))
                  }
                  placeholder="장소명"
                  placeholderTextColor={colors.textFaint}
                  style={[
                    s.input,
                    { color: colors.text, borderColor: colors.lineStrong },
                  ]}
                />
                <TextInput
                  value={form.address}
                  onChangeText={(address) =>
                    setForm((f) => ({ ...f, address }))
                  }
                  placeholder="상세 주소"
                  placeholderTextColor={colors.textFaint}
                  style={[
                    s.input,
                    { color: colors.text, borderColor: colors.lineStrong },
                  ]}
                />
              </>
            ) : null}
            {form.latitude != null ? (
              <PlaceMap latitude={form.latitude} longitude={form.longitude} />
            ) : null}
            <TextInput
              value={form.description}
              onChangeText={(description) =>
                setForm((f) => ({ ...f, description }))
              }
              placeholder="설명 (선택)"
              placeholderTextColor={colors.textFaint}
              multiline
              style={[
                s.input,
                { color: colors.text, borderColor: colors.lineStrong },
              ]}
            />
            <Button
              label={create.isPending ? "등록 중…" : "약속 열기"}
              onPress={submit}
              disabled={!canCreate}
            />
            {!canCreate ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                제목과 주소 검색 후 장소명을 확인하면 열 수 있어요.
              </Text>
            ) : null}
            {create.error ? (
              <Text style={{ color: colors.danger }}>
                약속을 만들지 못했어요. 입력 내용을 확인해 주세요.
              </Text>
            ) : null}
          </Card>
        ) : null}
        {list.isLoading ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            아직 열린 약속이 없어요.
          </Text>
        ) : (
          (list.data ?? []).map((m) => (
            <Pressable
              key={m.id}
              onPress={() =>
                router.push({
                  pathname: "/club/[id]/meeting/[meetingId]",
                  params: {
                    id: String(clubId),
                    meetingId: String(m.id),
                    host: isHost ? "1" : "0",
                  },
                })
              }
            >
              <Card>
                <View style={s.head}>
                  <Text style={[s.heading, { color: colors.text }]}>
                    {m.title}
                  </Text>
                  <Text
                    style={[
                      typeScale.caption,
                      {
                        color:
                          m.status === "OPEN" ? colors.accent : colors.danger,
                      },
                    ]}
                  >
                    {m.status === "OPEN" ? "모집 중" : "취소됨"}
                  </Text>
                </View>
                <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {new Date(m.startsAt).toLocaleString("ko-KR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
                <View style={s.listFooter}>
                  <View style={s.avatarStack}>
                    {(m.attendees ?? []).slice(0, 5).map((person, index) =>
                      person.avatarUrl ? (
                        <Image
                          key={person.userId}
                          source={{ uri: person.avatarUrl }}
                          style={[
                            s.listAvatar,
                            {
                              marginLeft: index ? -9 : 0,
                              borderColor: colors.surface,
                            },
                          ]}
                        />
                      ) : (
                        <View
                          key={person.userId}
                          style={[
                            s.listAvatar,
                            s.avatarFallback,
                            {
                              marginLeft: index ? -9 : 0,
                              borderColor: colors.surface,
                              backgroundColor: colors.accentSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[s.avatarInitial, { color: colors.accent }]}
                          >
                            {person.nickname.trim().charAt(0) || "·"}
                          </Text>
                        </View>
                      ),
                    )}
                    {(m.attendees ?? []).length > 5 ? (
                      <Text
                        style={[typeScale.caption, { color: colors.textMuted }]}
                      >
                        +{(m.attendees ?? []).length - 5}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[typeScale.caption, { color: colors.accent }]}>
                    자세히 보기 ›
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </PaperScreen>
  );
}
const s = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  heading: { ...typeScale.bodyStrong },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: spacing.sm,
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  picker: { flex: 1, borderWidth: 1, borderRadius: radius.sm, padding: 12, gap: 4 },
  placeRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, gap: 2 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  listFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  avatarStack: { flexDirection: "row", alignItems: "center", minHeight: 32 },
  listAvatar: { width: 30, height: 30, borderRadius: radius.round, borderWidth: 2 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 12, fontWeight: "800" },
});
