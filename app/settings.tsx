import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { notificationApi } from '@/api/endpoints';
import type { NotifyTone } from '@/api/types';
import { confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Segmented, Toggle,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import { useAppTour } from '@/store/appTour';
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

const LEGAL_URL = 'https://api.bookey.site/legal/index.html';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);
  const startTour = useAppTour((s) => s.start);

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
      <SubHeader category="설정" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.block, styles.settings]}>
          <View>
            <Eyebrow>재촉 톤</Eyebrow>
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
                        backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                        borderLeftColor: selected ? colors.ink : 'transparent',
                      },
                    ]}
                    onPress={() => updateSettings.mutate({ notifyTone: tone.value })}
                  >
                    <View
                      style={[
                        styles.radio,
                        selected
                          ? { backgroundColor: colors.ink, borderColor: colors.ink }
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
                value={`${user?.quietHoursStart ?? 22}:00 - ${user?.quietHoursEnd ?? 8}:00`}
              />
              <Rule />
              <KeyValue
                label="하루 최대"
                value={`개인 ${user?.dailyNotifyCap ?? 2}건 · 클럽 ${user?.clubNotifyCap ?? 3}건`}
              />
              <Rule />
              <View style={styles.switchRow}>
                <Toggle
                  label="찌르기 받기"
                  description="클럽원이 프리셋 문구로 보내는 가벼운 재촉입니다."
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

          {/* 도움말·약관 묶음과 계정 묶음(로그아웃·삭제)은 xl 로 갈라 놓는다 — 파괴적 동작을 오터치하지 않게. */}
          <View style={styles.footer}>
            <View style={styles.links}>
              <Rule />
              <Button
                label="앱 사용법 다시 보기"
                variant="ghost"
                onPress={startTour}
              />
              <Button
                label="개인정보처리방침"
                variant="ghost"
                onPress={() => void Linking.openURL(`${LEGAL_URL}#privacy`)}
              />
              <Button
                label="이용약관"
                variant="ghost"
                onPress={() => void Linking.openURL(`${LEGAL_URL}#terms`)}
              />
              <Button
                label="고객지원 · 계정 삭제 안내"
                variant="ghost"
                onPress={() => void Linking.openURL(`${LEGAL_URL}#deletion`)}
              />
              {/* 접속 서버 확인용 — 개발 빌드에서만 보인다. */}
              {__DEV__ ? (
                <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>API {API_BASE_URL}</Text>
              ) : null}
            </View>
            <View style={styles.account}>
              <Button
                label="로그아웃"
                variant="ghost"
                onPress={async () => {
                  await logout();
                  router.replace('/login');
                }}
              />
              <Button
                label="계정 영구 삭제"
                variant="danger"
                // 되돌릴 수 없는 계정 단위 동작은 확인 창으로 묻는다(클럽 나가기·종료와 같은 규칙).
                // Alert.alert 는 웹에서 버튼 대화상자를 띄우지 못해 웹에선 아무 일도 없었다 — confirmAsync 로 맞춘다.
                onPress={async () => {
                  const ok = await confirmAsync(
                    '계정을 삭제할까요? 프로필과 로그인 정보가 영구 삭제되며 복구할 수 없습니다. 스토어 구독은 별도로 취소해야 합니다.',
                    '영구 삭제',
                  );
                  if (!ok) return;
                  try {
                    await deleteAccount();
                    queryClient.clear();
                    router.replace('/login');
                  } catch {
                    notify('계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
                  }
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  block: { paddingHorizontal: spacing.lg },
  settings: { gap: spacing.lg },
  toneList: { marginTop: spacing.sm, borderWidth: hairline, borderRadius: radius.md, overflow: 'hidden' },
  // 선택된 행은 잉크 띠 2px 로 짚는다 — 띠는 항상 자리를 차지해 선택이 바뀌어도 글이 흔들리지 않는다.
  toneRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'flex-start',
    borderBottomWidth: hairline,
    borderLeftWidth: 2,
  },
  radio: { width: 16, height: 16, borderRadius: radius.round, borderWidth: hairline, marginTop: 2 },
  toneSample: { marginTop: 3, lineHeight: 16 },
  switchRow: { paddingVertical: spacing.sm },
  footer: { gap: spacing.xl },
  links: { gap: spacing.sm },
  account: { gap: spacing.md },
});
