import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { attendanceApi } from '@/api/endpoints';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

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
        <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>DAILY CHECK-IN</Text>
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
                : `${data.nextRewardDay}일째에 ${data.nextRewardType === 'POSTCARD' ? '엽서 1장' : '우표 1개'}를 드려요.`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={done ? '오늘 출석 완료' : '오늘 출석체크'}
        disabled={done || completed || checkIn.isPending}
        onPress={() => checkIn.mutate()}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: done ? colors.surfaceRaised : colors.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[typeScale.label, { color: done ? colors.textMuted : colors.onAccent }]}>
          {checkIn.isPending ? '확인 중…' : done ? '출석 완료 ✓' : completed ? '28일 완료' : '출석하기'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? '출석 달력 접기' : '출석 달력 펼치기'}
        style={({ pressed }) => [
          styles.expandButton,
          { borderColor: colors.line },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
          {expanded ? '달력 접기 ︿' : '달력 보기 ﹀'}
        </Text>
      </Pressable>
      {expanded ? (
      <View style={styles.board} accessibilityLabel={`이번 달 ${data.monthlyAttendanceDays}일 출석`}>
        <View style={styles.calendarHeader}>
          <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>{monthLabel} 출석 달력</Text>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>매달 1일 초기화</Text>
        </View>
        {[0, 1, 2, 3].map((week) => (
          <View key={week} style={styles.weekRow}>
            <Text style={[styles.weekLabel, { color: colors.textFaint }]}>{week + 1}주</Text>
            {Array.from({ length: 7 }).map((_, index) => {
              const day = week * 7 + index + 1;
              const filled = day <= data.monthlyAttendanceDays;
              const reward = day === 7 || day === 21 ? '💌' : day === 14 || day === 28 ? '✉️' : null;
              return (
                <View
                  key={day}
                  style={[
                    styles.day,
                    { borderColor: filled ? colors.accent : colors.line },
                    filled && { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.dayText, { color: filled ? colors.accent : colors.textFaint }]}>
                    {reward ?? day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>7일 💌 엽서 · 14일 ✉️ 우표 · 21일 💌 엽서 · 28일 ✉️ 우표</Text>
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderWidth: hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, gap: spacing.xs },
  title: { ...typeScale.bodyStrong, fontSize: 17 },
  button: {
    minWidth: 92,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  expandButton: {
    width: '100%',
    minHeight: 36,
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
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 10, lineHeight: 12 },
});
