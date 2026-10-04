import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow, Segmented } from '@/components/ui';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

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
  const [gender, setGender] = useState<Gender>((user?.gender as Gender | undefined) ?? 'PREFER_NOT_TO_SAY');
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const birthDateText = birthDate.trim();
      const normalizedBirthDate = birthDateText ? normalizeBirthDate(birthDateText) : '';
      if (birthDateText && !normalizedBirthDate) {
        throw new Error('생년월일을 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.');
      }
      return authApi.updateProfile({
        nickname: nickname.trim(),
        gender,
        birthDate: normalizedBirthDate || undefined,
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

  const canSave = nickname.trim().length > 0 && (
    nickname.trim() !== (user?.nickname ?? '')
    || gender !== ((user?.gender as Gender | undefined) ?? 'PREFER_NOT_TO_SAY')
    || birthDate.trim() !== (user?.birthDate ?? '')
  );

  return (
    <PaperScreen>
      <SubHeader category="프로필 편집" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
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
            <Eyebrow>기본 정보</Eyebrow>
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
          </Card>

          <View style={styles.footer}>
            <Button
              label="저장"
              size="sm"
              disabled={!canSave || save.isPending}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        </View>
      </ScrollView>
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
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  counter: { marginTop: spacing.xs, textAlign: 'right' },
  error: { marginTop: spacing.sm, lineHeight: 18 },
});
