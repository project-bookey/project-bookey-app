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

import { Loading } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useThemePreference } from '@/store/themePreference';
import { useTheme } from '@/theme';

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
  const { mode } = useTheme();
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
          {/* 크롬이 배경과 동화되므로 상태바 아이콘도 테마 모드를 따라간다 */}
          <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="home" />
            <Stack.Screen name="search" />
            <Stack.Screen name="plaza" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="library" />
            <Stack.Screen name="clubs" />
            <Stack.Screen name="login" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="timer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="challenge/new" />
            <Stack.Screen name="challenge/[id]" />
            <Stack.Screen name="club/join" />
            <Stack.Screen name="club/create" />
            <Stack.Screen name="club/[id]/index" />
            <Stack.Screen name="club/[id]/posts" />
            <Stack.Screen name="club/[id]/result" />
            <Stack.Screen name="book/[id]" />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
