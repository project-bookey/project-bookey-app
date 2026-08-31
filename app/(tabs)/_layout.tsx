import { Tabs } from 'expo-router';

import { LogoHome } from '@/components/LogoHome';
import { useTheme, sans, spacing } from '@/theme';

/**
 * 탭 구조 (§6 IA — MVP 5탭: 홈 / 서재 / 모임 / 기록 / 프로필).
 * 아이콘 없이 글자만 둔다. 라벨이 곧 표지판 역할을 한다.
 * 헤더·탭바 크롬은 모드 무관 블랙 원톤, 좌상단 로고가 홈 버튼이다.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.chrome },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: sans.semiBold, fontSize: 20, color: colors.onChrome, letterSpacing: -0.2 },
        headerTitleAlign: 'left',
        headerTitleContainerStyle: { paddingLeft: spacing.md },
        headerLeft: () => <LogoHome />,
        headerLeftContainerStyle: { paddingLeft: spacing.lg },
        tabBarActiveTintColor: colors.onChrome,
        tabBarInactiveTintColor: colors.onChromeFaint,
        tabBarLabelStyle: { fontFamily: sans.bold, fontSize: 11.5, letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: colors.chrome,
          borderTopWidth: 0,
          height: 58,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarIconStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: '홈', headerTitle: '' }} />
      <Tabs.Screen name="library" options={{ title: '서재' }} />
      <Tabs.Screen name="clubs" options={{ title: '모임' }} />
      <Tabs.Screen name="record" options={{ title: '기록' }} />
      <Tabs.Screen name="profile" options={{ title: '프로필' }} />
    </Tabs>
  );
}
