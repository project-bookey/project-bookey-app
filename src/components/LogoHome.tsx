import { useRouter } from 'expo-router';
import { Image, Pressable } from 'react-native';

import { spacing } from '@/theme';

/**
 * 헤더 좌측 로고 — 어느 화면에서든 누르면 홈으로 간다.
 * 블랙 크롬 전용 화이트 마크(logo-dark.png)를 쓴다.
 * 좌측 여백은 화면 콘텐츠 여백(spacing.lg)과 정렬.
 */
export function LogoHome() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/home')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="bookey 홈"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: spacing.lg, marginRight: spacing.md })}
    >
      <Image
        source={require('../../assets/logo-dark.png')}
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
    </Pressable>
  );
}
