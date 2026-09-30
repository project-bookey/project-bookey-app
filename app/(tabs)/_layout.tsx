import { Tabs, usePathname, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader, SectionNav, type SectionKey } from '@/components/collage';
import { BottomTabSwipeProvider } from '@/components/BottomTabSwipe';
import { useTheme } from '@/theme';

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
  search: 'shelf',
};

export default function MainTabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const routeName = pathname.split('/').filter(Boolean)[0] ?? 'home';
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <BrandHeader />
      </View>
      <View style={styles.pages}>
        <BottomTabSwipeProvider>
          <Tabs screenOptions={tabOptions} backBehavior="history" tabBar={() => null}>
          <Tabs.Screen name="plaza" options={{ title: '광장' }} />
          <Tabs.Screen name="home" options={{ title: '서가' }} />
          <Tabs.Screen name="clubs" options={{ title: '모임' }} />
          <Tabs.Screen name="messenger" options={{ title: '메신저' }} />
          <Tabs.Screen name="profile" options={{ title: '나' }} />
          <Tabs.Screen name="search" options={{ title: '탐색', href: null }} />
          </Tabs>
        </BottomTabSwipeProvider>
      </View>
      <SectionNav
        active={ACTIVE_BY_ROUTE[routeName] ?? 'shelf'}
        onSelect={(name) => router.replace(`/${name}` as '/home')}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, pages: { flex: 1 } });
