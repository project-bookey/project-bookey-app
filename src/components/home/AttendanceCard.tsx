import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { attendanceApi } from '@/api/endpoints';
import { Button, TextLink } from '@/components/ui';
import { controlHeight, hairline, radius, spacing, typeScale, useTheme } from '@/theme';

export function AttendanceCard() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const attendance = useQuery({
    queryKey: ['attendance'],
    queryFn: attendanceApi.status,
    staleTime: 30_000,
  });
  const checkIn = useMutation({
    mutationFn: attendanceApi.checkIn,
    onSuccess: (result) => {
      queryClient.setQueryData(['attendance'], result);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  if (attendance.isLoading || attendance.isError || !attendance.data) return null;

  const data = checkIn.data ?? attendance.data;
  const done = data.checkedInToday;
  const rewardedPostcard = (checkIn.data?.rewardedPostcards ?? 0) > 0;
  const rewardedStamp = (checkIn.data?.rewardedStamps ?? 0) > 0;
  const completed = data.monthlyAttendanceDays >= data.monthlyMaxDays;
  const monthLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long', timeZone: 'Asia/Seoul',
  }).format(new Date());

  return (
    <View style={[styles.card, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}>
      <View style={styles.copy}>
        <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>DAILY CHECK-IN</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {completed
            ? '이번 달 출석판을 모두 채웠어요'
            : `${data.monthlyAttendanceDays} / ${data.monthlyMaxDays}일 출석`}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>
          {rewardedPostcard
            ? '출석 보상 엽서 1장이 지갑에 들어왔어요.'
            : rewardedStamp
              ? '출석 보상 우표 1개가 지갑에 들어왔어요.'
            : done
              ? '오늘 출석을 마쳤어요. 내일 다시 만나요.'
              : completed
                ? '다음 달 1일에 새로운 출석판이 열려요.'
                : data.nextRewardType === 'POSTCARD'
                  ? `${data.nextRewardDay}일째 출석하면 엽서 1장을 드려요.`
                  : `${data.nextRewardDay}일째 출석하면 우표 1개를 드려요.`}
        </Text>
      </View>
      {done || completed ? (
        // 마친 상태는 버튼이 아니라 표시 — 흐린 비활성 버튼 대신 회색 면에 상태 말을 둔다.
        <View style={[styles.button, styles.doneBox, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={[styles.doneLabel, { color: colors.textMuted }]}>{done ? '출석 완료' : '이번 달 출석 끝'}</Text>
        </View>
      ) : (
        <Button
          label={checkIn.isPending ? '확인 중…' : '출석하기'}
          accessibilityLabel="오늘 출석체크"
          onPress={() => checkIn.mutate()}
          disabled={checkIn.isPending}
          style={styles.button}
        />
      )}
      {/* 카드 아래 접고 펴는 줄 — 구분선은 line, 줄 전체가 44pt 터치 상자. */}
      <TextLink
        label={expanded ? '달력 접기' : '달력 보기'}
        kind="action"
        onPress={() => setExpanded((value) => !value)}
        accessibilityLabel={expanded ? '출석 달력 접기' : '출석 달력 펼치기'}
        accessibilityState={{ expanded }}
        hitSlop={null}
        style={{ ...styles.expandButton, borderColor: colors.line }}
      />
      {expanded ? (
      <View style={styles.board} accessibilityLabel={`이번 달 ${data.monthlyAttendanceDays}일 출석`}>
        <View style={styles.calendarHeader}>
          <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>{monthLabel} 출석 달력</Text>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>매달 1일에 새로 시작해요</Text>
        </View>
        {[0, 1, 2, 3].map((week) => (
          <View key={week} style={styles.weekRow}>
            <Text style={[styles.weekLabel, { color: colors.textFaint }]}>{week + 1}주</Text>
            {Array.from({ length: 7 }).map((_, index) => {
              const day = week * 7 + index + 1;
              const filled = day <= data.monthlyAttendanceDays;
              // 보상 날짜는 숫자 대신 품목 이름을 적는다 — 이모지는 플랫폼마다 그림이 달라 쓰지 않는다.
              const reward = day === 7 || day === 21 ? '엽서' : day === 14 || day === 28 ? '우표' : null;
              return (
                <View
                  key={day}
                  style={[
                    styles.day,
                    // 채운 날은 도장처럼 잉크로 — 악센트는 출석하기 버튼 몫이다.
                    { borderColor: filled ? colors.ink : colors.line },
                    filled && { backgroundColor: colors.ink },
                  ]}
                >
                  <Text style={[styles.dayText, { color: filled ? colors.onInk : colors.textFaint }]}>
                    {reward ?? day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>7일·21일 엽서 · 14일·28일 우표</Text>
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, gap: spacing.xs },
  title: { ...typeScale.bodyStrong, fontSize: 17 },
  button: { minWidth: 92 },
  doneBox: {
    minHeight: controlHeight.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { ...typeScale.label, fontSize: 14 },
  expandButton: {
    width: '100%',
    minHeight: 44,
    borderTopWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  board: {
    width: '100%',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  weekLabel: { width: 30, fontSize: 10 },
  day: {
    width: 28,
    height: 28,
    borderRadius: radius.badge,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 10, lineHeight: 12, letterSpacing: -0.3 },
});
