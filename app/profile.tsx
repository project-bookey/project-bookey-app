import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { API_BASE_URL } from '@/api/client';
import { libraryApi, notificationApi, statsApi } from '@/api/endpoints';
import type { DailyStat, NotifyTone, ReadingRecord } from '@/api/types';
import { PaperScreen, SectionNav, TiltCover, useCoverEntrance } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Segmented, Toggle, formatDuration,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import type { ThemePreference } from '@/store/themePreference';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, statusLabel, typeScale, useTheme } from '@/theme';
import { rowOffsetY, tiltFor } from '@/theme/tokens';

const TONES: { value: NotifyTone; label: string; sample: string }[] = [
  { value: 'GENTLE', label: '다정', sample: '12쪽 남았어요. 오늘 10분이면 끝나요.' },
  { value: 'FACT', label: '팩트', sample: '5일 미독. 완독 예상일이 9/12 → 10/3으로 밀립니다.' },
  { value: 'SPARTA', label: '스파르타', sample: '5일째 안 읽음. 책이 당신을 노려보고 있습니다.' },
  { value: 'TSUNDERE', label: '츤데레', sample: '뭐, 안 읽어도 상관없는데. 남은 12쪽이 좀 불쌍하긴 하네.' },
  { value: 'SILENT', label: '무음', sample: '푸시 없이 인앱 배지로만 알립니다.' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 선반에 올리는 최대 권수 — 넘치면 '전체보기'로 넘긴다. */
const SHELF_CAP = 10;
/** 선반 표지 폭(px) — 시안 2e 기준. */
const SHELF_COVER_W = 100;
/** 월별 차트 막대 영역 높이(px). */
const CHART_H = 76;
/** 히트맵에 그리는 최근 일수 — 통계 응답이 더 짧으면 응답 길이를 따른다. */
const HEATMAP_DAYS = 90;

/**
 * 구역 4. 나 — 프로필 · 내 서재 선반 · 올해 읽은 시간 · 기록 · 설정 (시안 2e).
 * 설정 영역은 스킨만 바뀌었고 호출하는 API·상태는 이전과 동일하다.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);

  const summary = useQuery({ queryKey: ['library', 'summary'], queryFn: libraryApi.summary });
  // 홈과 같은 캐시 키를 쓴다 — 서가 탭을 거쳐 왔다면 그대로 재사용된다.
  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const want = useQuery({ queryKey: ['library', 'WANT_TO_READ'], queryFn: () => libraryApi.list('WANT_TO_READ') });
  // 월별 차트가 6개월을 그리므로 180일로 받는다. 히트맵은 이 응답의 최근 구간만 잘라 쓴다.
  const stats = useQuery({ queryKey: ['stats', 180], queryFn: () => statsApi.summary(180) });

  const updateSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => notificationApi.updateSettings(body),
    onSuccess: (_, body) => {
      if (user) {
        setUser({ ...user, ...(body as object) } as typeof user);
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  // 읽는 중을 앞에 세우고 읽고 싶은 책을 뒤에 잇는다 — 선반은 '지금 손이 가는 순서'다.
  const shelf: ReadingRecord[] = [
    ...(reading.data?.content ?? []),
    ...(want.data?.content ?? []),
  ].slice(0, SHELF_CAP);
  const shelfLoading = reading.isLoading || want.isLoading;

  const counts = summary.data;
  const libraryTotal = counts
    ? counts.reading + counts.wantToRead + counts.finished + counts.paused + counts.abandoned
    : shelf.length;

  const heatDaily = (stats.data?.daily ?? []).slice(-HEATMAP_DAYS);

  return (
    <PaperScreen>
      <SectionNav active="me" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarInitial, { color: colors.textMuted }]}>
                {user?.nickname?.slice(0, 1) ?? '?'}
              </Text>
            )}
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[styles.nickname, { color: colors.text }]}>
              {user?.nickname ?? '독자'}
            </Text>
            {/* 서버 MeResponse 에 가입일이 없어 핸들로 대신한다 — 필드가 생기면 '{연도} 가입'으로 바꾼다. */}
            <Text style={[typeScale.monoLabel, styles.profileMeta, { color: colors.textFaint }]}>
              @{user?.handle ?? '—'} · 완독 {counts?.finished ?? 0}권
            </Text>
          </View>
        </View>

        <View style={styles.shelfSection}>
          <View style={styles.shelfHeader}>
            <Text style={[typeScale.titleSerif, styles.shelfTitle, { color: colors.text }]}>내 서재</Text>
            <Pressable
              onPress={() => router.push('/library')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`서재 전체보기, 총 ${libraryTotal}권`}
            >
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
                {libraryTotal}권 · 전체보기 →
              </Text>
            </Pressable>
          </View>

          {shelfLoading ? (
            <View style={styles.shelfList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.shelfSkeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : shelf.length === 0 ? (
            <View style={styles.shelfList}>
              <Pressable
                onPress={() => router.push('/search')}
                accessibilityRole="button"
                accessibilityLabel="책 추가"
              >
                <View style={[styles.shelfGhost, { borderColor: colors.lineStrong }]}>
                  <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>책 추가</Text>
                </View>
              </Pressable>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.shelfGhost, { borderColor: colors.lineStrong }]} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfList}
            >
              {shelf.map((record, index) => (
                <ShelfItem
                  key={record.id}
                  record={record}
                  index={index}
                  onPress={() => {
                    if (record.book?.id != null) {
                      router.push(`/book/${record.book.id}?recordId=${record.id}`);
                    }
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.block}>
          <YearChart daily={stats.data?.daily ?? []} loading={stats.isLoading} />
        </View>

        {stats.isLoading ? null : (
          <View style={styles.block}>
            <Card>
              <Eyebrow>기록</Eyebrow>
              {stats.data ? (
                <>
                  <View style={styles.statRow}>
                    <StatCell label="현재 스트릭" value={`${stats.data.currentStreakDays}일`} />
                    <VRule />
                    <StatCell label="최장 스트릭" value={`${stats.data.longestStreakDays}일`} />
                    <VRule />
                    <StatCell label="이번 주" value={formatDuration(stats.data.weekDurationSec)} />
                  </View>
                  <Heatmap daily={heatDaily} />
                  <View style={styles.legend}>
                    <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>적음</Text>
                    {[0, 0.2, 0.4, 0.6, 1].map((level) => (
                      <View
                        key={level}
                        style={[styles.legendCell, { backgroundColor: cellColor(level, colors) }]}
                      />
                    ))}
                    <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>많음</Text>
                  </View>
                  <View style={{ marginTop: spacing.sm }}>
                    <Rule />
                    <KeyValue label="총 독서시간" value={formatDuration(stats.data.totalDurationSec)} />
                    <Rule />
                    <KeyValue label="오늘" value={formatDuration(stats.data.todayDurationSec)} />
                    <Rule />
                    <KeyValue
                      label="기록한 날"
                      value={`${heatDaily.filter((d) => d.sessionCount > 0).length}일 / ${heatDaily.length}일`}
                    />
                  </View>
                </>
              ) : (
                <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
                  통계를 불러오지 못했습니다.
                </Text>
              )}
            </Card>
          </View>
        )}

        <View style={[styles.block, styles.settings]}>
          <Rule />
          <Eyebrow>설정</Eyebrow>

          <View>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>재촉 톤</Text>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
              같은 상황이라도 어떻게 말을 걸지 고를 수 있습니다.
            </Text>
            <View style={[styles.toneList, { borderColor: colors.line }]}>
              {TONES.map((tone) => {
                const selected = user?.notifyTone === tone.value;
                return (
                  <Pressable
                    key={tone.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.toneRow,
                      {
                        borderBottomColor: colors.line,
                        backgroundColor: selected ? colors.accentSoft : colors.surface,
                      },
                    ]}
                    onPress={() => updateSettings.mutate({ notifyTone: tone.value })}
                  >
                    <View
                      style={[
                        styles.radio,
                        selected
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { borderColor: colors.textFaint },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.label, { color: colors.text }]}>{tone.label}</Text>
                      <Text style={[typeScale.caption, styles.toneSample, { color: colors.textMuted }]}>
                        {tone.sample}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Card>
            <Eyebrow>알림</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue
                label="조용 시간"
                value={`${user?.quietHoursStart ?? 22}:00 – ${user?.quietHoursEnd ?? 8}:00`}
              />
              <Rule />
              <KeyValue
                label="하루 최대"
                value={`개인 ${user?.dailyNotifyCap ?? 2}건 · 모임 ${user?.clubNotifyCap ?? 3}건`}
              />
              <Rule />
              <View style={styles.switchRow}>
                <Toggle
                  label="찌르기 받기"
                  description="모임원이 프리셋 문구로 보내는 가벼운 재촉입니다."
                  value={user?.allowNudge ?? true}
                  onChange={(value) => updateSettings.mutate({ allowNudge: value })}
                />
              </View>
            </View>
          </Card>

          <Card>
            <Eyebrow>화면 테마</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <Segmented options={THEMES} value={preference} onChange={setPreference} />
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
              시스템은 기기 설정을 따릅니다.
            </Text>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <Rule />
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>API {API_BASE_URL}</Text>
            <Button
              label="로그아웃"
              variant="ghost"
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
            />
          </View>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

/**
 * 선반 한 칸 — 표지 + 진행 트랙 + 제목 + 상태.
 * 표지와 아래 활자는 같은 index·entranceKey 로 입장 진행값을 공유해 한 조각처럼 앉는다.
 */
function ShelfItem({ record, index, onPress }: {
  record: ReadingRecord;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const offsetY = rowOffsetY[index % rowOffsetY.length];
  const entranceKey = `me-shelf:${record.book?.id ?? record.id}`;
  const progress = useCoverEntrance(index, entranceKey);
  const metaStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const title = record.book?.title ?? '제목 없음';
  const state = statusLabel[record.status] ?? record.status;
  const reading = record.status === 'READING';
  const rate = Math.max(0, Math.min(1, record.progress?.completionRate ?? 0));

  return (
    <View style={styles.shelfItem}>
      <TiltCover
        uri={record.book?.coverUrl}
        title={title}
        width={SHELF_COVER_W}
        index={index}
        tilt={tiltFor(index)}
        offsetY={offsetY}
        entranceKey={entranceKey}
        onPress={onPress}
        accessibilityLabel={`${title}, ${state}`}
      />

      {/* 표지가 내려간 만큼 아래 활자도 같이 내린다. 표지 버튼이 제목·상태를 이미 읽어 주므로
          여기는 접근성 트리에서 감춘다. */}
      <Animated.View
        style={[styles.shelfMeta, offsetY ? { transform: [{ translateY: offsetY }] } : null, metaStyle]}
        aria-hidden
      >
        {reading ? (
          <View style={[styles.shelfTrack, { backgroundColor: colors.line }]}>
            <View
              style={[styles.shelfFill, { width: `${Math.round(rate * 100)}%`, backgroundColor: colors.accent }]}
            />
          </View>
        ) : null}
        <Text numberOfLines={2} style={[typeScale.caption, styles.shelfItemTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typeScale.monoLabel, styles.shelfState, { color: colors.textFaint }]}>{state}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * 올해 읽은 시간 — 통계 응답의 일별 기록을 월 버킷으로 접어 막대로 세운다.
 * 서버가 기간을 줄여 내려줘도(예: 90일) 응답에 실제로 담긴 개월만 그린다.
 */
function YearChart({ daily, loading }: { daily: DailyStat[]; loading?: boolean }) {
  const { colors } = useTheme();
  const months = bucketByMonth(daily);

  const totalSec = months.reduce((sum, m) => sum + m.durationSec, 0);
  const max = Math.max(1, ...months.map((m) => m.durationSec));
  const last = months[months.length - 1];
  const best = months.reduce(
    (top, m) => (m.durationSec > top.durationSec ? m : top),
    months[0] ?? { key: '', month: 0, durationSec: 0 },
  );

  // 이번 달이 구간 최저면 회복을 권한다. 아니면 가장 길었던 달을 짚어 준다.
  const lastIsLowest = last != null && months.length >= 2 && months.every((m) => m.durationSec >= last.durationSec);
  const caption = last == null
    ? null
    : lastIsLowest
      ? `${last.month}월은 아직 ${Math.floor(last.durationSec / 60)}분입니다. 회복 가능합니다.`
      : `가장 길었던 달은 ${best.month}월, ${Math.round(best.durationSec / 3600)}시간입니다.`;

  const a11y = months.length
    ? `월별 독서 시간. ${months.map((m) => `${m.month}월 ${formatDuration(m.durationSec)}`).join(', ')}`
    : '월별 독서 시간 기록이 없습니다.';

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>올해 읽은 시간</Text>
        <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
          {Math.round(totalSec / 3600)}시간
        </Text>
      </View>

      {loading || months.length === 0 ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          {loading ? '기록을 세는 중입니다.' : '아직 쌓인 기록이 없습니다.'}
        </Text>
      ) : (
        <>
          <View accessible accessibilityLabel={a11y} style={styles.chartRow}>
            {months.map((m) => (
              <View key={m.key} style={styles.chartCol}>
                <View style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        // 값이 0인 달도 바닥 선으로 남긴다 — 빈 달이 사라지면 리듬이 끊긴다.
                        height: Math.max(2, Math.round((m.durationSec / max) * CHART_H)),
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={[typeScale.monoLabel, styles.barLabel, { color: colors.textFaint }]}>
                  {m.month}월
                </Text>
              </View>
            ))}
          </View>
          {caption ? (
            <Text style={[typeScale.monoLabel, styles.chartCaption, { color: colors.textFaint }]}>
              {caption}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

type MonthBucket = { key: string; month: number; durationSec: number };

/** 일별 기록을 'YYYY-MM' 버킷으로 합산한다. 최근 6개월까지만 남긴다. */
function bucketByMonth(daily: DailyStat[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  for (const day of daily) {
    const key = day.date.slice(0, 7);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.durationSec += day.durationSec;
    } else {
      buckets.set(key, { key, month: Number(key.slice(5, 7)), durationSec: day.durationSec });
    }
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
}

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[typeScale.monoNumeral, styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function VRule() {
  const { colors } = useTheme();
  return <View style={[styles.vRule, { backgroundColor: colors.line }]} />;
}

/** 주 단위 열로 쌓는 히트맵 — 램프는 테마 악센트 파생 4단계. */
function Heatmap({ daily }: { daily: { date: string; durationSec: number }[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...daily.map((d) => d.durationSec));
  const weeks: { date: string; durationSec: number }[][] = [];
  let current: { date: string; durationSec: number }[] = [];

  daily.forEach((day, index) => {
    const weekday = new Date(day.date).getDay();
    if (index === 0) {
      for (let i = 0; i < weekday; i++) {
        current.push({ date: '', durationSec: -1 });
      }
    }
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  });
  if (current.length > 0) {
    weeks.push(current);
  }

  return (
    <View style={styles.heatmap}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.heatWeek}>
          {week.map((day, dayIndex) => (
            <View
              key={`${weekIndex}-${dayIndex}`}
              style={[
                styles.heatCell,
                day.durationSec < 0
                  ? { backgroundColor: 'transparent' }
                  : { backgroundColor: cellColor(day.durationSec / max, colors) },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function cellColor(ratio: number, colors: ColorTokens): string {
  if (ratio <= 0) return colors.line;
  if (ratio < 0.25) return `${colors.accent}40`;
  if (ratio < 0.5) return `${colors.accent}80`;
  if (ratio < 0.75) return `${colors.accent}BF`;
  return colors.accent;
}

const styles = StyleSheet.create({
  container: { ...layout.content, gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  block: { paddingHorizontal: spacing.lg },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { ...typeScale.titleSerif, fontSize: 22, lineHeight: 28 },
  profileText: { flex: 1, gap: 4 },
  // 시안의 프로필 표제는 히어로보다 작다 — displaySerif 를 21로 줄여 쓴다.
  nickname: { ...typeScale.displaySerif, fontSize: 21, lineHeight: 28 },
  profileMeta: { letterSpacing: 0.4 },

  shelfSection: { gap: spacing.sm },
  shelfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  shelfTitle: { fontSize: 18, lineHeight: 26 },
  // 지그재그로 내려간 표지와 그 아래 활자가 잘리지 않게 아래 여백을 크게 둔다.
  shelfList: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  shelfItem: { width: SHELF_COVER_W },
  shelfMeta: { marginTop: spacing.sm, gap: spacing.xs },
  shelfTrack: { height: 2, width: '100%', overflow: 'hidden' },
  shelfFill: { height: 2 },
  shelfItemTitle: { ...typeScale.bodyStrong, fontSize: 11.5, lineHeight: 16 },
  shelfState: { fontSize: 9, letterSpacing: 0.6 },
  shelfSkeleton: {
    width: SHELF_COVER_W,
    height: Math.round(SHELF_COVER_W * 1.5),
    borderRadius: radius.sm,
  },
  shelfGhost: {
    width: SHELF_COVER_W,
    height: Math.round(SHELF_COVER_W * 1.5),
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  // 책상에 비스듬히 놓인 종이 한 장 — 기울기는 아주 얕게만 준다.
  chartCard: { gap: spacing.md, transform: [{ rotate: '-0.6deg' }] },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chartTitle: { ...typeScale.titleSerif, fontSize: 16, lineHeight: 22 },
  chartRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  barSlot: { height: CHART_H, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', opacity: 0.85 },
  barLabel: { fontSize: 9, letterSpacing: 0.4 },
  chartCaption: { fontSize: 9, letterSpacing: 0.4, lineHeight: 14 },

  statRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.md },
  statCell: { flex: 1, gap: 3 },
  statValue: { fontSize: 18 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  heatmap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginTop: spacing.md },
  heatWeek: { gap: 3 },
  heatCell: { width: 11, height: 11, borderRadius: radius.sm },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  legendCell: { width: 11, height: 11, borderRadius: radius.sm },

  settings: { gap: spacing.lg },
  toneList: { marginTop: spacing.sm, borderWidth: hairline, borderRadius: radius.md, overflow: 'hidden' },
  toneRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'flex-start',
    borderBottomWidth: hairline,
  },
  radio: { width: 16, height: 16, borderRadius: radius.pill, borderWidth: hairline, marginTop: 2 },
  toneSample: { marginTop: 3, lineHeight: 16 },
  switchRow: { paddingVertical: spacing.sm },
});
