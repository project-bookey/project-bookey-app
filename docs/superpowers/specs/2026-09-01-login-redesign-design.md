# 로그인 화면 리디자인 + 소셜 로그인 3종 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰](2026-08-31-design-tokens-design.md) · [탭 해체](2026-09-01-tabless-nav-design.md)

## 목표

앱의 첫인상인 로그인 화면을 OTT 문법으로 전면 리디자인하고, 백엔드에 이미 구현돼 있는
카카오·애플·구글 소셜 로그인을 앱에서 **전부 실작동**하게 연결한다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 테마 | **다크 고정** (`darkColors` 직접 사용 — 히어로/배너와 같은 패턴, `useTheme()` 미사용) |
| 배경 | ~~브랜드 틸 그라데이션~~ → **플랫 다크 단색**(`darkColors.bg`) — 구현 후 사용자 결정(2026-09-01): "이전이 더 심플하고 좋다", 이전 레이아웃 전체 복귀. `brandGradientStops` 팔레트 승격은 유지(도서 상세 공유) |
| 로고 | ~~로고 이미지 중앙~~ → **좌측 "bookey" 워드마크 텍스트 + 밑줄 룰** (이전 레이아웃) + 기존 태그라인, 라벨 붙은 입력란 |
| CTA 우선순위 | **이메일 폼이 주인공** (accent CTA) → "또는" 구분선 → 소셜 버튼 보조 |
| 소셜 구성 | 애플(iOS만) → 카카오 → 구글 세로 스택. 사용자 결정: 3사 모두 유지 |
| 키 게이트 | 미설정 provider 버튼은 숨김. 단 `__DEV__`에선 "미설정" 안내 문구 노출(조용한 실종 방지) |
| 레거시 탈피 | `ui.tsx`(Screen/Button/Field/Rule) 미사용 — 화면 로컬 프리미티브로 재작성 |

## 백엔드 사실 확인 (2026-09-01 조사)

- `POST /api/v1/auth/social {provider: APPLE|GOOGLE|KAKAO, token, nickname?}` — 3사 검증기 실구현 완료.
  애플·구글은 **id_token**, 카카오는 **accessToken**을 보낸다. 서버 측 키 불필요.
- 애플 id_token에는 이름이 없다 → 최초 로그인 1회만 클라이언트에 오는 `fullName`을 `nickname`으로
  전달(성+이름 연접, 1차 구현 — 실데이터 확인 후 조정). 미전달 시 서버 fallback "독서가".
- **이전 세션의 "signup 500"은 오진**: git-bash curl이 한글을 CP949로 보낸 테스트 아티팩트.
  UTF-8 요청은 가입→로그인→`/me` 전부 정상(2026-09-01 실호출 확인). 남는 실제 결함은
  깨진 요청 본문이 400이 아닌 500으로 떨어지는 것 → `HttpMessageNotReadableException` 400 처리 추가.
- 시드 사용자에 password_hash가 없어 이메일 로그인 불가 → 시드에 BCrypt 해시 추가
  (`password1234`), 더미 서재 데이터가 있는 계정으로 바로 로그인 가능하게.

## 앱 구조

- `src/theme/palette.ts` — `brandGradientStops` export 신설, `app/book/[id].tsx`는 import로 교체.
- `src/store/auth.ts` — `googleLogin` 삭제 → 제네릭 `socialLogin(provider, token, nickname?)`
  (`authApi.socialLogin` 1:1 미러. 호출처는 login.tsx뿐).
- `src/hooks/useKakaoLogin.ts` (신규) — 공식 Expo 모듈이 없으므로 `expo-auth-session` 제네릭 코드 플로우:
  authorize/token = `kauth.kakao.com`, `clientId = EXPO_PUBLIC_KAKAO_REST_KEY`,
  `redirectUri = makeRedirectUri({ scheme: 'bookey', path: 'auth/kakao' })`, **`usePKCE: false`**
  (카카오 플로우에 PKCE 없음), cancel/dismiss는 null 반환(에러 아님), `exchangeCodeAsync` → accessToken.
  Client Secret 미사용(콘솔 OFF 전제 — expo의 `clientSecret` 필드는 Basic 헤더 방식이라 카카오와 불일치).
- 애플 — `expo-apple-authentication` 설치, `app.json`에 플러그인 + `ios.usesAppleSignIn: true`.
  iOS에서만 `require`(try/catch — Expo Go 안전), `isAvailableAsync()` 통과 시에만 공식
  `AppleAuthenticationButton`(WHITE, `cornerRadius: radius.md`) 렌더. `ERR_REQUEST_CANCELED`는 무시.
- `app/login.tsx` — 전면 리라이트. 레이아웃: 그라데이션 풀블리드 → 로고+태그라인 → 이메일 폼
  (이메일/비번, 가입 시 닉네임, 가입↔로그인 토글 유지) → "또는" hairline → 소셜 스택 →
  `__DEV__` 전용 API 주소·미설정 키 안내. 카카오 버튼 `#FEE500`/`#191919`, 구글 아웃라인.

## 플랫폼별 실작동 범위

| | 웹 | Expo Go | dev client |
|---|---|---|---|
| 이메일 | O (이번에 검증) | O | O |
| 구글 | O (클라이언트 ID 필요) | O | O |
| 카카오 | O (REST 키 + localhost redirect 등록) | 불가 — exp:// 임시 redirect는 카카오 정확일치 정책에 등록 불가 | O (`bookey://auth/kakao` 등록) |
| 애플 | 미노출 | iOS만 가능성 있음(모듈 포함 여부에 따라 — 게이트로 안전) | O (iOS 빌드는 macOS/EAS 필요) |

외부 설정(사용자 몫): `.env.local`에 `EXPO_PUBLIC_KAKAO_REST_KEY`·`EXPO_PUBLIC_GOOGLE_*` 추가,
카카오 콘솔 redirect URI 등록, Apple Developer capability. 등록 절차는 구현 완료 시 안내.

## 검증

- 백엔드: `HttpMessageNotReadableException` 단위 테스트 + `mvnw test` 회귀, curl 가입→로그인→`/me`.
- 앱: `npm run typecheck` + 웹(:8083) 실사용 — 시드 계정 이메일 로그인 → 홈 진입, 신규 가입 성공,
  레이아웃 육안(그라데이션·로고·소셜 스택·애플 부재·`__DEV__` 안내).
- 소셜 실로그인은 키 제공 시 웹에서 카카오·구글 검증. 애플은 iOS 빌드 환경 확보 후 수동 체크리스트.
