import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubMeeting, type ClubMeetingInput, type ClubPlace } from '@/api/endpoints';
import type { BookSummary } from '@/api/types';
import { AddressSearchModal, type AddressSelection } from '@/components/club/AddressSearchModal';
import { MeetingBookPicker } from '@/components/club/MeetingBookPicker';
import {
  MEETING_STATE_LABEL,
  attendeeLabel,
  formatPickDate,
  formatPickTime,
  isTodayOrLater,
  meetingClock,
  meetingDay,
  meetingState,
  meetingFull,
  meetingWeekday,
} from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { todayKst } from '@/components/clubLog';
import { TiltCover } from '@/components/collage';
import { KeyboardScroll, useScrollReveal } from '@/components/keyboard';
import { Avatar } from '@/components/Avatar';
import { Button, EmptyState, Eyebrow, Field, Loading, linkLabel } from '@/components/ui';
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
  /** 최대 인원 입력 — 비우면 제한 없음. */
  maxAttendees: '',
});
/** 최대 인원 하한 — 혼자 하는 모임은 없다. 서버도 2명부터 받는다. */
const MIN_ATTENDEES = 2;

/**
 * 모임 탭 — 클럽 홈 '모임' 탭의 본문. 위는 괘선 머리줄(개수 · 호스트의 만들기), 아래는 모임을
 * 활자·괘선 판면으로 한 줄씩(왼쪽 모노 날짜 칸, 오른쪽 명조 제목·장소·참여). 호스트가 '모임 만들기'를
 * 누르면 목록 위에 새 모임 폼이 펼쳐진다. 모임마다 읽을 책을 고를 수 있고(선택), 다가오는 모임의 책이
 * 클럽의 지금 읽는 책이 된다 — 진척 · 스포일러 가림 · 지금 읽는 중이 그 책을 본다.
 */
export function ClubMeetingsBody({ isHost, initialOpen = false }: {
  isHost: boolean;
  /** 클럽 홈의 '모임 만들기'로 들어오면 새 모임 폼을 펼친 채로 연다. */
  initialOpen?: boolean;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [open, setOpen] = useState(initialOpen && isHost);
  // 폼 아래쪽 칸(최대 인원·설명)을 누르면 '모임 열기'까지 키보드 위로 올린다.
  const scrollRef = useRef<ScrollView>(null);
  const submitRef = useRef<View>(null);
  const revealAbove = useScrollReveal(scrollRef);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [date, setDate] = useState(freshDate);
  const [time, setTime] = useState(freshDate);
  const [form, setForm] = useState(emptyForm);
  const [book, setBook] = useState<BookSummary | null>(null);
  const [showBooks, setShowBooks] = useState(false);
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
      setBook(null);
      setPlaceQuery('');
      setDate(freshDate());
      setTime(freshDate());
      qc.invalidateQueries({ queryKey: ['clubMeetings', clubId] });
      // 다가오는 모임의 책이 바뀌었을 수 있다 — 클럽 홈의 지금 읽는 책 · 진척을 다시 받는다.
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
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
    create.mutate({
      ...form,
      mapUrl: form.mapUrl || undefined,
      startsAt: startsAt.toISOString(),
      bookId: book?.id,
      maxAttendees: maxAttendees ?? undefined,
    });
  };
  // 최대 인원 — 비우면 제한 없음, 적었으면 2 이상의 정수여야 한다.
  const maxText = form.maxAttendees.trim();
  const maxAttendees = maxText ? Number(maxText) : null;
  const maxInvalid = maxAttendees != null && (!Number.isInteger(maxAttendees) || maxAttendees < MIN_ATTENDEES);
  const canCreate = Boolean(
    form.title.trim() && form.placeName.trim() && form.address.trim() && !maxInvalid && !create.isPending,
  );
  const meetings = list.data ?? [];

  return (
    <View style={styles.fill}>
      <AddressSearchModal
        clubId={clubId}
        visible={showAddress}
        onClose={() => setShowAddress(false)}
        onSelect={selectAddress}
      />
      <MeetingBookPicker
        visible={showBooks}
        selectedId={book?.id ?? null}
        onSelect={setBook}
        onClose={() => setShowBooks(false)}
      />
      <View style={[styles.head, { borderBottomColor: colors.line }]}>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 · {meetings.length}개</Text>
        {isHost ? (
          // 호스트가 이 탭에서 하는 주요 행동 — 글자 링크가 아니라 테두리 버튼으로 크게(악센트는 폼의 '모임 열기' 몫).
          <Button label={open ? '닫기' : '모임 만들기'} variant="outline" onPress={() => setOpen((v) => !v)} />
        ) : null}
      </View>
      <KeyboardScroll ref={scrollRef} contentContainerStyle={styles.container}>
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

            {/* 읽을 책(선택) — 고르면 이 모임이 다가올 때 클럽의 지금 읽는 책이 된다. */}
            <Eyebrow>읽을 책 (선택)</Eyebrow>
            {book ? (
              <View style={styles.bookRow}>
                <TiltCover uri={book.coverUrl} title={book.title} width={38} tilt={0} entering={false} />
                <Text numberOfLines={2} style={[typeScale.label, styles.bookTitle, { color: colors.text }]}>
                  {book.title}
                </Text>
                <Button label="바꾸기" variant="ghost" size="sm" onPress={() => setShowBooks(true)} />
              </View>
            ) : (
              <Button label="서재에서 고르기" variant="outline" onPress={() => setShowBooks(true)} />
            )}

            {/* 장소를 넣는 길은 하나 — 이름으로 찾으면 이름·주소·지도가 한 번에 채워진다.
                주소 검색은 찾는 곳이 없을 때의 대안으로 아래 링크로 낮춘다(UX 철칙 Hick). */}
            <Eyebrow>장소</Eyebrow>
            <Field
              label="장소 검색"
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="카페·서점 등 장소 이름"
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
            <Pressable
              onPress={() => setShowAddress(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addressLink, pressed ? pressedStyle : null]}
            >
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
                찾는 곳이 없나요? {linkLabel('주소로 찾기')}
              </Text>
            </Pressable>
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
              label="최대 인원 (선택)"
              hint="비우면 제한 없이 받아요. 정원이 차면 더 참여할 수 없어요."
              error={maxInvalid ? `${MIN_ATTENDEES}명 이상의 숫자로 적어 주세요.` : null}
              value={form.maxAttendees}
              onChangeText={(maxAttendees) => setForm((f) => ({ ...f, maxAttendees: maxAttendees.replace(/[^0-9]/g, '') }))}
              placeholder="예: 8"
              keyboardType="number-pad"
              maxLength={4}
              onFocus={() => revealAbove(submitRef)}
            />
            <Field
              label="설명 (선택)"
              value={form.description}
              onChangeText={(description) => setForm((f) => ({ ...f, description }))}
              placeholder="어디까지 읽고 올지, 준비할 것"
              multiline
              style={styles.description}
              onFocus={() => revealAbove(submitRef)}
              onContentSizeChange={() => revealAbove(submitRef, { onlyIfOpen: true })}
            />
            <View ref={submitRef} style={styles.submit}>
              <Button label="모임 열기" onPress={submit} disabled={!canCreate} loading={create.isPending} />
            </View>
            {!canCreate ? (
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
      </KeyboardScroll>
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
  form: { marginTop: spacing.lg, borderWidth: hairline, borderRadius: radius.sm, padding: spacing.lg, gap: spacing.md },
  // 입력들과 떼어 둔다 — 폼 간격(md)에 md 를 더해 xl.
  submit: { marginTop: spacing.md },
  description: { maxHeight: 160 }, // 길어지면 칸 안에서 스크롤 — '모임 열기'가 키보드 밑으로 밀려나지 않게
  pickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  pick: {
    flex: 1,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  pickValue: { fontFamily: mono.semiBold, fontSize: 15 },
  placeRow: { paddingVertical: spacing.sm, gap: 2, borderBottomWidth: hairline },
  // 11px 모노 한 줄이라 여백으로 44pt 상자를 만든다(웹은 hitSlop 을 무시한다).
  addressLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: hairline },
  // 내가 참여한 모임 — 줄을 테두리 상자로 감싸되, 음수 마진 짝으로 글자 줄은 다른 줄과 맞춘다.
  mineRow: {
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    marginVertical: spacing.xs,
  },
  // 고른 책 — 표지 · 제목 · 바꾸기가 한 줄.
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookTitle: { flex: 1 },
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
