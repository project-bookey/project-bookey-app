import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { SubHeader } from '@/components/collage';
import { Button, Segmented, linkLabel } from '@/components/ui';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { LegalDocumentSheet } from '@/components/legal/LegalDocumentSheet';
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

/**
 * 프로필 사진 등록·변경. 가입 직후에는 건너뛰고 나중에 프로필에서 바꿀 수 있다.
 * 가입 직후 단계의 성별·생년월일은 [선택] 정보 — 넣고 '동의하고 시작'을 누르면 먼저 선택 동의(PROFILE_OPTIONAL)를
 * 기록한 뒤 저장한다(서버가 동의 없이는 받지 않는다). 사진만 올리거나 '나중에 하기'로 넘어가도 된다.
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
  const [optionalDocOpen, setOptionalDocOpen] = useState(false);

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

  // 가입 직후엔 사진·선택 정보 중 하나만 있어도 시작할 수 있다 — 사진 때문에 입력한 성별·생년월일까지
  // 막히거나 '나중에 하기'로 버려지지 않게(UX 철칙 Hick). 변경 화면은 사진이 있어야 저장한다.
  const demographicsEntered = !editing && (birthDate.trim().length > 0 || gender !== 'PREFER_NOT_TO_SAY');
  const canSubmit = editing ? pickedUri != null : demographicsEntered || pickedUri != null;
  const submitLabel = editing ? '저장' : demographicsEntered ? '동의하고 시작' : '등록하고 시작하기';

  const upload = async () => {
    if (!canSubmit || uploading) return;
    const birthDateText = birthDate.trim();
    const normalizedBirthDate = birthDateText ? normalizeBirthDate(birthDateText) : null;
    if (birthDateText && !normalizedBirthDate) {
      setError('생년월일을 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      if (demographicsEntered) {
        // 선택 동의가 먼저 — 서버는 동의 없이 성별·생년월일을 받지 않는다(CONSENT_REQUIRED).
        await authApi.setConsent('PROFILE_OPTIONAL', true);
        const me = await authApi.updateProfile({ gender, birthDate: normalizedBirthDate ?? undefined });
        setUser(me);
      }
      if (!editing && !pickedUri) {
        router.replace('/home');
        return;
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
      // 변경은 '나' 화면에서 push 로 들어온다 — 돌아간다. '/profile' 로 replace 하면 메인 탭이 한 벌 더 쌓인다.
      if (editing && router.canGoBack()) router.back();
      else router.replace(editing ? '/profile' : '/home');
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
              {/* 선택 정보 고지 — 넣는 자리 바로 아래(Proximity). 원문은 '자세히'. */}
              <View style={styles.optionalNote}>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                  [선택] 성별·생년월일은 맞춤 추천과 또래 독서 통계에만 써요. 넣고 '동의하고 시작'을 누르면 수집·이용에 동의하게 되고, 프로필 편집에서 언제든 지울 수 있어요.
                </Text>
                <Pressable
                  onPress={() => setOptionalDocOpen(true)}
                  accessibilityRole="button"
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  style={({ pressed }) => [styles.optionalLink, pressed && styles.pressed]}
                >
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>{linkLabel('자세히')}</Text>
                </Pressable>
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
            <Button label="다른 사진 고르기" variant="ghost" onPress={pick} style={styles.ghost} />
          ) : null}
          {!editing ? (
            <Button label="나중에 하기" variant="ghost" onPress={() => router.replace('/home')} style={styles.ghost} />
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
      <LegalDocumentSheet
        docKey={optionalDocOpen ? 'profile-optional' : null}
        colors={colors}
        onClose={() => setOptionalDocOpen(false)}
      />
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
  optionalNote: { gap: spacing.xs },
  optionalLink: { alignSelf: 'flex-start' },
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
  // 회색 글자뿐이라 지나치던 보조 동작 — 앱 공용 ghost 버튼(본문색, 44pt)으로 가운데에 둔다.
  ghost: { alignSelf: 'center', paddingHorizontal: spacing.md },
  cta: {
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: pressedStyle,
});
