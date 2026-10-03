import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubMeeting, type ClubMeetingInput, type ClubPlace } from '@/api/endpoints';
import { AddressSearchModal, type AddressSelection } from '@/components/club/AddressSearchModal';
import {
  MEETING_STATE_LABEL,
  formatPickDate,
  formatPickTime,
  meetingClock,
  meetingDay,
  meetingState,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { Avatar } from '@/components/Avatar';
import { Button, EmptyState, Eyebrow, Field, Loading } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, mono, pressedStyle } from '@/theme/tokens';

const freshDate = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(19, 0, 0, 0);
  return value;
};
const emptyForm = () => ({
  title: '',
  description: '',
  placeName: '',
  address: '',
  mapUrl: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
});

/**
 * 모임 탭 — 클럽 홈 '모임' 탭의 본문. 위는 괘선 머리줄(개수 · 호스트의 만들기), 아래는 모임을
 * 활자·괘선 판면으로 한 줄씩(왼쪽 모노 날짜 칸, 오른쪽 명조 제목·장소·참여). 호스트가 '모임 만들기'를
 * 누르면 목록 위에 새 모임 폼이 펼쳐진다.
 */
export function ClubMeetingsBody({ isHost }: { isHost: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [date, setDate] = useState(freshDate);
  const [time, setTime] = useState(freshDate);
  const [form, setForm] = useState(emptyForm);
  const [placeQuery, setPlaceQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(placeQuery.trim()), 500);
    return () => clearTimeout(timer);
  }, [placeQuery]);

  const list = useQuery({
    queryKey: ['clubMeetings', clubId],
    queryFn: () => clubCommunityApi.meetings(clubId),
  });
  const places = useQuery({
    queryKey: ['clubPlaces', clubId, debouncedQuery],
    queryFn: () => clubCommunityApi.searchPlaces(clubId, debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });
  const create = useMutation({
    mutationFn: (body: ClubMeetingInput) => clubCommunityApi.createMeeting(clubId, body),
    onSuccess: () => {
      setOpen(false);
      setForm(emptyForm());
      setPlaceQuery('');
      setDate(freshDate());
      setTime(freshDate());
      qc.invalidateQueries({ queryKey: ['clubMeetings', clubId] });
    },
  });

  const selectPlace = (place: ClubPlace) => {
    setForm((f) => ({
      ...f,
      placeName: place.name,
      address: place.roadAddress || place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      mapUrl: place.mapUrl ?? '',
    }));
    setPlaceQuery('');
    setDebouncedQuery('');
  };
  const selectAddress = (value: AddressSelection) => {
    setShowAddress(false);
    const address = value.roadAddress || value.address;
    setForm((f) => ({
      ...f,
      address,
      placeName: value.buildingName || f.placeName || '모임 장소',
      latitude: value.latitude,
      longitude: value.longitude,
    }));
    setPlaceQuery('');
  };
  const changeDate = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== 'ios') setShowDate(false);
    if (value) setDate(value);
  };
  const changeTime = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== 'ios') setShowTime(false);
    if (value) setTime(value);
  };
  const submit = () => {
    const startsAt = new Date(date);
    startsAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
    create.mutate({ ...form, mapUrl: form.mapUrl || undefined, startsAt: startsAt.toISOString() });
  };
  const canCreate = Boolean(form.title.trim() && form.placeName.trim() && form.address.trim() && !create.isPending);
  const meetings = list.data ?? [];

  return (
    <View style={styles.fill}>
      <AddressSearchModal
        clubId={clubId}
        visible={showAddress}
        onClose={() => setShowAddress(false)}
        onSelect={selectAddress}
      />
      <View style={[styles.head, { borderBottomColor: colors.line }]}>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 · {meetings.length}개</Text>
        {isHost ? (
          <Button label={open ? '닫기' : '모임 만들기'} size="sm" variant="ghost" onPress={() => setOpen((v) => !v)} />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {open ? (
          <View style={[styles.form, { borderColor: colors.lineStrong }]}>
            <Eyebrow>새 모임</Eyebrow>
            <Field
              label="제목"
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="모임 제목"
            />
            <View style={styles.pickRow}>
              <PickBox label="날짜" value={formatPickDate(date)} onPress={() => setShowDate(true)} />
              <PickBox label="시간" value={formatPickTime(time)} onPress={() => setShowTime(true)} />
            </View>
            {showDate ? (
              <View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  minimumDate={new Date()}
                  onChange={changeDate}
                />
                {Platform.OS === 'ios' ? (
                  <Button label="날짜 선택 완료" size="sm" variant="ghost" onPress={() => setShowDate(false)} />
                ) : null}
              </View>
            ) : null}
            {showTime ? (
              <View>
                <DateTimePicker
                  value={time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  minuteInterval={5}
                  onChange={changeTime}
                />
                {Platform.OS === 'ios' ? (
                  <Button label="시간 선택 완료" size="sm" variant="ghost" onPress={() => setShowTime(false)} />
                ) : null}
              </View>
            ) : null}

            <Eyebrow>장소</Eyebrow>
            <Button label="주소 검색" variant="outline" onPress={() => setShowAddress(true)} />
            <Field
              label="장소명 검색"
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="또는 카페·서점 등 장소명"
              hint="주소 검색이 어려우면 장소명으로 찾아요."
            />
            {places.isFetching ? (
              <Loading />
            ) : (
              (places.data ?? []).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => selectPlace(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name} 선택`}
                  style={({ pressed }) => [styles.placeRow, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
                >
                  <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>{p.roadAddress || p.address}</Text>
                </Pressable>
              ))
            )}
            {form.address ? (
              <>
                <Field
                  label="장소명"
                  value={form.placeName}
                  onChangeText={(placeName) => setForm((f) => ({ ...f, placeName }))}
                  placeholder="장소명"
                />
                <Field
                  label="상세 주소"
                  value={form.address}
                  onChangeText={(address) => setForm((f) => ({ ...f, address }))}
                  placeholder="상세 주소"
                />
              </>
            ) : null}
            {form.latitude != null ? <PlaceMap latitude={form.latitude} longitude={form.longitude} /> : null}
            <Field
              label="설명 (선택)"
              value={form.description}
              onChangeText={(description) => setForm((f) => ({ ...f, description }))}
              placeholder="어디까지 읽고 올지, 준비할 것"
              multiline
            />
            <Button label="모임 열기" onPress={submit} disabled={!canCreate} loading={create.isPending} />
            {!canCreate ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                제목과 주소 검색 후 장소명을 확인하면 열 수 있어요.
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
            description={isHost ? '첫 모임을 열고 함께 읽을 날을 잡아 보세요.' : '호스트가 모임을 열면 여기에 보여요.'}
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
      </ScrollView>
    </View>
  );
}

/** 날짜·시간 고르기 칸 — Field 입력과 같은 종이 상자, 값은 모노. */
function PickBox({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      style={({ pressed }) => [
        styles.pick,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed ? pressedStyle : null,
      ]}
    >
      <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.pickValue, { color: colors.text }]}>{value}</Text>
    </Pressable>
  );
}

/**
 * 모임 한 줄 — 왼쪽 모노 날짜 칸(10.1 / 목 19:30), 오른쪽 명조 제목 · 장소 · 참여자 아바타.
 * 지난 모임·취소는 글자를 죽인다. 줄 전체가 상세로 가는 링크라 별도 '자세히 보기'는 없다.
 */
function MeetingRow({ meeting: m, onPress }: { meeting: ClubMeeting; onPress: () => void }) {
  const { colors } = useTheme();
  const state = meetingState(m);
  const dim = state !== 'open';
  const attendees = m.attendees ?? [];
  const stateColor = state === 'cancelled' ? colors.danger : state === 'past' ? colors.textFaint : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.title} 모임 상세`}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
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
          <Text style={[typeScale.monoEyebrow, { color: stateColor }]}>{MEETING_STATE_LABEL[state]}</Text>
        </View>
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
            {attendees.length > 0 ? `${m.attendeeCount}명 참여` : '아직 참여자 없음'}
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
  form: { marginTop: spacing.lg, borderWidth: hairline, borderRadius: radius.sm, padding: spacing.lg, gap: spacing.sm },
  pickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  pick: {
    flex: 1,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  pickValue: { fontFamily: mono.semiBold, fontSize: 15 },
  placeRow: { paddingVertical: spacing.sm, gap: 2, borderBottomWidth: hairline },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: hairline },
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
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'meetings' } }} />;
}
