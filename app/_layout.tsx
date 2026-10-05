import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { PushNotifications } from '@/components/notifications/PushNotifications';
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
    'IBMPlexSansKR-Regular': require('../assets/fonts/IBMPlexSansKR-Regular.ttf'),
    'IBMPlexSansKR-SemiBold': require('../assets/fonts/IBMPlexSansKR-SemiBold.ttf'),
    'IBMPlexSansKR-Bold': require('../assets/fonts/IBMPlexSansKR-Bold.ttf'),
    'MaruBuri-Regular': require('../assets/fonts/MaruBuri-Regular.ttf'),
    'MaruBuri-SemiBold': require('../assets/fonts/MaruBuri-SemiBold.ttf'),
    'MaruBuri-Bold': require('../assets/fonts/MaruBuri-Bold.ttf'),
    // 노트 텍스트의 '모노' 글꼴 전용 — 앱 라벨·숫자는 본문 서체를 쓴다(tokens.ts noteMono).
    IBMPlexMono_400Regular,
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
          {/* 헤더는 전역으로 끈다(화면 안의 SectionNav·SubHeader 가 대신한다).
              그래도 title 은 남긴다 — 웹에서 브라우저 탭·히스토리 제목으로 쓰인다. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ title: 'BOOKEY' }} />
            <Stack.Screen name="library" options={{ title: '서재' }} />
            <Stack.Screen name="book-search" options={{ title: '탐색' }} />
            <Stack.Screen name="login" options={{ title: '로그인', gestureEnabled: false }} />
            <Stack.Screen name="password-reset" options={{ title: '비밀번호 찾기' }} />
            <Stack.Screen name="onboarding" options={{ title: '시작하기' }} />
            <Stack.Screen name="profile-photo" options={{ title: '프로필 사진', gestureEnabled: false }} />
            <Stack.Screen name="profile-edit" options={{ title: '프로필 편집' }} />
            <Stack.Screen name="notifications" options={{ title: '알림' }} />
            <Stack.Screen name="bookmarks" options={{ title: '책갈피 구매' }} />
            <Stack.Screen name="wallet" options={{ title: '지갑' }} />
            <Stack.Screen name="settings" options={{ title: '설정' }} />
            <Stack.Screen name="inquiry/index" options={{ title: '고객문의' }} />
            <Stack.Screen name="inquiry/new" options={{ title: '문의하기' }} />
            <Stack.Screen name="inquiry/[id]" options={{ title: '문의 내용' }} />
            <Stack.Screen name="subscription" options={{ title: '구독' }} />
            {/* 모달(iOS 시트)로 띄우지 않는다 — 시트 안에서는 measureInWindow 가 시트 위끝을 0 으로 재 키보드 위로 덜 올라가
                쪽수 키패드가 '독서 마치기'를 덮었다(2026-10-05). 입력이 있는 화면은 다른 하위 화면처럼 push 로 연다. */}
            <Stack.Screen name="timer" options={{ title: '독서 타이머' }} />
            <Stack.Screen name="club/join" options={{ title: '코드로 참가' }} />
            <Stack.Screen name="club/create" options={{ title: '클럽 만들기' }} />
            <Stack.Screen name="club/[id]/index" options={{ title: '클럽' }} />
            <Stack.Screen name="club/[id]/info" options={{ title: '클럽 정보' }} />
            <Stack.Screen name="club/[id]/chat" options={{ title: '클럽 채팅' }} />
            <Stack.Screen name="club/[id]/seats" options={{ title: '자리 늘리기' }} />
            <Stack.Screen name="club/[id]/settings" options={{ title: '클럽 설정' }} />
            <Stack.Screen name="club/[id]/log/index" options={{ title: '메모' }} />
            <Stack.Screen name="club/[id]/log/new" options={{ title: '메모 남기기' }} />
            <Stack.Screen name="club/[id]/log/week" options={{ title: '이번 주 카드' }} />
            <Stack.Screen name="club/[id]/log/[postId]" options={{ title: '메모' }} />
            <Stack.Screen name="club/[id]/meeting/edit/[meetingId]" options={{ title: '모임 고치기' }} />
            <Stack.Screen name="club/[id]/note/[meetingId]" options={{ title: '모임 노트' }} />
            <Stack.Screen name="book/[id]" options={{ title: '책 정보' }} />
            <Stack.Screen name="user/[id]" options={{ title: '프로필' }} />
            <Stack.Screen name="postcards" options={{ title: '엽서함' }} />
            <Stack.Screen name="visitors" options={{ title: '방문자' }} />
            <Stack.Screen name="follows" options={{ title: '팔로우' }} />
            <Stack.Screen name="chats" options={{ title: '채팅' }} />
            <Stack.Screen name="chat/[id]" options={{ title: '채팅' }} />
            <Stack.Screen name="review/[id]" options={{ title: '리뷰' }} />
            <Stack.Screen name="post/new" options={{ title: '독후감 쓰기' }} />
            <Stack.Screen name="post/[id]" options={{ title: '독후감' }} />
            <Stack.Screen name="post/mine" options={{ title: '내 독후감' }} />
          </Stack>
          <PushNotifications />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
