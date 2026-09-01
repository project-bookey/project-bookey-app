import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { NotificationBell } from './NotificationBell';

/** 헤더 우측 아이콘 트리오 — 종(알림) · 서재 · 프로필. 전 화면 공통 (탭 해체 스펙). */
export function HomeHeaderIcons() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <NotificationBell />
      <Pressable
        onPress={() => router.push('/library')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="서재"
      >
        <Image
          source={require('../../../assets/icons/books.png')}
          style={[styles.icon, { tintColor: colors.onChrome }]}
        />
      </Pressable>
      <Pressable
        onPress={() => router.push('/profile')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="프로필"
      >
        <Image
          source={require('../../../assets/icons/person.png')}
          style={[styles.icon, { tintColor: colors.onChrome }]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 우측 여백은 화면 콘텐츠 여백(spacing.lg)과 정렬 — 좌측 로고와 대칭.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.lg },
  icon: { width: 26, height: 26, resizeMode: 'contain' },
});
