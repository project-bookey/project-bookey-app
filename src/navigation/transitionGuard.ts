/** 공유 가드: 서로 다른 버튼에서 이어진 탭도 화면 전환이 끝날 때까지 한 번만 처리한다. */
export function createTransitionGuard(now: () => number = Date.now) {
  let blockedUntil = 0;
  return {
    run(action: () => void): boolean {
      if (now() < blockedUntil) return false;
      // 웹·잘못된 주소 등 transitionEnd가 없는 경우에도 영구히 잠기지 않는다.
      blockedUntil = now() + 1000;
      try {
        action();
      } catch (error) {
        blockedUntil = 0;
        throw error;
      }
      return true;
    },
    start() { blockedUntil = now() + 1500; },
    finish() { blockedUntil = 0; },
  };
}

export const navigationTransition = createTransitionGuard();
