# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

bookey mobile app — iOS/Android/web, built with Expo (React Native) + expo-router + TypeScript (strict). One of three repos: the backend API lives in [project-bookey-backend](https://github.com/project-bookey/project-bookey-backend) (Spring Boot, port 8080) and the admin backoffice in [project-bookey-admin](https://github.com/project-bookey/project-bookey-admin). The app is useless without the backend running.

Code comments and all UI copy are written in Korean — follow that convention.

## Git 규칙

- 커밋 메시지·PR 본문에 AI 흔적을 절대 남기지 않는다. `Co-Authored-By: Claude ...` 트레일러, "Generated with Claude Code" 문구 등 어떤 형태의 어트리뷰션도 넣지 말 것. 커밋은 순수하게 변경 내용만 기술한다.
- 커밋은 의미 있는 변경끼리 확실히 묶는다 — 너무 잘게 쪼개지 않는다. 메시지는 사람이 읽고 바로 이해할 수 있게 쓰고, 첫 줄에서 해당 작업이 신규인지 수정인지 알 수 있게 한다 (예: `신규: ...` / `수정: ...`).
- 작업은 main에서 직접 하지 않고 작업별 브랜치를 만들어 진행한다. 작업이 완료되고 검증(typecheck 등)에 이상이 없으면 main에 머지한 뒤 해당 브랜치를 삭제한다.
- 브랜치 삭제는 사용자(bottleOne) 또는 Claude가 만든 브랜치에만 한다. 다른 사람이 만든 브랜치는 절대 삭제하지 않는다.

## Commands

```bash
npm start           # Expo Go / simulator
npm run web         # browser preview at http://localhost:8081
npm run typecheck   # tsc --noEmit — the only check; there is no lint config and no test suite
npm run types       # regenerate src/api/generated.ts from the backend's OpenAPI doc
```

### Expo 개발 서버 규칙 (2026-09-29)

- 사용자가 직접 띄운 Expo 웹 서버가 **8081**에 거의 항상 떠 있다. 앱을 확인하기 전에 `netstat -ano | findstr :8081`로 확인하고, 떠 있으면 `http://localhost:8081`을 그대로 쓴다.
- 절대 다른 포트(8099, 8100 등)로 서버를 하나 더 띄우지 않는다. Expo/Metro 서버 하나가 Node 힙 상한까지 자라기 때문에 중복 서버 두 개면 RAM 32GB가 바닥나고 "heap out of memory" 오류가 난다 (2026-09-29 실제 발생).
- 부득이하게 새로 띄웠다면 작업이 끝날 때 반드시 종료한다.

`npm run types` fetches `http://localhost:8080/openapi.json` (override with `BOOKEY_API_URL=... npm run types`), so the backend must be running first (`./mvnw spring-boot:run` in the backend repo).

## API contract — the one rule that matters

The only link between this repo and the backend is the server-published OpenAPI document. The type flow is:

1. `scripts/generate-api-types.mjs` → generates `src/api/generated.ts` (committed on purpose; never edit by hand)
2. `src/api/types.ts` — thin alias layer that re-exports generated schemas under app-friendly names (`Me`, `ReadingRecord`, `ClubHome`, ...)
3. App code imports only from `@/api/types` and `@/api/endpoints`

**Never hand-write server response fields.** If a type is missing, add an alias in `types.ts` pointing at `components['schemas'][...]`; if the schema itself is missing, regenerate. When the server API changes, rerun `npm run types` and commit the diff.

## Architecture

- **HTTP client** (`src/api/client.ts`): single `api<T>()` fetch wrapper. Resolves the base URL as `EXPO_PUBLIC_API_URL` (per-developer override in `.env.local`) → `app.json` `extra.apiBaseUrl`, which is the committed default and points at the deployed Cloud Run backend. The dev-server LAN host swap (so Expo Go on a phone reaches the Mac instead of itself) applies *only* when that default resolves to localhost — i.e. when you have deliberately pointed the app at a local backend. Attaches the Bearer token, and on a 401 performs exactly one token refresh shared across concurrent requests, then retries. Errors surface as `ApiError { status, code, message }`. When the body is a `FormData` (photo upload) the `Content-Type` header is omitted so the runtime attaches its own multipart boundary.
- **Endpoints** (`src/api/endpoints.ts`): all server calls grouped by domain (`authApi`, `bookApi`, `libraryApi`, `sessionApi`, `statsApi`, `clubApi`, `notificationApi`, `reviewApi`, `plazaApi`, `postApi`, `meetingNoteApi`). New endpoints go here, not inline in screens.
- **독후감 문장** (`src/components/post/postQuotes.ts`): there is no separate 밑줄(quote) feature any more (removed 2026-10-02, app and backend). A sentence from the book lives inside the 독후감 body as a column-0 `>` block whose last line may be `> — 출처` (책 제목 · 쪽); `PostBody` renders each block as a memo scrap with its text taken literally (not markdown), and the '+ 문장' sheet in `/post/new` inserts one via `insertBlock`. Old posts' `〖오려둔 문장 N〗` markers were converted server-side by backend migration V36 — don't bring 밑줄 back as its own entity.
- **Meeting shared note** (`app/club/[id]/note/[meetingId].tsx`): one large note per club meeting, edited by all members at once. `useMeetingNoteSync` (`src/components/club/`) diffs the editor doc into element-level ops (`noteOps.ts`: upsert/delete by element id, idempotent, last writer wins) and sends them over the WebSocket `/ws/clubs/{clubId}/meetings/{meetingId}/note` (auth = first message with the access token), falling back to REST `applyOps` + 5s polling when the socket is down. Remote ops land via `editor.applyRemote`, which never creates undo entries. The club '노트' tab shows these notes as a 3-column square grid (`MeetingNoteGrid`).
- **Auth** (`src/store/auth.ts`): zustand store with `status: 'loading' | 'authenticated' | 'anonymous'`. Tokens persist via `src/store/tokenStorage.ts` — SecureStore on native, AsyncStorage on web. The root layout (`app/_layout.tsx`) awaits `restore()` before rendering anything; `app/index.tsx` redirects to `/home` or `/login` based on status. Login is currently dev-only (`provider: 'DEV'`).
- **Data fetching**: TanStack React Query; the `QueryClient` and all `Stack.Screen` registrations live in `app/_layout.tsx`. Section screens live in the `app/(tabs)/` group (its `_layout.tsx` draws the bottom `SectionNav`); sub-screens are flat file-based routes under `app/`.
- **Navigation**: the Stack sets `headerShown: false` globally — there is no native header anywhere. Each screen draws its own chrome: the five sections (광장 `/plaza` · 서가 `/home` · 모임 `/clubs` · 메신저 `/messenger` · 나 `/profile`) render `BrandHeader` at the top and share the bottom `SectionNav` (탐색 `/search` lives in the group without a tab — it is entered from the home search bar), and sub-screens render `SubHeader`. 설정 `/settings` is a sub-screen, entered from the gear button in the 나 profile row — it is not a tab. 메신저 groups the 엽서함 and 채팅 lists as segments; the old `/postcards` and `/chats` routes redirect into it. Screens still register a Korean `title`, which the web build uses as the browser tab title. Moving *between sections* uses `router.navigate` (or `replace` inside `SectionNav`) so the stack never stacks duplicate section entries; pushing to a sub-route (`/book/[id]`, `/post/new`, `/post/[id]`, `/post/mine`, `/library`, `/club/[id]`, `/timer`, ...) uses `router.push`.
- **Path alias**: `@/*` → `src/*`.

## Design system

The aesthetic is **collage desk** — books, memos and sticky notes scattered across a sheet of paper. Design spec: `docs/superpowers/specs/2026-09-01-collage-redesign-design.md`.

Tokens live in `src/theme/` and are re-exported from `src/theme/index.ts`:

- `palette.ts` — one semantic contract (`ColorTokens`) filled twice, `darkColors` / `lightColors`. Adding a key to only one palette fails typecheck, so the two can never drift. Read colors through `useTheme()`, never by importing a palette directly — that's how light mode breaks. Domain enums map to colors through the `getLagStyle(colors)` / `getPaceStyle(colors)` functions here (`statusLabel` is in `tokens.ts`).
- `tokens.ts` — mode-independent values. Type is three families: Pretendard (sans, body/UI), NanumMyeongjo (serif, 표제·섹션 헤딩·인용), IBM Plex Mono (아이브로우·라벨·숫자 — Korean gets tight tracking, `letterSpacing` ≤ 1). Shape is **square paper cut** (2026-09-28): `radius.sm` (2) for chips, buttons, tags, inputs and book covers, `radius.md` (4) for cards, `radius.lg` (6) for sheets; `radius.round` only for avatars, dots and radios. There is no pill token — never write `borderRadius: 999` or a literal radius. Selection states (chips, segments, calendar days, reactions, radios) invert to ink via `colors.ink`/`onInk`; `accent` is reserved for CTAs, progress and links. Line icons spread `iconStroke` (square caps, miter joins) and are drawn with react-native-svg — no emoji in chrome. There is no elevation: paper is separated by hairline borders only — `cardShadow`/`coverShadow` in `palette.ts` are intentionally empty (blur shadows and hard paper edges were both tried and rejected), so never add `shadow*`/`elevation`/`boxShadow` styles. Press feedback everywhere (Button, text links, chips, rows, icon buttons) is `pressedStyle` (opacity 0.72) — no spring scale, no translate, no ad-hoc opacity values. Link labels go through `linkLabel(label, kind)` in ui.tsx: navigation links end with " ›", in-place actions (더 보기, 다시 시도, 쓰기) carry no glyph, "→" is only a range separator (기간·쪽수), Button labels never carry glyphs, and "▶" comes from `playLabel` on read/resume CTAs only. Motion tokens for the collage feel: `tilt`/`tiltFor()` (cover rotation), `stagger` (entrance), `rowOffsetY` (row zigzag).

Shared primitives are in `src/components/ui.tsx` (`Card`, `Button`, `Tag`, `ProgressBar`, `Field`, `Segmented`, ...) and the collage-specific ones in `src/components/collage/` — `PaperScreen` (dot-grid paper background), `TiltCover` (tilted book cover), `SectionNav` (flat bottom bar on a hairline, active = ink label + 2px accent marker), `SubHeader`, `MemoScrap`, `StickyNote`, `Chip`. Build new UI from these tokens and components — don't introduce ad-hoc colors, fonts, or radii.

## 모바일 앱 디자인 원칙

bookey는 **휴대폰에서 한 손으로 쓰는 앱**이 1순위다. 웹(`npm run web`)은 확인용 미리보기일 뿐이니, 데스크톱 브라우저 화면 기준으로 레이아웃을 잡지 않는다. 새 화면·컴포넌트를 만들거나 손볼 때 아래를 지킨다.

### 화면 크기·레이아웃

- 기준 폭은 **360~430pt 세로 화면**이다. 가장 좁은 360pt에서 글자가 잘리거나 두 줄로 깨지지 않는지 먼저 본다. 가로 모드는 고려하지 않는다.
- 폭은 고정 px로 박지 말고 `flex`·퍼센트·`useWindowDimensions()`로 잡는다. 태블릿·웹에서 퍼지지 않도록 본문은 `layout.content`(maxWidth 560, 가운데 정렬)로 감싼다.
- 좌우 여백·간격은 `spacing` 토큰만 쓴다. 한 화면 안에서 좌우 여백은 통일한다.
- 한국어 문구는 길어지기 쉽다 — 버튼·칩·탭 라벨은 짧게 쓰고, 넘칠 수 있는 텍스트에는 `numberOfLines` + 말줄임을 건다. 책 제목·닉네임처럼 사용자 입력 값은 항상 길 수 있다고 가정한다.

### 세이프에어리어·시스템 UI

- 노치·다이내믹 아일랜드·홈 인디케이터를 피한다. 상단은 `PaperScreen withTopInset` 또는 `SubHeader`/`BrandHeader`가, 하단은 `SectionNav`가 `useSafeAreaInsets()`로 처리한다. 이 셸들을 거치지 않는 화면(모달·시트·전체화면 노트 등)은 직접 인셋을 준다.
- 하단 고정 CTA·입력창은 `insets.bottom`만큼 띄우고, 스크롤 콘텐츠 마지막에는 `SectionNav`·고정 버튼에 가리지 않을 만큼 하단 패딩을 둔다.
- 상태 표시줄 색(밝음/어두움)은 현재 테마 모드를 따른다.

### 터치·조작

- 터치 영역은 **최소 44×44pt**. 아이콘 버튼처럼 눈에 보이는 크기가 작으면 `hitSlop`으로 넓힌다. 인접한 터치 대상끼리는 최소 `spacing.sm` 이상 떨어뜨려 오터치를 막는다.
- 자주 누르는 주요 동작(저장, 기록 시작, 보내기)은 엄지가 닿는 화면 하단 쪽에 둔다. 화면 상단 구석에는 파괴적이거나 자주 쓰는 동작을 두지 않는다.
- hover에 기대는 UI는 만들지 않는다(모바일엔 hover가 없다). 툴팁·마우스 오버로만 드러나는 정보·버튼 금지.
- 눌림 피드백은 `pressedStyle` 하나로 통일한다(Design system 참고). 삭제·나가기처럼 되돌릴 수 없는 동작은 확인 단계를 거친다(`ConfirmButton` 등).
- 제스처(스와이프 탭, 노트 줌 등)는 항상 눈에 보이는 버튼 대안과 함께 둔다. 제스처만으로 할 수 있는 기능은 만들지 않는다. 시스템 뒤로 가기 제스처(iOS 가장자리 스와이프, Android 뒤로 버튼)와 충돌하지 않게 한다.

### 키보드·입력

- 입력이 있는 화면은 `KeyboardAvoidingView`(또는 기존 화면 패턴)로 키보드가 입력창·보내기 버튼을 가리지 않게 한다. iOS/Android 동작 차이(`behavior`)를 확인한다.
- 입력창이 있는 스크롤 뷰에는 `keyboardShouldPersistTaps="handled"`를 준다 — 안 주면 키보드가 떠 있을 때 버튼 첫 탭이 먹히지 않는다.
- 용도에 맞는 `keyboardType`·`returnKeyType`·`autoCapitalize`·`autoCorrect`를 지정한다(쪽수=숫자 키패드, 닉네임=자동 대문자 끔 등).
- 긴 글 작성(독후감·노트) 중 이탈할 때 작성 내용이 날아가지 않도록 신경 쓴다.

### 목록·성능

- 길이가 정해지지 않은 목록(피드, 댓글, 채팅, 서가)은 `ScrollView` + `map` 대신 `FlatList` 계열을 쓴다. 저사양 Android에서 스크롤이 버벅이지 않는지를 기준으로 삼는다.
- 책 표지 등 이미지는 표시 크기에 맞게 받고, 로딩 중·실패 시 자리 표시(빈 표지)를 보여 레이아웃이 튀지 않게 한다.
- 애니메이션은 `motion` 토큰 길이 안에서, 가능하면 네이티브 드라이버로 돌린다. 장식용 모션(tilt·stagger)은 스크롤·입력 반응성을 해치지 않는 선에서만 쓴다.

### 상태·네트워크

- 모든 데이터 화면은 **로딩 / 빈 상태 / 오류(다시 시도)** 세 가지를 갖춘다. 빈 상태 문구는 다음 행동을 안내한다.
- 모바일 네트워크는 느리고 끊긴다. 버튼은 요청 중 비활성화해 중복 전송을 막고, 당겨서 새로고침(`RefreshControl`)을 목록 화면에 기본으로 둔다.

### 플랫폼 차이

- iOS·Android·웹 세 곳에서 모두 돌아야 한다. 플랫폼별로 갈라야 하면 `Platform.OS` 분기보다 `*.web.tsx` 같은 파일 분리를 우선한다(예: `DotGridBackground.web.tsx`).
- 웹에서만 확인하고 끝내지 않는다. 폰트 렌더링·키보드·세이프에어리어·스크롤 동작은 네이티브에서 다르게 보이므로, 레이아웃에 영향이 있는 변경은 Expo Go(실기기 또는 시뮬레이터)에서도 확인하거나 확인하지 못했다고 명시한다.
- 네이티브 전용 API(SecureStore, 햅틱, 파일 등)는 웹 대체 경로가 있는지 확인한다.

### 접근성

- 아이콘만 있는 버튼에는 한국어 `accessibilityLabel`을, 누를 수 있는 요소에는 `accessibilityRole`을 단다.
- 시스템 글자 크기를 키워도 핵심 화면이 깨지지 않게 한다 — 텍스트 박스에 고정 높이를 주지 않는다.
- 글자·배경 대비는 다크/라이트 두 모드 모두에서 확인한다. 색만으로 상태를 구분하지 않는다(라벨·아이콘 병행).
