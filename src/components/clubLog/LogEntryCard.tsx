import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { Card, Eyebrow, Rule, formatDuration } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, tiltFor } from '@/theme/tokens';
import { todayKst } from './dates';
import { readersLabel } from './LogBoardParts';
import { clubLogKeys } from './queries';

/** 미리보기로 보여줄 최근 조각 수. */
const PREVIEW_COUNT = 3;

/**
 * 모임 홈의 읽기로그 진입 카드 — 지금 읽는 중 한 줄 · 오늘 조각 가로 스트립 · 오늘 합산.
 * 첫 칸은 '오늘 한 조각'(남기기), 나머지는 최근 조각. 카드 어디를 눌러도 보드로 간다.
 */
export function LogEntryCard({ clubId, canWrite, onOpenBoard, onWrite }: {
  clubId: number;
  /** 끝난 모임이면 남기기 칸을 숨긴다. */
  canWrite: boolean;
  onOpenBoard: () => void;
  onWrite: () => void;
}) {
  const { colors, cardShadow } = useTheme();
  const today = todayKst();
  const day = useQuery({ queryKey: clubLogKeys.day(clubId, today), queryFn: () => clubApi.logs(clubId, today) });
  const readingNow = useQuery({
    queryKey: clubLogKeys.readingNow(clubId),
    queryFn: () => clubApi.readingNow(clubId),
    refetchInterval: 30_000,
  });

  // 구버전 서버처럼 읽기로그 API 가 없으면 카드 자체를 숨긴다.
  if (day.isError) return null;

  const logs = day.data?.logs ?? [];
  const recent = logs.slice(-PREVIEW_COUNT).reverse();
  const readers = readingNow.data ?? [];
  const summary = day.data?.summary;

  return (
    <View>
      <View style={styles.head}>
        <Eyebrow>읽기로그</Eyebrow>
        <Pressable onPress={onOpenBoard} hitSlop={12} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>보드 열기 →</Text>
        </Pressable>
      </View>
      <Card style={{ marginTop: spacing.sm, gap: spacing.lg }}>
        {readers.length > 0 ? (
          <View style={styles.nowRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.accent, borderColor: colors.accentSoft }]} />
            <Text style={[typeScale.label, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {readersLabel(readers)} 지금 읽는 중
            </Text>
          </View>
        ) : null}

        <View style={styles.strip}>
          {canWrite ? (
            <Pressable
              onPress={onWrite}
              accessibilityRole="button"
              accessibilityLabel="오늘 한 조각 남기기"
              style={[styles.addTile, { borderColor: colors.lineStrong, backgroundColor: colors.surfaceDeep }]}
            >
              <Text style={[styles.plus, { color: colors.textMuted }]}>+</Text>
              <Text style={[typeScale.caption, { color: colors.textMuted, fontSize: 11, textAlign: 'center' }]}>
                오늘{'\n'}한 조각
              </Text>
            </Pressable>
          ) : null}
          {recent.map((log, i) => (
            <Pressable
              key={log.id}
              onPress={onOpenBoard}
              accessibilityRole="button"
              accessibilityLabel={`${log.authorNickname}의 조각`}
              style={[styles.mini, { backgroundColor: colors.memoPad, transform: [{ rotate: `${tiltFor(i + 1)}deg` }] }, cardShadow]}
            >
              {log.imageUrl ? (
                <Image source={{ uri: log.imageUrl }} style={styles.miniPhoto} resizeMode="cover" />
              ) : (
                <View style={[styles.miniPhoto, styles.miniText, { backgroundColor: log.masked ? colors.surfaceRaised : colors.surfaceDeep }]}>
                  <Text style={[typeScale.caption, { color: colors.textMuted, fontSize: 10 }]} numberOfLines={3}>
                    {log.masked ? `${log.anchorPage ?? ''}쪽` : log.body}
                  </Text>
                </View>
              )}
              <Text style={[styles.miniMeta, { color: colors.mid }]} numberOfLines={1}>
                {log.authorNickname}{log.anchorPage != null ? ` · ${log.anchorPage}쪽` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {summary ? (
          <>
            <Rule />
            <View style={styles.footer}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>오늘 함께</Text>
              <Text style={[styles.footerValue, { color: colors.textMuted }]}>
                {summary.pagesRead}쪽 · {formatDuration(summary.durationSec)} · {summary.logCount}조각
              </Text>
            </View>
          </>
        ) : null}
      </Card>
    </View>
  );
}

const TILE_W = 70;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 3 },
  strip: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.xs },
  addTile: {
    width: TILE_W,
    height: 94,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transform: [{ rotate: '-2deg' }],
  },
  plus: { fontFamily: mono.regular, fontSize: 18, lineHeight: 20 },
  mini: { width: TILE_W, padding: 4, paddingBottom: 6, borderRadius: radius.sm },
  miniPhoto: { width: '100%', height: 62 },
  miniText: { padding: 4, justifyContent: 'center' },
  miniMeta: { fontFamily: mono.regular, fontSize: 8.5, marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  footerValue: { fontFamily: mono.regular, fontSize: 11 },
});
