import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubMeeting, ClubMeetingInput } from '@/api/endpoints';
import type { BookSummary } from '@/api/types';
import { MeetingBookPicker } from '@/components/club/MeetingBookPicker';
import { formatPickDate, formatPickTime } from '@/components/club/meetingTime';
import { PlaceMap } from '@/components/club/PlaceMap';
import { PlaceSearchModal, type PlacePick } from '@/components/club/PlaceSearchModal';
import { SearchGlyph, TiltCover } from '@/components/collage';
import { Button, Eyebrow, Field } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, mono, pressedStyle } from '@/theme/tokens';

/** 최대 인원 하한 — 혼자 하는 모임은 없다. 서버도 2명부터 받는다. */
const MIN_ATTENDEES = 2;

const freshDate = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(19, 0, 0, 0);
  return value;
};
const emptyFields = () => ({
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
const fieldsOf = (m: ClubMeeting) => ({
  title: m.title,
  description: m.description ?? '',
  placeName: m.placeName,
  address: m.address,
  mapUrl: m.mapUrl ?? '',
  latitude: m.latitude,
  longitude: m.longitude,
  maxAttendees: m.maxAttendees != null ? String(m.maxAttendees) : '',
});

/**
 * 모임 폼의 값 — 새 모임(모임 탭)과 모임 고치기가 같이 쓴다. meeting 을 넘기면 그 모임의 값으로 채운다.
 * 고칠 때는 이미 참여한 사람보다 정원을 줄일 수 없다(서버도 막는다).
 */
export function useMeetingForm(meeting?: ClubMeeting) {
  const [date, setDate] = useState(() => (meeting ? new Date(meeting.startsAt) : freshDate()));
  const [time, setTime] = useState(() => (meeting ? new Date(meeting.startsAt) : freshDate()));
  const [fields, setFields] = useState(() => (meeting ? fieldsOf(meeting) : emptyFields()));
  const [book, setBook] = useState<BookSummary | null>(meeting?.book ?? null);

  // 최대 인원 — 비우면 제한 없음, 적었으면 하한 이상의 정수여야 한다.
  const minAttendees = Math.max(MIN_ATTENDEES, meeting?.attendeeCount ?? 0);
  const maxText = fields.maxAttendees.trim();
  const maxAttendees = maxText ? Number(maxText) : null;
  const maxInvalid = maxAttendees != null && (!Number.isInteger(maxAttendees) || maxAttendees < minAttendees);
  /** 제목이나 장소가 비었다 — 쓰는 화면이 제출 버튼 곁에 '제목과 장소를 정하면 …'을 띄운다(최대 인원 오류는 칸 밑에 뜬다). */
  const missing = !(fields.title.trim() && fields.placeName.trim() && fields.address.trim());
  const ready = !missing && !maxInvalid;

  const toInput = (): ClubMeetingInput => {
    const startsAt = new Date(date);
    startsAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
    // 고칠 때 서버는 값을 통째로 바꾼다 — 이 폼에 없는 끝나는 시간 · 응답 마감도 그대로 실어 보낸다.
    // 끝나는 시간은 모임 길이를 지켜 함께 옮기고, 응답 마감은 새 시작보다 늦어지면 뺀다.
    const endsAt = meeting?.endsAt
      ? new Date(startsAt.getTime() + new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()).toISOString()
      : undefined;
    const deadline = meeting?.responseDeadline && new Date(meeting.responseDeadline) <= startsAt
      ? meeting.responseDeadline
      : undefined;
    return {
      ...fields,
      mapUrl: fields.mapUrl || undefined,
      startsAt: startsAt.toISOString(),
      endsAt,
      responseDeadline: deadline,
      bookId: book?.id,
      maxAttendees: maxAttendees ?? undefined,
    };
  };
  const reset = () => {
    setFields(emptyFields());
    setBook(null);
    setDate(freshDate());
    setTime(freshDate());
  };

  return { date, setDate, time, setTime, fields, setFields, book, setBook, minAttendees, maxInvalid, missing, ready, toInput, reset };
}

export type MeetingFormModel = ReturnType<typeof useMeetingForm>;

/**
 * 모임 폼의 칸들 — 제목 · 날짜/시간 · 읽을 책 · 장소 · 최대 인원 · 설명. 제출 버튼은 쓰는 화면이 둔다
 * (모임 탭은 폼 끝의 '모임 열기', 모임 고치기는 하단 띠의 '저장'). 장소 칸을 누르면 바로 전체 화면 장소 찾기가 뜬다.
 */
export function MeetingFormFields({ clubId, form, onLowerFieldFocus, onLowerFieldGrow }: {
  clubId: number;
  form: MeetingFormModel;
  /** 아래쪽 칸(최대 인원 · 설명)을 눌렀을 때 — 모임 탭은 '모임 열기'까지 키보드 위로 올린다. */
  onLowerFieldFocus?: () => void;
  /** 설명이 길어졌을 때 — 위와 같은 이유. */
  onLowerFieldGrow?: () => void;
}) {
  const { colors, mode } = useTheme();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showPlace, setShowPlace] = useState(false);
  const [showBooks, setShowBooks] = useState(false);
  const { date, setDate, time, setTime, fields, setFields, book, setBook } = form;

  // 장소 찾기에서 고른 곳으로 장소명 · 주소 · 지도를 한 번에 바꾼다. 주소로 찾아 건물 이름이 없으면 기본 이름을 넣고,
  // 아래 장소명 칸에서 고쳐 쓴다.
  const pickPlace = (place: PlacePick) => {
    setShowPlace(false);
    setFields((f) => ({
      ...f,
      placeName: place.placeName || '모임 장소',
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      mapUrl: place.mapUrl ?? '',
    }));
  };
  const changeDate = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== 'ios') setShowDate(false);
    if (value) setDate(value);
  };
  const changeTime = (_: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== 'ios') setShowTime(false);
    if (value) setTime(value);
  };

  return (
    <>
      <PlaceSearchModal clubId={clubId} visible={showPlace} onClose={() => setShowPlace(false)} onSelect={pickPlace} />
      <MeetingBookPicker
        visible={showBooks}
        selectedId={book?.id ?? null}
        onSelect={setBook}
        onClose={() => setShowBooks(false)}
      />
      <Field
        label="제목"
        value={fields.title}
        onChangeText={(title) => setFields((f) => ({ ...f, title }))}
        placeholder="모임 제목"
      />
      <View style={styles.pickRow}>
        <PickBox label="날짜" value={formatPickDate(date)} onPress={() => setShowDate(true)} />
        <PickBox label="시간" value={formatPickTime(time)} onPress={() => setShowTime(true)} />
      </View>
      {/* iOS 선택기는 그대로 두면 기기 설정(밝게/어둡게)을 따라 그려져 앱 테마와 어긋난다 — themeVariant 로
          앱 테마에 맞춘다. 고른 날짜는 앱의 선택 상태처럼 잉크(accentColor), 시간 휠 글자는 본문색.
          Android 다이얼은 앱 위에 뜨는 시스템 창이라 기기 설정을 따른다. */}
      {showDate ? (
        <View>
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            themeVariant={mode}
            accentColor={colors.ink}
            minimumDate={new Date()}
            onChange={changeDate}
          />
          {Platform.OS === 'ios' ? (
            <Button label="날짜 선택 완료" size="sm" variant="outline" onPress={() => setShowDate(false)} />
          ) : null}
        </View>
      ) : null}
      {showTime ? (
        <View>
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            themeVariant={mode}
            textColor={colors.text}
            minuteInterval={5}
            onChange={changeTime}
          />
          {Platform.OS === 'ios' ? (
            <Button label="시간 선택 완료" size="sm" variant="outline" onPress={() => setShowTime(false)} />
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
          <Button label="바꾸기" variant="outline" size="sm" onPress={() => setShowBooks(true)} />
        </View>
      ) : (
        <Button label="서재에서 고르기" variant="outline" onPress={() => setShowBooks(true)} />
      )}

      {/* 장소 칸을 누르면 바로 전체 화면 장소 찾기가 뜬다(홈 검색바 → 탐색과 같은 방식). 적는 대로 이름과 주소를
          함께 찾아 지도에 찍고, 고르면 이름·주소·지도가 한 번에 채워진다. */}
      <Eyebrow>장소</Eyebrow>
      <Pressable
        onPress={() => setShowPlace(true)}
        accessibilityRole="button"
        accessibilityLabel={fields.address ? '다른 장소 찾기' : '장소 찾기'}
        style={({ pressed }) => [
          styles.placeSearch,
          { borderColor: colors.lineStrong, backgroundColor: colors.surface },
          pressed ? pressedStyle : null,
        ]}
      >
        <SearchGlyph color={colors.textMuted} />
        <Text style={[typeScale.body, { color: colors.textFaint }]}>
          {fields.address ? '다른 장소 찾기' : '카페·서점 이름이나 주소로 찾기'}
        </Text>
      </Pressable>
      {fields.address ? (
        <>
          <Field
            label="장소명"
            value={fields.placeName}
            onChangeText={(placeName) => setFields((f) => ({ ...f, placeName }))}
            placeholder="장소명"
          />
          <Field
            label="상세 주소"
            value={fields.address}
            onChangeText={(address) => setFields((f) => ({ ...f, address }))}
            placeholder="상세 주소"
          />
        </>
      ) : null}
      {fields.latitude != null ? <PlaceMap latitude={fields.latitude} longitude={fields.longitude} /> : null}
      <Field
        label="최대 인원 (선택)"
        hint="비우면 제한 없이 받아요. 모임을 연 나도 정원에 들어가요."
        error={
          form.maxInvalid
            ? form.minAttendees > MIN_ATTENDEES
              ? `이미 ${form.minAttendees}명이 참여했어요. ${form.minAttendees}명 이상으로 적어 주세요.`
              : `${MIN_ATTENDEES}명 이상의 숫자로 적어 주세요.`
            : null
        }
        value={fields.maxAttendees}
        onChangeText={(maxAttendees) => setFields((f) => ({ ...f, maxAttendees: maxAttendees.replace(/[^0-9]/g, '') }))}
        placeholder="예: 8"
        keyboardType="number-pad"
        maxLength={4}
        onFocus={onLowerFieldFocus}
      />
      <Field
        label="설명 (선택)"
        value={fields.description}
        onChangeText={(description) => setFields((f) => ({ ...f, description }))}
        placeholder="어디까지 읽고 올지, 준비할 것"
        multiline
        style={styles.description}
        onFocus={onLowerFieldFocus}
        onContentSizeChange={onLowerFieldGrow}
      />
    </>
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

const styles = StyleSheet.create({
  description: { maxHeight: 160 }, // 길어지면 칸 안에서 스크롤 — 제출 버튼이 키보드 밑으로 밀려나지 않게
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
  // 홈 검색바와 같은 생김새 — 누르면 장소 찾기 화면이 뜨는 검색 칸.
  placeSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  // 고른 책 — 표지 · 제목 · 바꾸기가 한 줄.
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookTitle: { flex: 1 },
});
