import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, radius, spacing, typeScale } from '@/theme';
import { serif } from '@/theme/tokens';

/**
 * 프로필 사진 등록 — 온보딩 마지막 필수 단계. 가입 직후 여기로 온다.
 * 건너뛰기는 없다(사용자 결정: 필수). 등록이 끝나야 홈으로 들어간다.
 */
export default function ProfilePhotoScreen() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
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
    setUploading(true);
    setError(null);
    try {
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
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '사진을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={[typeScale.monoEyebrow, { color: darkColors.accent }]}>PROFILE</Text>
        <Text style={styles.title}>프로필 사진을 올려주세요</Text>
        <Text style={styles.copy}>
          피드와 엽서에서 나를 알아보게 하는 얼굴이에요.{'\n'}프로필 사진은 꼭 등록해야 시작할 수 있어요.
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
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={{ fontSize: 40 }}>📷</Text>
              <Text style={[typeScale.caption, { color: darkColors.textFaint }]}>탭해서 고르기</Text>
            </View>
          )}
        </Pressable>

        {pickedUri ? (
          <Pressable onPress={pick} accessibilityRole="button" style={styles.ghost}>
            <Text style={[typeScale.label, { color: darkColors.textMuted }]}>다른 사진 고르기</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text style={[typeScale.caption, { color: darkColors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={upload}
        disabled={!pickedUri || uploading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, {
          backgroundColor: pickedUri ? darkColors.accent : darkColors.surface,
        }, pressed && styles.pressed]}
      >
        {uploading ? (
          <ActivityIndicator color={darkColors.onAccent} />
        ) : (
          <Text style={[typeScale.bodyStrong, {
            color: pickedUri ? darkColors.onAccent : darkColors.textFaint,
          }]}>
            등록하고 시작하기
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: darkColors.bg,
    padding: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  title: { fontFamily: serif.bold, fontSize: 26, lineHeight: 36, color: darkColors.text },
  copy: { ...typeScale.body, color: darkColors.textMuted, lineHeight: 24 },
  avatarWrap: { alignSelf: 'center', marginTop: spacing.lg },
  avatar: { width: 160, height: 160, borderRadius: 80 },
  avatarEmpty: {
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.surface,
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
