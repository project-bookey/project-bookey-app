import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/theme';

import { NotificationBell } from './NotificationBell';

/** 홈 헤더 우측 아이콘 트리오 — 종(알림) · 서재 · 프로필 (탭 해체 스펙). */
export function HomeHeaderIcons() {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <NotificationBell />
      <Pressable
        onPress={() => router.push('/library')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="서재"
      >
        <Text style={styles.icon}>📚</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/profile')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="프로필"
      >
        <Text style={styles.icon}>👤</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 20 },
});
