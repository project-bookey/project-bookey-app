import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from '@/components/pager/PagerView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader, SectionNav, type SectionKey } from '@/components/collage';
import { useTheme } from '@/theme';
import ClubsScreen from './clubs';
import HomeScreen from './home';
import MessengerScreen from './messenger';
import PlazaScreen from './plaza';
import ProfileScreen from './profile';

// 서가가 가운데 — SectionNav의 SECTIONS 순서와 같아야 한다.
const ROUTES = ['plaza', 'clubs', 'home', 'messenger', 'profile'] as const;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
let lastMainIndex: number | null = null;

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
  const routeIndex = ROUTES.indexOf(routeName as typeof ROUTES[number]);
  const initialRouteIndex = lastMainIndex ?? (routeIndex >= 0 ? routeIndex : ROUTES.indexOf('home'));
  const pageRef = useRef<PagerView>(null);
  const visibleIndex = useRef(initialRouteIndex);
  const pendingIndex = useRef<number | null>(null);
  const returningFromDetail = useRef(routeIndex < 0);
  const [activeIndex, setActiveIndex] = useState(initialRouteIndex);
  const pagerPosition = useRef(new Animated.Value(initialRouteIndex)).current;
  const pagerOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 채팅·알림 같은 상세 화면이 위에 올라온 동안에는 뒤의 메인 pager를 유지한다.
    if (routeIndex < 0) {
      returningFromDetail.current = true;
      return;
    }
    // 메인 탭 URL을 바꾸지 않으므로 상세 화면에서 돌아올 때의 경로는 오래된 값이다.
    // 그 값으로 PagerView를 되감지 않고 사용자가 마지막으로 보던 탭을 유지한다.
    if (returningFromDetail.current) {
      returningFromDetail.current = false;
      return;
    }
    if (routeIndex === visibleIndex.current) return;
    visibleIndex.current = routeIndex;
    lastMainIndex = routeIndex;
    setActiveIndex(routeIndex);
    pagerPosition.setValue(routeIndex);
    pagerOffset.setValue(0);
    // 링크·뒤로가기로 탭 경로가 바뀐 경우도 슬라이드하지 않고 즉시 맞춘다.
    pageRef.current?.setPageWithoutAnimation(routeIndex);
  }, [routeIndex]);

  const selectPage = (index: number) => {
    pendingIndex.current = null;
    pagerPosition.setValue(index);
    pagerOffset.setValue(0);
    if (index !== visibleIndex.current) {
      visibleIndex.current = index;
      lastMainIndex = index;
      setActiveIndex(index);
    }
  };

  const selectRoute = (name: string) => {
    const index = ROUTES.indexOf(name as typeof ROUTES[number]);
    if (index < 0 || index === pendingIndex.current) return;
    if (index === visibleIndex.current && pendingIndex.current === null) return;
    pendingIndex.current = index;
    // 입력 피드백은 즉시 보여 주고, 실제 페이지 상태는 onPageSelected에서 확정한다.
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
          initialPage={initialRouteIndex}
          // 다섯 메인 화면을 유지해 멀리 있는 탭도 첫 클릭부터 즉시 보이게 한다.
          offscreenPageLimit={ROUTES.length}
          overdrag
          onPageScroll={Animated.event(
            [{ nativeEvent: { position: pagerPosition, offset: pagerOffset } }],
            { useNativeDriver: true },
          )}
          onPageSelected={(event: PagerViewOnPageSelectedEvent) => selectPage(event.nativeEvent.position)}
        >
          <View key="plaza" collapsable={false}><PlazaScreen /></View>
          <View key="clubs" collapsable={false}><ClubsScreen /></View>
          <View key="home" collapsable={false}><HomeScreen /></View>
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
