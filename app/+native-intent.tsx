/** 카카오 로그인 복귀 주소 — bookey://auth/kakao?… (Expo Go 에선 경로만 /auth/kakao?… 로 온다). */
const KAKAO_RETURN = /^(?:bookey:\/\/\/?|\/)auth\/kakao(?:[?#]|$)/;

/**
 * 밖에서 들어온 주소를 화면 경로로 바꾸기 전에 거른다(expo-router).
 * 카카오 로그인 복귀 주소는 열려 있는 로그인 창(WebBrowser.openAuthSessionAsync)이 받는다 — Android 에선 이 주소가
 * 앱에도 들어와 없는 화면으로 옮겨 가므로 지금 화면에 머문다. 앱이 꺼진 채 받았으면 처음 화면으로 연다.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (KAKAO_RETURN.test(path)) return initial ? '/' : null;
  return path;
}
