import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { Segmented } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

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

/**
 * 프로필 사진 등록 — 온보딩 마지막 필수 단계. 가입 직후 여기로 온다.
 * 건너뛰기는 없다(사용자 결정: 필수). 등록이 끝나야 홈으로 들어간다.
 */
export default function ProfilePhotoScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const editing = returnTo === 'profile';
  const { colors } = useTheme();
  const setUser = useAuth((s) => s.setUser);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>('PREFER_NOT_TO_SAY');
  const [birthDate, setBirthDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
    }
  };

  const upload = async () => {
    if (!pickedUri || uploading) return;
    const birthDateText = birthDate.trim();
    const normalizedBirthDate = birthDateText ? normalizeBirthDate(birthDateText) : null;
    if (!editing && !normalizedBirthDate) {
      setError('생년월일을 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      if (!editing) {
        const me = await authApi.updateProfile({ gender, birthDate: normalizedBirthDate ?? undefined });
        setUser(me);
      }
      const form = new FormData();
      if (Platform.OS === 'web') {
        // 웹의 uri 는 blob:/data: — 실제 바이너리로 바꿔 담는다.
        const blob = await fetch(pickedUri).then((r) => r.blob());
        form.append('file', blob, 'avatar.jpg');
      } else {
        form.append('file', {
          uri: pickedUri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
      }
      const me = await authApi.uploadAvatar(form);
      setUser(me);
      router.replace(editing ? '/profile' : '/home');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STORAGE_DISABLED') {
        setError('사진 업로드 저장소가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.');
      } else {
        setError(e instanceof ApiError ? e.message : '사진을 올리지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {editing ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={[styles.backLabel, { color: colors.accent }]}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>PROFILE</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {editing ? '프로필 사진 변경' : '프로필 사진을 올려주세요'}
        </Text>

        {!editing ? (
          <View style={styles.profileFields}>
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
          </View>
        ) : null}
        <Text style={[styles.copy, { color: colors.textMuted }]}>
          {editing
            ? '피드와 엽서에서 보일 사진을 새로 고를 수 있어요.'
            : `피드와 엽서에서 나를 알아보게 하는 얼굴이에요.\n프로필 사진은 꼭 등록해야 시작할 수 있어요.`}
        </Text>

        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 고르기"
          style={styles.avatarWrap}
        >
          {pickedUri ? (
            <Image source={{ uri: pickedUri }} style={styles.avatar} />
          ) : (
            <View style={[
              styles.avatar,
              styles.avatarEmpty,
              { borderColor: colors.lineStrong, backgroundColor: colors.surface },
            ]}>
              <Text style={{ fontSize: 40 }}>📷</Text>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>탭해서 고르기</Text>
            </View>
          )}
        </Pressable>

        {pickedUri ? (
          <Pressable onPress={pick} accessibilityRole="button" style={styles.ghost}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>다른 사진 고르기</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={upload}
        disabled={!pickedUri || uploading || (!editing && birthDate.trim().length === 0)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, {
          backgroundColor: pickedUri && (editing || birthDate.trim().length > 0) ? colors.accent : colors.surface,
        }, pressed && styles.pressed]}
      >
        {uploading ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={[typeScale.bodyStrong, {
            color: pickedUri && (editing || birthDate.trim().length > 0) ? colors.onAccent : colors.textFaint,
          }]}>
            {editing ? '변경 완료' : '등록하고 시작하기'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  backButton: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    left: spacing.lg,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: { fontSize: 42, lineHeight: 42 },
  title: { fontFamily: serif.bold, fontSize: 26, lineHeight: 36 },
  copy: { ...typeScale.body, lineHeight: 24 },
  profileFields: { gap: spacing.md },
  field: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  avatarWrap: { alignSelf: 'center', marginTop: spacing.lg },
  avatar: { width: 160, height: 160, borderRadius: 80 },
  avatarEmpty: {
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ghost: { alignSelf: 'center', padding: spacing.sm },
  cta: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
