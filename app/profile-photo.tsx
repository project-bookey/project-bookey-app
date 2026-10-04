import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { SubHeader } from '@/components/collage';
import { Segmented } from '@/components/ui';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { useAuth } from '@/store/auth';
import Svg, { Circle, Path } from 'react-native-svg';

import { hairline, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

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

/** 프로필 사진 등록·변경. 가입 직후에는 건너뛰고 나중에 프로필에서 바꿀 수 있다. */
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

  // 가입 직후엔 사진이 없어도 기본 정보만으로 시작할 수 있다 — 사진 때문에 입력한 성별·생년월일까지
  // 막히거나 '나중에 하기'로 버려지지 않게(UX 철칙 Hick). 변경 화면은 사진이 있어야 저장한다.
  const canSubmit = editing ? pickedUri != null : birthDate.trim().length > 0;
  const submitLabel = editing ? '저장' : pickedUri ? '등록하고 시작하기' : '시작하기';

  const upload = async () => {
    if (!canSubmit || uploading) return;
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
        if (!pickedUri) {
          router.replace('/home');
          return;
        }
      }
      if (!pickedUri) return;
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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* 변경 화면의 뒤로 가기는 다른 서브 화면과 같은 SubHeader — 세이프에어리어도 거기서 처리한다. */}
      {editing ? <SubHeader category="프로필 사진" /> : null}
      <View style={styles.screen}>
        <View style={styles.body}>
          <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>PROFILE</Text>
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
                <BirthDatePicker
                  value={birthDate}
                  onChange={(value) => {
                    setBirthDate(value);
                    setError(null);
                  }}
                />
              </View>
            </View>
          ) : null}
          <Text style={[styles.copy, { color: colors.textMuted }]}>
            {editing
              ? '피드와 엽서에서 보일 사진을 새로 고를 수 있어요.'
              : `피드와 엽서에서 나를 알아보게 하는 얼굴이에요.\n나중에 프로필에서 다시 등록할 수 있어요.`}
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
                <CameraGlyph color={colors.textFaint} />
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>탭해서 고르기</Text>
              </View>
            )}
          </Pressable>

          {pickedUri ? (
            <Pressable onPress={pick} accessibilityRole="button" style={styles.ghost}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>다른 사진 고르기</Text>
            </Pressable>
          ) : null}
          {!editing ? (
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button" style={styles.ghost}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>나중에 하기</Text>
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
          disabled={!canSubmit || uploading}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, {
            backgroundColor: canSubmit ? colors.accent : colors.surface,
          }, pressed && styles.pressed]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[typeScale.bodyStrong, { color: canSubmit ? colors.onAccent : colors.textFaint }]}>
              {submitLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** 사진 없음 자리의 카메라 — 이모지 대신 선으로 그린다. */
function CameraGlyph({ color }: { color: string }) {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M4 8h4l1.5-2.5h5L16 8h4v11H4z" stroke={color} {...iconStroke} />
      <Circle cx={12} cy={13} r={3.25} stroke={color} {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: {
    flex: 1,
    padding: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
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
  avatar: { width: 160, height: 160, borderRadius: radius.round },
  avatarEmpty: {
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ghost: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  cta: {
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: pressedStyle,
});
