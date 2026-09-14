import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { PersonGlyph } from '@/components/quote/QuoteCard';
import { Button, Card, Eyebrow, Segmented } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/** 프로필 사진 판 지름(px) — 이 화면에서만 크게 본다(목록의 AVATAR_SIZE 와는 다른 자리). */
const AVATAR = 112;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'PREFER_NOT_TO_SAY', label: '선택 안 함' },
  { value: 'FEMALE', label: '여성' },
  { value: 'MALE', label: '남성' },
  { value: 'OTHER', label: '기타' },
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
        <View style={styles.block}>
          <Pressable
            onPress={() => router.push({ pathname: '/profile-photo', params: { returnTo: 'profile' } })}
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 수정"
            style={({ pressed }) => [styles.photoBlock, pressed && styles.pressed]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <PersonGlyph size={AVATAR} color={colors.textFaint} />
              )}
            </View>
            <Text style={[typeScale.bodyStrong, { color: colors.accent }]}>사진 수정</Text>
          </Pressable>

          <Card>
            <Eyebrow plain>닉네임</Eyebrow>
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
            <Eyebrow plain>기본 정보</Eyebrow>
            <View style={styles.field}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>성별</Text>
              <Segmented options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </View>
            <View style={styles.field}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>생년월일</Text>
              <TextInput
                value={birthDate}
                onChangeText={(value) => {
                  setBirthDate(value.replace(/[^0-9-]/g, '').slice(0, 10));
                  setError(null);
                }}
                placeholder="YYYYMMDD"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                inputMode="numeric"
                accessibilityLabel="생년월일"
                style={[
                  styles.input,
                  { borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text },
                ]}
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
  container: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  photoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { ...typeScale.titleSerif, fontSize: 38, lineHeight: 44 },
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
  pressed: { opacity: 0.72 },
});
