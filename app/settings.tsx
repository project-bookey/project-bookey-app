import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { authApi, notificationApi } from '@/api/endpoints';
import type { NotifyTone } from '@/api/types';
import { confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Segmented, Toggle,
} from '@/components/ui';
import { useSocialTokens, type SocialProvider } from '@/hooks/useSocialTokens';
import { openLegal } from '@/legal/links';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import { useAppTour } from '@/store/appTour';
import type { ThemePreference } from '@/store/themePreference';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

const TONES: { value: NotifyTone; label: string; sample: string }[] = [
  { value: 'GENTLE', label: '다정', sample: '『책 제목』 12쪽 남았어요. 오늘 10분이면 한 걸음 나아가요.' },
  { value: 'FACT', label: '팩트', sample: '5일째 읽지 않음. 이 속도면 완독 예상일 9/12 → 10/3.' },
  { value: 'SPARTA', label: '스파르타', sample: '5일째 안 읽음. 책이 당신을 노려보고 있습니다.' },
  { value: 'TSUNDERE', label: '츤데레', sample: '뭐, 안 읽어도 상관없는데. 남은 12쪽이 좀 불쌍하긴 하네.' },
  { value: 'SILENT', label: '무음', sample: '휴대폰 알림 없이 앱 안에서만 알려요.' },
];

/** 연동할 수 있는 소셜 계정 — 로그인 화면의 버튼과 같은 순서. */
const SOCIAL_PROVIDERS: { value: SocialProvider; label: string }[] = [
  { value: 'APPLE', label: 'Apple' },
  { value: 'KAKAO', label: '카카오' },
  { value: 'GOOGLE', label: 'Google' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '기기 설정' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
];

/** 광고성 정보 수신 동의를 마지막으로 바꾼 날 — '2026년 10월 4일'. 처리 결과 안내(정보통신망법 제50조 ⑧)에 쓴다. */
function consentDate(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

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

  // 로그아웃·계정 삭제 뒤 — 이전 계정의 캐시(서재·지갑·통계 등)를 비워 다음에 로그인하는 사람에게 보이지 않게 하고,
  // 메인 탭까지 걷어 내 로그인만 남긴다(밑에 남겨 두면 다음 로그인 때 메인 탭이 한 벌 더 쌓인다).
  const leaveToLogin = () => {
    queryClient.clear();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
  };

  const marketing = user?.consents?.find((c) => c.kind === 'MARKETING');
  const setMarketing = useMutation({
    mutationFn: (agreed: boolean) => authApi.setConsent('MARKETING', agreed),
    // 처리 결과는 토글 아래 줄(보낸 곳·일자)과 서버가 남기는 알림(CONSENT_RESULT)으로 알린다 — 대화상자는 띄우지 않는다.
    onSuccess: (me) => {
      setUser(me);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => notify('바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

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
            <Eyebrow>알림 말투</Eyebrow>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
              같은 알림도 어떤 말투로 받을지 고를 수 있어요.
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
                label="방해 금지 시간"
                value={`${user?.quietHoursStart ?? 22}:00 - ${user?.quietHoursEnd ?? 8}:00`}
              />
              <Rule />
              <KeyValue
                label="하루에 받는 알림"
                value={`내 독서 ${user?.dailyNotifyCap ?? 2}건 · 클럽 ${user?.clubNotifyCap ?? 3}건`}
              />
              <Rule />
              <View style={styles.switchRow}>
                <Toggle
                  label="찌르기 받기"
                  description="클럽 멤버가 정해진 문구로 보내는 가벼운 재촉이에요."
                  value={user?.allowNudge ?? true}
                  onChange={(value) => updateSettings.mutate({ allowNudge: value })}
                />
              </View>
              <Rule />
              {/* [선택] 광고성 정보 수신 — 바꿀 때마다 처리 결과(보낸 곳·일자)를 알린다. 마지막 처리 일자는 아래 줄에 남는다. */}
              <View style={styles.switchRow}>
                <Toggle
                  label="혜택·이벤트 소식 받기"
                  description="광고성 정보를 앱 알림과 이메일로 받아요. 밤 9시부터 아침 8시까지는 보내지 않아요."
                  value={marketing?.agreed ?? false}
                  onChange={(value) => {
                    if (!setMarketing.isPending) setMarketing.mutate(value);
                  }}
                />
                {marketing ? (
                  <Text style={[typeScale.caption, styles.consentNote, { color: colors.textFaint }]}>
                    Bookey · {consentDate(marketing.at)} {marketing.agreed ? '수신 동의' : '수신 동의 철회'}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>

          <Card>
            <Eyebrow>화면 테마</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <Segmented options={THEMES} value={preference} onChange={setPreference} />
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
              기기 설정을 고르면 휴대폰의 화면 모드를 따라가요.
            </Text>
          </Card>

          <SocialLinkCard />

          {/* 도움말·약관 묶음과 계정 묶음(로그아웃·삭제)은 xl 로 갈라 놓는다 — 파괴적 동작을 오터치하지 않게. */}
          <View style={styles.footer}>
            <View style={styles.links}>
              <Rule />
              {/* 둘러보기는 메인 탭 위에서만 뜬다 — 새로 쌓지 않고 왔던 '나' 화면으로 돌아가 그 자리에서 시작한다. */}
              <Button
                label="앱 사용법 다시 보기"
                variant="ghost"
                onPress={() => {
                  startTour();
                  if (router.canGoBack()) router.back();
                  else router.replace('/home');
                }}
              />
              <Button
                label="고객문의"
                variant="ghost"
                onPress={() => router.push('/inquiry')}
              />
              <Button
                label="개인정보처리방침"
                variant="ghost"
                onPress={() => openLegal('privacy')}
              />
              <Button
                label="이용약관"
                variant="ghost"
                onPress={() => openLegal('terms')}
              />
              <Button
                label="환불 정책"
                variant="ghost"
                onPress={() => openLegal('refund')}
              />
              {/* 문의는 위 '고객문의'로 받는다 — 여기는 웹 안내문의 계정 삭제 절만 연다. */}
              <Button
                label="계정 삭제 안내"
                variant="ghost"
                onPress={() => openLegal('deletion')}
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
                  leaveToLogin();
                }}
              />
              <Button
                label="계정 영구 삭제"
                variant="danger"
                // 되돌릴 수 없는 계정 단위 동작은 확인 창으로 묻는다(클럽 나가기·종료와 같은 규칙).
                // Alert.alert 는 웹에서 버튼 대화상자를 띄우지 못해 웹에선 아무 일도 없었다 — confirmAsync 로 맞춘다.
                onPress={async () => {
                  const ok = await confirmAsync(
                    '계정을 삭제할까요? 프로필과 로그인 정보가 모두 지워지고 되살릴 수 없어요. 스토어에서 결제한 구독은 따로 해지해 주세요.',
                    '영구 삭제',
                  );
                  if (!ok) return;
                  try {
                    await deleteAccount();
                    leaveToLogin();
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

/**
 * 소셜 로그인 연동 — 연동하지 않은 소셜 계정으로 로그인하면 서버가 별도 계정을 새로 만든다(이메일이 같으면 막는다).
 * 이메일로 가입한 사람이 여기서 연동해 두면 다음부터 같은 계정에 Apple·카카오·Google 로 로그인할 수 있다.
 * 연동 상태는 내 정보(linkedProviders·hasPassword)를 따른다.
 */
function SocialLinkCard() {
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const { getToken, appleAvailable } = useSocialTokens();
  // 아직 새 필드를 주지 않는 서버(배포 전)와 붙어도 깨지지 않게 — 없으면 연동 없음으로 본다.
  const linked = user?.linkedProviders ?? [];
  // 비밀번호 없는(소셜로 가입한) 계정의 마지막 연동은 지우면 다시 로그인할 길이 없다 — 서버도 LAST_LOGIN_METHOD 로 막는다.
  const lastLoginMethod = user?.hasPassword === false && linked.length === 1;

  const link = useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const token = await getToken(provider);
      // 사용자가 공급자 창을 닫았으면 아무것도 하지 않는다.
      return token ? authApi.linkSocial(provider, token) : null;
    },
    onSuccess: (me) => {
      if (me) setUser(me);
    },
  });
  // 해제는 언제든 다시 연동할 수 있어 확인 창 없이 바로 한다.
  const unlink = useMutation({
    mutationFn: (provider: SocialProvider) => authApi.unlinkSocial(provider),
    onSuccess: setUser,
  });
  const busy = link.isPending || unlink.isPending;
  const failure = link.isError && !link.isPending ? link.error : unlink.isError && !unlink.isPending ? unlink.error : null;
  const error = failure
    ? failure instanceof Error ? failure.message : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
    : null;
  // 애플은 iOS에서 쓸 수 있을 때만 보인다(로그인 화면과 같은 기준). 이미 연동된 애플은 해제할 수 있게 늘 보인다.
  const providers = SOCIAL_PROVIDERS.filter(
    (p) => p.value !== 'APPLE' || appleAvailable || linked.includes('APPLE'),
  );

  return (
    <Card>
      <Eyebrow>소셜 로그인 연동</Eyebrow>
      <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
        연동해 두면 다음부터 Apple·카카오·Google 계정으로도 로그인할 수 있어요.
      </Text>
      <View style={styles.linkList}>
        {providers.map((provider, index) => {
          const isLinked = linked.includes(provider.value);
          return (
            <View key={provider.value}>
              {index > 0 ? <Rule /> : null}
              <View style={styles.linkRow}>
                <Text style={[typeScale.label, { color: colors.text, flex: 1 }]}>{provider.label}</Text>
                {isLinked ? (
                  <>
                    <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>연동됨</Text>
                    <Button
                      label="해제"
                      size="sm"
                      variant="outline"
                      loading={unlink.isPending && unlink.variables === provider.value}
                      disabled={busy || lastLoginMethod}
                      onPress={() => unlink.mutate(provider.value)}
                    />
                  </>
                ) : (
                  <Button
                    label="연동"
                    size="sm"
                    variant="outline"
                    loading={link.isPending && link.variables === provider.value}
                    disabled={busy}
                    onPress={() => link.mutate(provider.value)}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      {lastLoginMethod ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          소셜로 가입한 계정이라 마지막 연동은 해제할 수 없어요. 다른 소셜 계정을 먼저 연동해 주세요.
        </Text>
      ) : null}
      {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
    </Card>
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
  consentNote: { marginTop: spacing.xs },
  linkList: { marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs },
  footer: { gap: spacing.xl },
  links: { gap: spacing.sm },
  account: { gap: spacing.md },
});
