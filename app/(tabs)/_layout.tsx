import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from '@/components/PagerView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader, SectionNav, type SectionKey } from '@/components/collage';
import { useTheme } from '@/theme';
import ClubsScreen from './clubs';
import HomeScreen from './home';
import MessengerScreen from './messenger';
import PlazaScreen from './plaza';
import ProfileScreen from './profile';

const ROUTES = ['plaza', 'home', 'clubs', 'messenger', 'profile'] as const;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const routeName = pathname.split('/').filter(Boolean)[0] ?? 'home';
  const routeIndex = Math.max(0, ROUTES.indexOf(routeName as typeof ROUTES[number]));
  const pageRef = useRef<PagerView>(null);
  const visibleIndex = useRef(routeIndex);
  const [activeIndex, setActiveIndex] = useState(routeIndex);
  const pagerPosition = useRef(new Animated.Value(routeIndex)).current;
  const pagerOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (routeIndex === visibleIndex.current) return;
    visibleIndex.current = routeIndex;
    setActiveIndex(routeIndex);
    pageRef.current?.setPage(routeIndex);
  }, [routeIndex]);

  const selectPage = (index: number) => {
    if (index === visibleIndex.current) return;
    visibleIndex.current = index;
    setActiveIndex(index);
  };

  const selectRoute = (name: string) => {
    const index = ROUTES.indexOf(name as typeof ROUTES[number]);
    if (index < 0 || index === visibleIndex.current) return;
    visibleIndex.current = index;
    setActiveIndex(index);
    pagerPosition.setValue(index);
    pagerOffset.setValue(0);
    pageRef.current?.setPageWithoutAnimation(index);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <BrandHeader />
      </View>
      <View style={styles.pages}>
        <AnimatedPagerView
          ref={pageRef}
          style={styles.pager}
          initialPage={routeIndex}
          offscreenPageLimit={1}
          overdrag
          onPageScroll={Animated.event(
            [{ nativeEvent: { position: pagerPosition, offset: pagerOffset } }],
            { useNativeDriver: true },
          )}
          onPageSelected={(event: PagerViewOnPageSelectedEvent) => selectPage(event.nativeEvent.position)}
        >
          <View key="plaza" collapsable={false}><PlazaScreen /></View>
          <View key="home" collapsable={false}><HomeScreen /></View>
          <View key="clubs" collapsable={false}><ClubsScreen /></View>
          <View key="messenger" collapsable={false}><MessengerScreen /></View>
          <View key="profile" collapsable={false}><ProfileScreen /></View>
        </AnimatedPagerView>
      </View>
      <SectionNav
        active={ACTIVE_BY_ROUTE[ROUTES[activeIndex]] ?? 'shelf'}
        onSelect={selectRoute}
        pagerPosition={pagerPosition}
        pagerOffset={pagerOffset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pages: { flex: 1 },
  pager: { flex: 1 },
});
