import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { useTheme, spacing } from '@/theme';

/**
 * 헤더 좌측 로고 — 어느 화면에서든 누르면 홈으로 간다.
 * 블랙 크롬 전용 화이트 마크(logo-dark.png)를 쓴다.
 */
export function LogoHome() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)/home')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="bookey 홈"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Image
        source={require('../../assets/logo-dark.png')}
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

/** 서브 화면 헤더 좌측 — 뒤로가기 셰브론 + 로고. */
export function HeaderBackLogo() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
      {router.canGoBack() && (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 10 })}
        >
          <Text style={{ color: colors.onChrome, fontSize: 30, fontWeight: '600', lineHeight: 34 }}>‹</Text>
        </Pressable>
      )}
      <LogoHome />
    </View>
  );
}
