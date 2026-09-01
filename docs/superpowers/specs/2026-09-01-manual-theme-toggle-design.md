# 앱 내 수동 테마 전환 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정

## 목표

지금까지 테마는 기기(OS) 다크 모드 설정만 따라갔다. 앱 안에서 직접 라이트/다크를 고를 수
있게 한다. 토큰 설계 때 예고한 확장 지점("수동 전환이 필요해지면 `useTheme()` 내부만 바꾼다")을
그대로 사용한다 — 호출부는 변경하지 않는다.

## 결정 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| 모드 선택지 | 시스템 / 라이트 / 다크 3택, 기본 '시스템' | iOS·Android 표준 패턴. 기존 동작(시스템 추종)을 기본값으로 보존 |
| UI 위치 | 프로필 탭에 '화면 테마' 섹션 | 재촉 톤·알림 설정이 이미 프로필 탭에 있음. 별도 화면은 항목 1개에 과함 |
| 저장 | 기기 로컬 AsyncStorage | 테마는 기기별 선호. 백엔드 변경 없이 이 레포로 완결. 로그아웃과 무관하게 유지 |
| 상태 관리 | zustand 스토어 | auth와 동일한 기존 패턴. Provider 없이 모든 `useTheme()` 호출부가 자동 구독 |
| 프로필 화면 | 프리미티브 포함 테마 인식 전환 | 토글이 있는 화면 자체가 다크 고정이면 어색함. 단 다크 외관은 현재와 동일 유지 |

## 상태 & 저장 — `src/store/themePreference.ts` (신규)

```ts
export type ThemePreference = 'system' | 'light' | 'dark';
```

- zustand 스토어: `{ preference: ThemePreference; restore(): Promise<void>; setPreference(p: ThemePreference): void }`
- 저장 키 `bookey.themePreference`. 전 플랫폼 AsyncStorage — 비밀값이 아니므로
  SecureStore를 쓰지 않는다 (`tokenStorage.ts`의 분기와 다른 이유).
- `restore()`: 저장값이 3개 허용값 중 하나일 때만 반영. 없거나, 깨졌거나, 읽기가 실패하면
  기본값 `'system'` 유지 — 앱 동작에 지장 없음.
- `setPreference()`: 상태를 즉시 반영(화면이 그 자리에서 전환)하고, 저장은 fire-and-forget
  `.catch()` — 저장 실패가 세션 중 동작을 막지 않는다.

## 테마 해석 — `src/theme/useTheme.ts` (수정)

```ts
const pref = useThemePreference((s) => s.preference);
const scheme = useColorScheme();
const mode: ThemeMode =
  pref === 'system' ? (scheme === 'light' ? 'light' : 'dark') : pref;
```

- 반환 시그니처 `{ mode, colors, cardShadow }` 불변 — 기존 호출부(홈·서재·알림·탭바·루트
  레이아웃) 변경 zero.
- '시스템' 선택 시 OS 설정 변경은 지금처럼 `useColorScheme()` 리렌더로 실시간 반영된다.

## 부팅 복원 — `app/_layout.tsx` (수정)

- 기존 ready 게이트의 `restore()`를 `Promise.all([auth.restore(), theme.restore()])`로 확장.
- 첫 렌더 전에 저장된 선호가 복원되므로 콜드 스타트 시 다크→라이트 깜빡임이 없다.

## '화면 테마' UI — 프로필 탭

- 위치: 알림 카드 아래, 로그아웃 영역 위.
- 형태: 카드 + `화면 테마` 아이브로 + 세그먼트 3버튼 `[시스템 | 라이트 | 다크]`
  + 헬퍼 문구 "시스템은 기기 설정을 따릅니다."
- 탭 즉시 적용. 선택 표시는 preference 기준(해석된 모드가 아니라) — '시스템' 선택 중
  다크로 보여도 '시스템'에 선택 표시.
- 접근성: 각 버튼에 `accessibilityRole="button"` + 선택 상태 라벨.

## 프로필 화면 테마 인식 전환

- 홈/서재 패턴을 따른다: 정적 `StyleSheet`는 레이아웃만, 색은 `useTheme()`로 받아 인라인 주입.
- 레거시 `colors` import(다크 고정 호환 레이어)를 profile.tsx에서 완전 제거.
- 프로필이 쓰는 다크 고정 프리미티브 8종(`Screen, Card, Eyebrow, KeyValue, Numeral, Rule,
  Button, Toggle`)은 profile.tsx 안에 같은 모양의 테마 인식 로컬 버전으로 대체한다.
  **`ui.tsx`는 건드리지 않는다** — 모든 레거시 화면이 공유하므로, 그걸 테마 인식으로 바꾸면
  화면 자체 스타일이 다크 고정인 레거시 화면들이 라이트 모드에서 반쯤 깨진다.
- 수용 기준: **다크 모드에서 현재와 픽셀 동일**. 레이아웃·타이포 변경 없음 — 레거시 `type`
  (시스템 폰트) 유지, 색상만 테마화. Pretendard 전환·레이아웃 개편은 추후 OTT 리디자인에서.

## 스코프 밖

- 프로필 화면의 전체 OTT 리디자인 (레이아웃·타이포·구성)
- 서버 저장(기기 간 동기화) — 필요해지면 백엔드 작업과 함께 별도 진행
- 크롬(헤더·탭바·상태바): 모드 무관 블랙 유지 — 브랜드 결정, 변경 없음
- 다른 레거시 화면(기록·모임·검색 등): 각자의 OTT 리디자인 때 테마 인식으로 전환

## 검증

- `npm run typecheck` — 유일한 자동 검증.
- `npm run web` 수동 확인: 시스템/라이트/다크 3모드 × 홈·서재·알림·프로필.
  '시스템' 선택 시 브라우저 `prefers-color-scheme` 에뮬레이션으로 추종 확인.
- 새로고침(재시작) 후 선택이 유지되는지, 로그아웃 후에도 유지되는지 확인.
- 테스트 스위트는 이 저장소에 없으므로 추가하지 않는다.
