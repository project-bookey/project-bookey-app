import { Tabs } from 'expo-router';

import { SectionNav, type SectionKey } from '@/components/collage';

const tabOptions = {
  headerShown: false,
  tabBarStyle: { display: 'none' as const },
  animation: 'none' as const,
};

const ACTIVE_BY_ROUTE: Record<string, SectionKey> = {
  plaza: 'plaza',
  home: 'shelf',
  clubs: 'clubs',
  messenger: 'messenger',
  profile: 'me',
  settings: 'settings',
  search: 'shelf',
};

export default function MainTabsLayout() {
  return (
    <Tabs
      screenOptions={tabOptions}
      backBehavior="history"
      tabBar={({ state, navigation }) => {
        const routeName = state.routes[state.index]?.name ?? 'home';
        return (
          <SectionNav
            active={ACTIVE_BY_ROUTE[routeName] ?? 'shelf'}
            onSelect={(name) => navigation.navigate(name)}
          />
        );
      }}
    >
      <Tabs.Screen name="plaza" options={{ title: '광장' }} />
      <Tabs.Screen name="home" options={{ title: '서가' }} />
      <Tabs.Screen name="clubs" options={{ title: '모임' }} />
      <Tabs.Screen name="messenger" options={{ title: '메신저' }} />
      <Tabs.Screen name="profile" options={{ title: '나' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
      <Tabs.Screen name="search" options={{ title: '탐색', href: null }} />
    </Tabs>
  );
}
