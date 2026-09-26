import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { attendanceApi } from '@/api/endpoints';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

export function AttendanceCard() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
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
  const justRewarded = (checkIn.data?.rewardedStamps ?? 0) > 0;
  const completed = data.monthlyAttendanceDays >= data.monthlyMaxDays;

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
          {justRewarded
            ? '7일 보상 우표 1개가 지갑에 들어왔어요.'
            : done
              ? '오늘 출석을 마쳤어요. 내일 다시 만나요.'
              : completed
                ? '다음 달 1일에 새로운 출석판이 열려요.'
                : `${data.nextRewardDay}일째에 우표 1개를 드려요.`}
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
      <View style={styles.board} accessibilityLabel={`이번 달 ${data.monthlyAttendanceDays}일 출석`}>
        {Array.from({ length: data.monthlyMaxDays }).map((_, index) => {
          const day = index + 1;
          const filled = day <= data.monthlyAttendanceDays;
          const rewardDay = day % data.rewardEveryDays === 0;
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
                {rewardDay ? '✉' : day}
              </Text>
            </View>
          );
        })}
      </View>
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
  board: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
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
