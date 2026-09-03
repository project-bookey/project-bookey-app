import { useCallback, useEffect, useRef, useState } from 'react';

/** 삭제 재확인이 살아 있는 시간(ms). 지나면 조용히 원래 라벨로 돌아간다. */
const DELETE_CONFIRM_MS = 3000;

/**
 * 삭제는 두 번 눌러야 나간다 — 첫 탭은 확인 상태(`confirm`)로 바꾸고 3초 뒤 저절로 접힌다.
 * 광장 카드·밑줄 상세(밑줄과 댓글이 같은 타이머를 나눠 쓴다)가 같은 규율을 쓴다. 한 번에 하나만 확인 상태다.
 *
 * 쓰는 쪽: `confirm` 이 그 대상이면 `disarm()` 뒤 실제 삭제, 아니면 `arm(target)`.
 * 화면을 떠날 때 타이머를 남겨 두지 않는다.
 */
export function useDeleteConfirm<T>(): {
  confirm: T | null;
  arm: (target: T) => void;
  disarm: () => void;
} {
  const [confirm, setConfirm] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clear, [clear]);

  const arm = useCallback((target: T) => {
    clear();
    setConfirm(target);
    timer.current = setTimeout(() => {
      timer.current = null;
      setConfirm(null);
    }, DELETE_CONFIRM_MS);
  }, [clear]);

  const disarm = useCallback(() => {
    clear();
    setConfirm(null);
  }, [clear]);

  return { confirm, arm, disarm };
}
