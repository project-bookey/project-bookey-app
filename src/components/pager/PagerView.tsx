// 네이티브(iOS/Android)는 react-native-pager-view를 그대로 쓴다.
// 웹은 해당 모듈이 네이티브 전용이라 PagerView.web.tsx의 대체 구현으로 갈아끼워진다.
export { default } from 'react-native-pager-view';
export type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
