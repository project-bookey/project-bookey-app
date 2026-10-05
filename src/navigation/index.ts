import { router as expoRouter, useRouter as useExpoRouter } from 'expo-router';
import { useMemo } from 'react';

import { navigationTransition } from './transitionGuard';

export * from 'expo-router';

function protectRouter(original: typeof expoRouter): typeof expoRouter {
  return {
    ...original,
    push: (...args) => { navigationTransition.run(() => original.push(...args)); },
    navigate: (...args) => { navigationTransition.run(() => original.navigate(...args)); },
    back: () => { navigationTransition.run(() => original.back()); },
    dismiss: (...args) => { navigationTransition.run(() => original.dismiss(...args)); },
    dismissAll: () => { navigationTransition.run(() => original.dismissAll()); },
    // 구역 리다이렉트는 push 직후에도 실행돼야 한다. 막으면 옛 /postcards 경로가 빈 화면에 머문다.
    dismissTo: (...args) => original.dismissTo(...args),
    // 인증·저장 성공 후의 replace는 직전 이동과 관계없이 반드시 처리한다.
    replace: (...args) => {
      navigationTransition.finish();
      original.replace(...args);
    },
  };
}

export const router = protectRouter(expoRouter);

export function useRouter(): typeof expoRouter {
  const original = useExpoRouter();
  return useMemo(() => protectRouter(original), [original]);
}
