import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { Button, Card, Eyebrow, FootAction, Segmented, linkLabel } from '@/components/ui';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { LegalDocumentSheet } from '@/components/legal/LegalDocumentSheet';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useAuth } from '@/store/auth';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

type Gender = 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: '남성' },
  { value: 'FEMALE', label: '여성' },
  { value: 'PREFER_NOT_TO_SAY', label: '선택하고 싶지 않음' },
];

function normalizeBirthDate(value: string): string | null {
  const trimmed = value.trim();
  const dashed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : /^\d{8}$/.test(trimmed)
      ? `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
      : null;
  if (!dashed) return null;
  const [year, month, day] = dashed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return dashed;
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const savedGender = (user?.gender as Gender | undefined) ?? 'PREFER_NOT_TO_SAY';
  const savedBirthDate = user?.birthDate ?? '';
  const [gender, setGender] = useState<Gender>(savedGender);
  const [birthDate, setBirthDate] = useState(savedBirthDate);
  const [error, setError] = useState<string | null>(null);
  const [optionalDocOpen, setOptionalDocOpen] = useState(false);
  const clearConfirm = useDeleteConfirm<'optional'>();

  // 성별·생년월일은 [선택] 정보 — 바꿔서 저장하려면 선택 동의가 있어야 한다(서버가 CONSENT_REQUIRED 로 막는다).
  const optionalAgreed = user?.consents?.some((c) => c.kind === 'PROFILE_OPTIONAL' && c.agreed) ?? false;
  const genderChanged = gender !== savedGender;
  const birthDateChanged = birthDate.trim() !== savedBirthDate;
  const needsOptionalConsent = (genderChanged || (birthDateChanged && birthDate.trim().length > 0)) && !optionalAgreed;
  const hasOptional = user?.gender != null || user?.birthDate != null;

  const save = useMutation({
    mutationFn: async () => {
      const birthDateText = birthDate.trim();
      const normalizedBirthDate = birthDateText ? normalizeBirthDate(birthDateText) : '';
      if (birthDateText && !normalizedBirthDate) {
        throw new Error('생년월일을 19950101처럼 숫자 8자리로 적어 주세요.');
      }
      if (needsOptionalConsent) {
        await authApi.setConsent('PROFILE_OPTIONAL', true);
      }
      // 바뀐 값만 보낸다 — 그대로인 성별·생년월일을 다시 보내 동의를 요구받지 않게.
      return authApi.updateProfile({
        nickname: nickname.trim(),
        gender: genderChanged ? gender : undefined,
        birthDate: birthDateChanged ? normalizedBirthDate || undefined : undefined,
      });
    },
    onSuccess: (me) => {
      setUser(me);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', me.id] });
      router.back();
    },
    onError: (e) => setError(e instanceof ApiError || e instanceof Error ? e.message : '프로필을 저장하지 못했어요.'),
  });

  /** 선택 동의 철회 — 서버가 성별·생년월일을 지운다. 되돌리려면 다시 넣으면 된다. */
  const clearOptional = useMutation({
    mutationFn: () => authApi.setConsent('PROFILE_OPTIONAL', false),
    onSuccess: (me) => {
      setUser(me);
      setGender('PREFER_NOT_TO_SAY');
      setBirthDate('');
      clearConfirm.disarm();
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '선택 정보를 지우지 못했어요.'),
  });

  const canSave = nickname.trim().length > 0 && (
    nickname.trim() !== (user?.nickname ?? '')
    || genderChanged
    || birthDateChanged
  );

  return (
    <PaperScreen>
      <SubHeader category="프로필 편집" onBack={() => router.back()} />
      <KeyboardArea>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* 사진은 여기서 바꾸지 않는다 — '나' 화면의 아바타를 누르는 길 하나로 모았다. */}
        <View style={styles.block}>
          <Card>
            <Eyebrow>닉네임</Eyebrow>
            <TextInput
              value={nickname}
              onChangeText={(value) => {
                setNickname(value);
                setError(null);
              }}
              maxLength={50}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="닉네임"
              style={[
                styles.input,
                { borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text },
              ]}
            />
            <Text style={[typeScale.caption, styles.counter, { color: colors.textFaint }]}>
              닉네임 {nickname.trim().length}/50
            </Text>
            {error ? (
              <Text style={[typeScale.caption, styles.error, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Eyebrow>선택 정보</Eyebrow>
            <View style={styles.optionalNote}>
              <Text style={[typeScale.caption, styles.optionalCopy, { color: colors.textMuted }]}>
                {optionalAgreed
                  ? '맞춤 추천과 또래 독서 통계에만 써요.'
                  : '[선택] 바꿔서 저장하면 맞춤 추천·또래 독서 통계에 쓰는 데 동의하게 돼요.'}
              </Text>
              <Pressable
                onPress={() => setOptionalDocOpen(true)}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={({ pressed }) => pressed && pressedStyle}
              >
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>{linkLabel('자세히')}</Text>
              </Pressable>
            </View>
            <View style={styles.field}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>성별</Text>
              <Segmented options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </View>
            <View style={styles.field}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>생년월일</Text>
              <BirthDatePicker
                value={birthDate}
                onChange={(value) => {
                  setBirthDate(value);
                  setError(null);
                }}
              />
            </View>
            {/* 지우기(동의 철회)는 저장 버튼과 떨어진 카드 발치에, 두 번 눌러야 지운다. */}
            {hasOptional ? (
              <View style={styles.clearRow}>
                <FootAction
                  label={clearConfirm.confirm ? '한 번 더' : '성별·생년월일 지우기'}
                  tone={clearConfirm.confirm ? 'danger' : 'faint'}
                  disabled={clearOptional.isPending}
                  onPress={() => (clearConfirm.confirm ? clearOptional.mutate() : clearConfirm.arm('optional'))}
                />
              </View>
            ) : null}
          </Card>
        </View>
      </ScrollView>

      {/* 하단 띠 — 다른 쓰기 화면과 같은 자리라 닉네임을 적는 동안에도 키보드 위에 붙어 엄지가 닿는다(UX 철칙 Fitts). */}
      <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
        <Button
          label={needsOptionalConsent ? '동의하고 저장' : '저장'}
          disabled={!canSave || save.isPending}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </KeyboardDock>
      </KeyboardArea>
      <LegalDocumentSheet
        docKey={optionalDocOpen ? 'profile-optional' : null}
        colors={colors}
        onClose={() => setOptionalDocOpen(false)}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    fontSize: 16,
  },
  bottomBar: {
    ...layout.content,
    width: '100%',
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  counter: { marginTop: spacing.xs, textAlign: 'right' },
  optionalNote: { marginTop: spacing.sm, gap: spacing.xs },
  optionalCopy: { lineHeight: 18 },
  clearRow: { flexDirection: 'row', marginTop: spacing.md },
  error: { marginTop: spacing.sm, lineHeight: 18 },
});
