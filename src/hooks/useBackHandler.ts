import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android 뒤로 가기 — 화면 위에 겹친 것(앱 둘러보기, 타이머의 마치기 시트)이 보이는 동안에는 뒤 화면 대신 그것이 받는다
 * (앱이 꺼지거나 화면이 넘어가지 않게). 웹은 `.web.ts` 가 아무것도 하지 않는다(react-native-web 의 BackHandler 는 쓰면 콘솔 오류를 낸다).
 */
export function useBackHandler(enabled: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current();
      return true;
    });
    return () => subscription.remove();
  }, [enabled]);
}
