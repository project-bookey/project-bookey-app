import { Tabs } from 'expo-router';

import { useTheme, hairline } from '@/theme';

/**
 * 탭 구조 (§6 IA — MVP 5탭: 홈 / 서재 / 모임 / 기록 / 프로필).
 * 아이콘 없이 글자만 둔다. 라벨이 곧 표지판 역할을 한다.
 * 색은 useTheme() 으로 받아 시스템 라이트/다크 모드를 그대로 따른다.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: hairline,
          borderTopColor: colors.line,
          height: 58,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarIconStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="library" options={{ title: '서재' }} />
      <Tabs.Screen name="clubs" options={{ title: '모임' }} />
      <Tabs.Screen name="record" options={{ title: '기록' }} />
      <Tabs.Screen name="profile" options={{ title: '프로필' }} />
    </Tabs>
  );
}
