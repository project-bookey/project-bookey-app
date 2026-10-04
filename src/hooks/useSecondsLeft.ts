import { useEffect, useState } from 'react';

/**
 * 마감 시각(ms)까지 남은 초 — 1초마다 다시 센다. 마감이 지나면 멈춘다.
 * 그릴 때마다 실제 시각으로 다시 재므로, 메일 앱에서 코드를 보고 돌아와도(그동안 타이머가 멈춰 있었어도) 맞는다.
 */
export function useSecondsLeft(deadline: number | null): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadline == null || deadline <= Date.now()) return;
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      if (Date.now() >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline == null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
