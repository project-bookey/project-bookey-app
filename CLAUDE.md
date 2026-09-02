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

`npm run types` fetches `http://localhost:8080/openapi.json` (override with `BOOKEY_API_URL=... npm run types`), so the backend must be running first (`./mvnw spring-boot:run` in the backend repo).

## API contract — the one rule that matters

The only link between this repo and the backend is the server-published OpenAPI document. The type flow is:

1. `scripts/generate-api-types.mjs` → generates `src/api/generated.ts` (committed on purpose; never edit by hand)
2. `src/api/types.ts` — thin alias layer that re-exports generated schemas under app-friendly names (`Me`, `ReadingRecord`, `ClubHome`, ...)
3. App code imports only from `@/api/types` and `@/api/endpoints`

**Never hand-write server response fields.** If a type is missing, add an alias in `types.ts` pointing at `components['schemas'][...]`; if the schema itself is missing, regenerate. When the server API changes, rerun `npm run types` and commit the diff.

## Architecture

- **HTTP client** (`src/api/client.ts`): single `api<T>()` fetch wrapper. Resolves the base URL as `EXPO_PUBLIC_API_URL` → dev-server LAN host `:8080` (so Expo Go on a phone reaches the Mac) → `app.json` `extra.apiBaseUrl`. Attaches the Bearer token, and on a 401 performs exactly one token refresh shared across concurrent requests, then retries. Errors surface as `ApiError { status, code, message }`.
- **Endpoints** (`src/api/endpoints.ts`): all server calls grouped by domain (`authApi`, `bookApi`, `libraryApi`, `sessionApi`, `statsApi`, `clubApi`, `notificationApi`, `reviewApi`). New endpoints go here, not inline in screens.
- **Auth** (`src/store/auth.ts`): zustand store with `status: 'loading' | 'authenticated' | 'anonymous'`. Tokens persist via `src/store/tokenStorage.ts` — SecureStore on native, AsyncStorage on web. The root layout (`app/_layout.tsx`) awaits `restore()` before rendering anything; `app/index.tsx` redirects to `/home` or `/login` based on status. Login is currently dev-only (`provider: 'DEV'`).
- **Data fetching**: TanStack React Query; the `QueryClient` and all `Stack.Screen` registrations live in `app/_layout.tsx`. Screens are flat file-based routes under `app/` — there is no tab group.
- **Navigation**: the Stack sets `headerShown: false` globally — there is no native header anywhere. Each screen draws its own chrome: the five sections (서가 `/home` · 탐색 `/search` · 광장 `/plaza` · 모임 `/clubs` · 나 `/profile`) render `SectionNav` at the top (탐색 has no text label — it is entered from the home search bar; the logo mark also returns to 서가), and sub-screens render `SubHeader`. Screens still register a Korean `title`, which the web build uses as the browser tab title. Moving *between sections* uses `router.navigate` (or `replace` inside `SectionNav`) so the stack never stacks duplicate section entries; pushing to a sub-route (`/book/[id]`, `/quote/[id]`, `/library`, `/club/[id]`, `/timer`, ...) uses `router.push`.
- **Path alias**: `@/*` → `src/*`.

## Design system

The aesthetic is **collage desk** — books, memos and sticky notes scattered across a sheet of paper. Design spec: `docs/superpowers/specs/2026-09-01-collage-redesign-design.md`.

Tokens live in `src/theme/` and are re-exported from `src/theme/index.ts`:

- `palette.ts` — one semantic contract (`ColorTokens`) filled twice, `darkColors` / `lightColors`. Adding a key to only one palette fails typecheck, so the two can never drift. Read colors through `useTheme()`, never by importing a palette directly — that's how light mode breaks. Domain enums map to colors through the `getLagStyle(colors)` / `getPaceStyle(colors)` functions here (`statusLabel` is in `tokens.ts`).
- `tokens.ts` — mode-independent values. Type is three families: Pretendard (sans, body/UI), NanumMyeongjo (serif, 표제·섹션 헤딩·인용), IBM Plex Mono (아이브로우·라벨·숫자). Shape: pill (999) for chips and CTAs, near-square (`radius.md`/`lg`) for cards, `radius.sm` for book covers. Motion tokens for the collage feel: `tilt`/`tiltFor()` (cover rotation), `stagger` (entrance), `rowOffsetY` (row zigzag).

Shared primitives are in `src/components/ui.tsx` (`Card`, `Button`, `Tag`, `ProgressBar`, `Field`, `Segmented`, ...) and the collage-specific ones in `src/components/collage/` — `PaperScreen` (dot-grid paper background), `TiltCover` (tilted book cover), `SectionNav`, `SubHeader`, `MemoScrap`, `StickyNote`, `Chip`. Build new UI from these tokens and components — don't introduce ad-hoc colors, fonts, or radii.
