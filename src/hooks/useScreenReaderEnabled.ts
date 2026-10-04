import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** 스크린리더(VoiceOver·TalkBack)가 켜져 있는지 — 자동으로 넘어가는 글을 멈출 때 쓴다. 웹은 .web.ts 가 대신한다. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (alive) setEnabled(on); });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => { alive = false; sub.remove(); };
  }, []);
  return enabled;
}
