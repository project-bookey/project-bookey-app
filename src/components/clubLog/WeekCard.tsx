import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import type { ClubLogWeek, ClubPost } from '@/api/types';
import { DotGridBackground } from '@/components/collage';
import { formatDuration } from '@/components/ui';
import { useTheme } from '@/theme';
import { mono, radius, serif } from '@/theme/tokens';
import { weekTitle } from './dates';

/** 카드 설계 폭 — 모든 치수는 이 폭 기준 값에 실제 폭 비율(u)을 곱한다. 9:16. */
export const WEEK_CARD_BASE_WIDTH = 360;
export const WEEK_CARD_RATIO = 16 / 9;

/**
 * 조각 칸 — 설계 폭 360 기준 콜라주 영역(312×460) 안의 좌표·폭·기울기.
 * 순서대로 채우고, 겹침은 콜라주의 일부로 둔다(나중 칸이 위).
 */
const SLOTS = [
  { x: 0, y: 8, w: 128, rotate: -5 },
  { x: 116, y: 30, w: 108, rotate: 4 },
  { x: 214, y: 0, w: 98, rotate: -2 },
  { x: 10, y: 176, w: 118, rotate: 3 },
  { x: 206, y: 262, w: 104, rotate: 6 },
  { x: 118, y: 270, w: 86, rotate: -4 },
] as const;

/** '9/14 – 9/20' */
function range(start: string, end: string): string {
  const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  return `${md(start)} – ${md(end)}`;
}

/**
 * 주간 공유 카드 — 스토리 비율(9:16) 한 장. 화면 폭에 맞춰 비율대로 그리고, 캡처는 이 View 를 그대로 찍는다.
 * 서버가 보는 사람에게 가려진 조각·문장을 빼고 내려주므로 여기서는 받은 그대로 배치한다.
 */
export const WeekCard = forwardRef<View, { week: ClubLogWeek; width: number }>(function WeekCard({ week, width }, ref) {
  const { colors } = useTheme();
  const u = width / WEEK_CARD_BASE_WIDTH;
  const s = (n: number) => n * u;
  const highlights = (week.highlights ?? []).slice(0, SLOTS.length);
  const { summary } = week;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width,
        height: width * WEEK_CARD_RATIO,
        backgroundColor: colors.bg,
        paddingTop: s(28),
        paddingBottom: s(22),
        paddingHorizontal: s(24),
        overflow: 'hidden',
        borderRadius: s(radius.lg),
        // 화면 배경과 같은 색이라 테두리가 없으면 카드 경계가 사라진다.
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <DotGridBackground />

      <View style={{ gap: s(8) }}>
        <Text style={{ fontFamily: mono.semiBold, fontSize: s(10), letterSpacing: s(2), color: colors.accent }}>
          읽기로그 · {weekTitle(week.weekStart)}
        </Text>
        <Text style={{ fontFamily: serif.extraBold, fontSize: s(26), lineHeight: s(35), letterSpacing: -0.5 * u, color: colors.text }}>
          {week.clubName},{'\n'}이번 주
        </Text>
      </View>

      <View style={{ flex: 1, marginTop: s(16) }}>
        {highlights.map((log, i) => (
          <Scrap key={log.id} log={log} slot={SLOTS[i]} u={u} />
        ))}

        {week.topQuote ? (
          <View
            style={[
              styles.quote,
              {
                left: s(150),
                top: s(172),
                width: s(162),
                padding: s(12),
                backgroundColor: colors.surfaceDeep,
                borderColor: colors.lineStrong,
                transform: [{ rotate: '-2deg' }],
              },
            ]}
          >
            <Text numberOfLines={3} style={{ fontFamily: serif.regular, fontSize: s(13), lineHeight: s(20), color: colors.text }}>
              “{week.topQuote}”
            </Text>
            <Text style={{ fontFamily: mono.regular, fontSize: s(9), marginTop: s(6), color: colors.textFaint }}>
              이번 주 가장 많이 멈춘 문장
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sticky,
            {
              left: s(24),
              top: s(330),
              width: s(156),
              padding: s(12),
              backgroundColor: colors.note,
              transform: [{ rotate: '-3deg' }],
            },
          ]}
        >
          <Text style={{ fontFamily: mono.semiBold, fontSize: s(10), letterSpacing: s(2), color: colors.onNote }}>
            함께 읽은 일주일
          </Text>
          <Text style={{ fontFamily: mono.semiBold, fontSize: s(22), marginTop: s(4), color: colors.onNote }}>
            {summary.pagesRead.toLocaleString()}쪽
          </Text>
          <Text style={{ fontFamily: mono.regular, fontSize: s(10), marginTop: s(2), color: colors.onNote }}>
            {summary.readerCount}명 · {formatDuration(summary.durationSec)} · {summary.logCount}조각
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.line, paddingTop: s(12) }]}>
        <Text style={{ fontFamily: mono.semiBold, fontSize: s(11), letterSpacing: s(1.2), color: colors.text }}>bookey</Text>
        <Text style={{ fontFamily: mono.regular, fontSize: s(10), letterSpacing: s(0.6), color: colors.textFaint }}>
          {range(week.weekStart, week.weekEnd)}
        </Text>
      </View>
    </View>
  );
});

/** 조각 한 칸 — 사진은 폴라로이드, 글만 남긴 조각은 같은 틀에 한 줄을 적는다. */
function Scrap({ log, slot, u }: { log: ClubPost; slot: (typeof SLOTS)[number]; u: number }) {
  const { colors, cardShadow } = useTheme();
  const s = (n: number) => n * u;
  const frame: ViewStyle = {
    position: 'absolute',
    left: s(slot.x),
    top: s(slot.y),
    width: s(slot.w),
    padding: s(6),
    paddingBottom: s(10),
    backgroundColor: colors.memoPad,
    borderRadius: s(radius.sm),
    transform: [{ rotate: `${slot.rotate}deg` }],
  };
  const day = weekdayOf(log.createdAt);

  return (
    <View style={[frame, cardShadow]}>
      {log.imageUrl ? (
        <Image source={{ uri: log.imageUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceDeep, padding: s(8), justifyContent: 'center' }}>
          <Text numberOfLines={5} style={{ fontFamily: serif.regular, fontSize: s(11), lineHeight: s(16), color: colors.text }}>
            {log.body}
          </Text>
        </View>
      )}
      <Text numberOfLines={1} style={{ fontFamily: mono.regular, fontSize: s(9), marginTop: s(6), color: colors.mid }}>
        {day} · {log.authorNickname}{log.anchorPage != null ? ` · ${log.anchorPage}쪽` : ''}
      </Text>
    </View>
  );
}

/** 조각을 남긴 KST 요일. */
function weekdayOf(isoInstant: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date(isoInstant));
}

const styles = StyleSheet.create({
  quote: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderRadius: 2 },
  sticky: { position: 'absolute', borderRadius: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1 },
});
