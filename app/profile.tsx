import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { libraryApi, notificationApi, statsApi } from '@/api/endpoints';
import type { NotifyTone } from '@/api/types';
import { PaperScreen, SectionNav } from '@/components/collage';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import type { ThemePreference } from '@/store/themePreference';
import type { ColorTokens } from '@/theme';
import { hairline, layout, ornament, radius, spacing, type, useTheme } from '@/theme';

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

/**
 * 탭 5. 프로필 — 알림 톤 · 설정 (§6).
 * 테마 인식 전환 완료 — 레거시 colors 미사용. 다크 외관은 전환 전과 픽셀 동일해야 한다
 * (수동 테마 전환 스펙). 프리미티브는 ui.tsx(다크 고정) 대신 아래 로컬 버전을 쓴다.
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
  const stats = useQuery({ queryKey: ['stats', 90], queryFn: () => statsApi.summary(90) });

  const updateSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => notificationApi.updateSettings(body),
    onSuccess: (_, body) => {
      if (user) {
        setUser({ ...user, ...(body as object) } as typeof user);
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <PaperScreen>
      <SectionNav active="me" />
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={[type.display, { color: colors.text }]}>{user?.nickname}</Text>
          <Text style={[type.caption, { color: colors.textFaint, marginTop: 2 }]}>@{user?.handle}</Text>
        </View>

        <Card>
          <Eyebrow>내 서재</Eyebrow>
          <View style={styles.counts}>
            <CountCell label="읽는 중" value={summary.data?.reading ?? 0} />
            <CountCell label="완독" value={summary.data?.finished ?? 0} />
            <CountCell label="읽고 싶은" value={summary.data?.wantToRead ?? 0} />
            <CountCell label="하차" value={summary.data?.abandoned ?? 0} />
          </View>
        </Card>

        {stats.isLoading ? null : (
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
                <Heatmap daily={stats.data.daily} />
                <View style={styles.legend}>
                  <Text style={[type.caption, { color: colors.textFaint }]}>적음</Text>
                  {[0, 0.2, 0.4, 0.6, 1].map((level) => (
                    <View
                      key={level}
                      style={[styles.legendCell, { backgroundColor: cellColor(level, colors) }]}
                    />
                  ))}
                  <Text style={[type.caption, { color: colors.textFaint }]}>많음</Text>
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <Rule />
                  <KeyValue label="총 독서시간" value={formatDuration(stats.data.totalDurationSec)} />
                  <Rule />
                  <KeyValue label="오늘" value={formatDuration(stats.data.todayDurationSec)} />
                  <Rule />
                  <KeyValue
                    label="기록한 날"
                    value={`${stats.data.daily.filter((d) => d.sessionCount > 0).length}일 / 90일`}
                  />
                </View>
              </>
            ) : (
              <Text style={[type.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
                통계를 불러오지 못했습니다.
              </Text>
            )}
          </Card>
        )}

        <View>
          <Eyebrow>재촉 톤</Eyebrow>
          <Text style={[type.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
            같은 상황이라도 어떻게 말을 걸지 고를 수 있습니다.
          </Text>
          <View style={[styles.toneList, { borderColor: colors.line }]}>
            {TONES.map((tone) => {
              const selected = user?.notifyTone === tone.value;
              return (
                <Pressable
                  key={tone.value}
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
                        ? { backgroundColor: colors.text, borderColor: colors.text }
                        : { borderColor: colors.textFaint },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.label, { color: colors.text }]}>{tone.label}</Text>
                    <Text style={[type.caption, styles.toneSample, { color: colors.textMuted }]}>
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
            <KeyValue label="하루 최대" value={`개인 ${user?.dailyNotifyCap ?? 2}건 · 모임 ${user?.clubNotifyCap ?? 3}건`} />
            <Rule />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.label, { color: colors.text }]}>찌르기 받기</Text>
                <Text style={[type.caption, { color: colors.textFaint, marginTop: 2 }]}>
                  모임원이 프리셋 문구로 보내는 가벼운 재촉입니다.
                </Text>
              </View>
              <Toggle
                value={user?.allowNudge ?? true}
                onChange={(value) => updateSettings.mutate({ allowNudge: value })}
              />
            </View>
          </View>
        </Card>

        <Card>
          <Eyebrow>화면 테마</Eyebrow>
          <View style={[styles.themeSegments, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            {THEMES.map((option, index) => {
              const active = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setPreference(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.themeSegment,
                    index > 0 && { borderLeftWidth: hairline, borderLeftColor: colors.line },
                    active && { backgroundColor: colors.text },
                  ]}
                >
                  <Text
                    style={[
                      type.label,
                      styles.themeSegmentLabel,
                      { color: active ? colors.bg : colors.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
            시스템은 기기 설정을 따릅니다.
          </Text>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Rule />
          <Text style={[type.caption, { color: colors.textFaint }]}>API {API_BASE_URL}</Text>
          <GhostButton
            label="로그아웃"
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          />
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.countCell}>
      <Numeral style={{ fontSize: 20, fontWeight: '700' }}>{value}</Numeral>
      <Text style={[type.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      <Numeral style={{ fontSize: 20, fontWeight: '700' }}>{value}</Numeral>
      <Text style={[type.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function VRule() {
  const { colors } = useTheme();
  return <View style={[styles.vRule, { backgroundColor: colors.line }]} />;
}

/** 주 단위 열로 쌓는 각진 히트맵 — 기록 탭에서 이식, 램프는 테마 악센트 파생. */
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

function formatDuration(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분`;
  return `${total}초`;
}

// ── 로컬 프리미티브 — ui.tsx(다크 고정)와 같은 모양의 테마 인식 버전 ──────────

function Card({ children }: { children: ReactNode }) {
  const { colors, cardShadow } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}>
      {children}
    </View>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={[type.eyebrow, { color: colors.textMuted }]}>
      <Text style={{ color: colors.accent, fontSize: 11 }}>{ornament.section} </Text>
      {children}
    </Text>
  );
}

function Rule() {
  const { colors } = useTheme();
  return <View style={[styles.rule, { backgroundColor: colors.line }]} />;
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.keyValue}>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.keyValueValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Numeral({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[styles.numeral, { color: colors.text }, style]}>{children}</Text>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[
        styles.toggleTrack,
        value
          ? { backgroundColor: colors.text, borderColor: colors.text }
          : { backgroundColor: colors.surfaceRaised, borderColor: colors.line },
      ]}
    >
      <View
        style={[
          styles.toggleKnob,
          value
            ? { backgroundColor: colors.bg, alignSelf: 'flex-end' }
            : { backgroundColor: colors.textFaint },
        ]}
      />
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
    >
      <Text style={[type.label, styles.ghostButtonLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  card: { borderWidth: hairline, borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' },
  counts: { flexDirection: 'row', marginTop: spacing.md },
  countCell: { flex: 1, gap: 3 },
  statRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.md },
  statCell: { flex: 1, gap: 3 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  heatmap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginTop: spacing.md },
  heatWeek: { gap: 3 },
  heatCell: { width: 11, height: 11 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  legendCell: { width: 11, height: 11 },
  toneList: { marginTop: spacing.sm, borderWidth: hairline, borderRadius: 12, overflow: 'hidden' },
  toneRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'flex-start',
    borderBottomWidth: hairline,
  },
  radio: { width: 16, height: 16, borderRadius: 999, borderWidth: hairline, marginTop: 2 },
  toneSample: { marginTop: 3, lineHeight: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  themeSegments: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    borderWidth: hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  themeSegment: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  themeSegmentLabel: { fontSize: 12 },
  rule: { height: hairline },
  keyValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.sm,
  },
  keyValueValue: { fontSize: 13, fontWeight: '700' },
  numeral: { fontSize: 13, fontWeight: '700' },
  toggleTrack: {
    width: 46,
    height: 26,
    borderWidth: hairline,
    borderRadius: radius.pill,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: { width: 20, height: 20, borderRadius: radius.pill },
  ghostButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  ghostButtonLabel: { fontSize: 11.5 },
  pressed: { opacity: 0.7 },
});
