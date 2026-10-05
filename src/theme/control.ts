import type { ViewStyle } from 'react-native';

/**
 * 버튼 면 — 2026-10-05 사용자 결정(버튼 비교 페이지: 14-A 부드러운 네모 · 15 평평하게). 역할 색을 그대로 깐
 * 평평한 면이고 테두리·광택·그림자는 두지 않는다. 색은 역할마다 하나 — 주요 `accent`, 보조 `tonal`,
 * 위험 `dangerSoft`, 고른 것 `ink`(세그먼트의 고른 칸은 `thumb`). 모서리·높이는 쓰는 쪽이 정한다.
 */
export function controlFace(base: string): ViewStyle {
  return { backgroundColor: base };
}
