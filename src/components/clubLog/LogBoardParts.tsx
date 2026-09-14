import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubLogDayCount, ClubLogSummary, ReadingNow } from '@/api/types';
import { StickyNote } from '@/components/collage';
import { Button, formatDuration } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';
import { dayOfMonth, weekdayLabel } from './dates';

/** 분 단위 경과 — '38분째'. 1분 미만은 '방금'. */
function elapsedLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  return minutes < 1 ? '방금 시작' : `${minutes}분째`;
}

/**
 * '지유, 민수 님이' / '지유 님 외 2명이'.
 * 닉네임 끝이 숫자·영문이면 이/가를 고를 수 없어서 '님이'로 통일한다.
 */
export function readersLabel(readers: ReadingNow[]): string {
  if (readers.length <= 2) return `${readers.map((r) => r.nickname).join(', ')} 님이`;
  return `${readers[0].nickname} 님 외 ${readers.length - 1}명이`;
}

/** 지금 읽는 중 — 아바타 이니셜 겹침 + 문구 + (선택) 합류. 아무도 없으면 그리지 않는다. */
export function ReadingNowCard({ readers, onJoin }: { readers: ReadingNow[]; onJoin?: () => void }) {
  const { colors, cardShadow } = useTheme();
  if (readers.length === 0) return null;
  const earliest = readers[0];

  return (
    <View
      style={[styles.nowCard, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}
      accessibilityRole="summary"
    >
      <View style={styles.avatars}>
        {readers.slice(0, 3).map((reader, i) => (
          <View
            key={reader.userId}
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.accent, marginLeft: i === 0 ? 0 : -8 },
            ]}
          >
            <Text style={[typeScale.label, { color: colors.text, fontSize: 11 }]}>{reader.nickname.slice(0, 1)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.label, { color: colors.text }]} numberOfLines={1}>
          {readersLabel(readers)} 지금 읽는 중
        </Text>
        <Text style={[styles.monoCaption, { color: colors.textFaint }]}>{elapsedLabel(earliest.startedAt)}</Text>
      </View>
      {onJoin ? <Button label="합류" size="sm" variant="outline" onPress={onJoin} /> : null}
    </View>
  );
}

/** 요일 스트립 — 조각 수만큼 점(최대 3), 고른 날은 악센트 알약, 오늘 이후는 누를 수 없다. */
export function WeekStrip({ days, selected, today, onSelect }: {
  days: ClubLogDayCount[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.week}>
      {days.map((day) => {
        const active = day.date === selected;
        const future = day.date > today;
        const fg = active ? colors.onAccent : future ? colors.textFaint : colors.textMuted;
        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            disabled={future}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: future }}
            accessibilityLabel={`${dayOfMonth(day.date)}일 조각 ${day.logCount}개`}
            style={[styles.day, active && { backgroundColor: colors.accent }, future && { opacity: 0.4 }]}
          >
            <Text style={[styles.weekday, { color: active ? colors.onAccent : colors.textFaint }]}>
              {weekdayLabel(day.date)}
            </Text>
            <Text style={[styles.dayNumber, { color: fg }]}>{dayOfMonth(day.date)}</Text>
            <View style={styles.dots}>
              {Array.from({ length: Math.min(3, day.logCount) }, (_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: active ? colors.onAccent : colors.accent }]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 오늘 합산 스티키 — '오늘 함께 212쪽 · 3명이 3시간 10분'. 읽은 기록이 없으면 조각 수만. */
export function SummaryNote({ summary, label, rotate = -2 }: {
  summary: ClubLogSummary;
  label: string;
  rotate?: number;
}) {
  const { colors } = useTheme();
  return (
    <StickyNote rotate={rotate}>
      <Text style={[typeScale.monoEyebrow, { color: colors.onNote }]}>{label}</Text>
      <Text style={[styles.notePages, { color: colors.onNote }]}>{summary.pagesRead}쪽</Text>
      <Text style={[typeScale.caption, { color: colors.onNote, fontSize: 11, lineHeight: 15 }]}>
        {summary.readerCount > 0
          ? `${summary.readerCount}명이 ${formatDuration(summary.durationSec)}`
          : `조각 ${summary.logCount}개`}
      </Text>
    </StickyNote>
  );
}

const styles = StyleSheet.create({
  nowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: hairline,
    borderRadius: radius.lg,
  },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoCaption: { fontFamily: mono.regular, fontSize: 11 },
  week: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.pill,
  },
  weekday: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 1 },
  dayNumber: { fontFamily: mono.semiBold, fontSize: 13 },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: radius.pill },
  notePages: { fontFamily: mono.semiBold, fontSize: 24, marginTop: 4 },
});
