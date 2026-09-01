import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  NanumMyeongjo_400Regular,
  NanumMyeongjo_700Bold,
  NanumMyeongjo_800ExtraBold,
} from '@expo-google-fonts/nanum-myeongjo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogoHome } from '@/components/LogoHome';
import { HomeHeaderIcons } from '@/components/home/HomeHeaderIcons';
import { Loading } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import { useTheme, sans } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const restore = useAuth((s) => s.restore);
  const restoreTheme = useThemePreference((s) => s.restore);
  const status = useAuth((s) => s.status);
  const [ready, setReady] = useState(false);
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
    NanumMyeongjo_400Regular,
    NanumMyeongjo_700Bold,
    NanumMyeongjo_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    // 첫 렌더 전에 테마 선호까지 복원해 콜드 스타트 다크→라이트 깜빡임을 막는다.
    Promise.all([restore(), restoreTheme()]).finally(() => setReady(true));
  }, [restore, restoreTheme]);

  // 제스처 핸들러가 전체 트리를 감싸야 하므로 로딩 상태를 포함해 최외곽에서 래핑한다.
  if (!ready || !fontsLoaded || status === 'loading') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Loading />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* 크롬이 모드 무관 블랙이므로 상태바도 항상 밝은 아이콘 */}
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.chrome },
              headerShadowVisible: false,
              headerTintColor: colors.onChrome,
              headerTitleStyle: { fontFamily: sans.semiBold, fontSize: 24 },
              headerLeft: () => <LogoHome />,
              headerRight: () => <HomeHeaderIcons />,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="home" options={{ headerTitle: '' }} />
            <Stack.Screen name="library" options={{ title: '서재' }} />
            <Stack.Screen name="clubs" options={{ title: '모임' }} />
            <Stack.Screen name="profile" options={{ title: '프로필' }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="search" options={{ title: '도서 검색' }} />
            <Stack.Screen name="notifications" options={{ title: '알림' }} />
            <Stack.Screen name="timer" options={{ title: '독서 타이머', presentation: 'modal' }} />
            <Stack.Screen name="challenge/new" options={{ title: '새 챌린지' }} />
            <Stack.Screen name="challenge/[id]" options={{ title: '챌린지' }} />
            <Stack.Screen name="club/join" options={{ title: '코드로 참가' }} />
            <Stack.Screen name="club/create" options={{ title: '모임 만들기' }} />
            <Stack.Screen name="club/[id]/index" options={{ title: '모임' }} />
            <Stack.Screen name="club/[id]/posts" options={{ title: '토론' }} />
            <Stack.Screen name="club/[id]/result" options={{ title: '모임 결산' }} />
            <Stack.Screen name="book/[id]" options={{ title: '도서' }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
