import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * 앱 설정(업데이트·점검) 확인 상태 — 홈 공지 팝업은 확인과 안내가 끝난 뒤에만 뜬다(팝업이 두 개 겹치지 않게).
 *
 * - settled: 첫 확인이 끝났고(실패해도 끝난 것으로 본다) 띄운 안내(권장 업데이트·점검 예고)도 닫혔다.
 * - blocked: 강제 업데이트나 점검 중이라 앱 전체를 덮는 화면이 떠 있다.
 *
 * 웹은 묻지 않으므로 처음부터 settled 다.
 */
type AppConfigGateState = {
  settled: boolean;
  blocked: boolean;
  update: (next: Partial<Pick<AppConfigGateState, 'settled' | 'blocked'>>) => void;
};

export const useAppConfigGate = create<AppConfigGateState>((set) => ({
  settled: Platform.OS === 'web',
  blocked: false,
  update: (next) => set(next),
}));
