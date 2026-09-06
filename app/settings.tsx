import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { notificationApi } from '@/api/endpoints';
import type { NotifyTone } from '@/api/types';
import { BrandHeader, PaperScreen, SectionNav } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Segmented, Toggle,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import type { ThemePreference } from '@/store/themePreference';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

const TONES: { value: NotifyTone; label: string; sample: string }[] = [
  { value: 'GENTLE', label: '다정', sample: '12쪽 남았어요. 오늘 10분이면 끝나요.' },
  { value: 'FACT', label: '팩트', sample: '5일 미독. 완독 예상일이 9/12 -> 10/3으로 밀립니다.' },
  { value: 'SPARTA', label: '스파르타', sample: '5일째 안 읽음. 책이 당신을 노려보고 있습니다.' },
  { value: 'TSUNDERE', label: '츤데레', sample: '뭐, 안 읽어도 상관없는데. 남은 12쪽이 좀 불쌍하긴 하네.' },
  { value: 'SILENT', label: '무음', sample: '푸시 없이 인앱 배지로만 알립니다.' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);

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
    <PaperScreen withTopInset>
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.block, styles.settings]}>
          <Rule />
          <Eyebrow>설정</Eyebrow>

          <View>
            <Eyebrow plain>재촉 톤</Eyebrow>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
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
            <Eyebrow plain>알림</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue
                label="조용 시간"
                value={`${user?.quietHoursStart ?? 22}:00 - ${user?.quietHoursEnd ?? 8}:00`}
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
            <Eyebrow plain>화면 테마</Eyebrow>
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
      <SectionNav active="settings" />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, gap: spacing.xl, paddingBottom: 104, paddingTop: spacing.lg },
  block: { paddingHorizontal: spacing.lg },
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
