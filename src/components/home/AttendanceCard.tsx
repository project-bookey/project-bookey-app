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
  const justRewarded = (checkIn.data?.rewardedBookmarks ?? 0) > 0;

  return (
    <View style={[styles.card, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}>
      <View style={styles.copy}>
        <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>DAILY CHECK-IN</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {done ? `${data.streakDays}일째 함께 읽는 중` : '오늘도 책장을 열어볼까요?'}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>
          {justRewarded
            ? `책갈피 ${data.rewardedBookmarks}개가 지갑에 들어왔어요.`
            : done
              ? '오늘 출석을 마쳤어요. 내일 다시 만나요.'
              : `출석하면 책갈피 ${data.dailyRewardBookmarks}개를 드려요.`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={done ? '오늘 출석 완료' : '오늘 출석체크'}
        disabled={done || checkIn.isPending}
        onPress={() => checkIn.mutate()}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: done ? colors.surfaceRaised : colors.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[typeScale.label, { color: done ? colors.textMuted : colors.onAccent }]}>
          {checkIn.isPending ? '확인 중…' : done ? '출석 완료 ✓' : '출석하기'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderWidth: hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
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
});
