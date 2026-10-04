/**
 * 웹은 스크린리더를 알아낼 길이 없다 — react-native-web 의 AccessibilityInfo.isScreenReaderEnabled 는 늘 true 라
 * 그대로 쓰면 웹에서는 자동으로 넘어가는 글이 전혀 돌지 않는다. 꺼진 것으로 본다.
 */
export function useScreenReaderEnabled(): boolean {
  return false;
}
