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
- **Endpoints** (`src/api/endpoints.ts`): all server calls grouped by domain (`authApi`, `bookApi`, `libraryApi`, `sessionApi`, `statsApi`, `clubApi`, `notificationApi`, `reviewApi`, `plazaApi`, `postApi`, `meetingNoteApi`, `inquiryApi`, `faqApi`). New endpoints go here, not inline in screens.
- **독후감 문장** (`src/components/post/postQuotes.ts`): there is no separate 밑줄(quote) feature any more (removed 2026-10-02, app and backend). A sentence from the book lives inside the 독후감 body as a column-0 `>` block whose last line may be `> — 출처` (책 제목 · 쪽); `PostBody` renders each block as a memo scrap with its text taken literally (not markdown), and the '+ 문장' sheet in `/post/new` inserts one via `insertBlock`. Old posts' `〖오려둔 문장 N〗` markers were converted server-side by backend migration V36 — don't bring 밑줄 back as its own entity. Photos live in the body too (`postPhotos.ts`): the editor's '+ 사진' (bottom bar, beside '+ 문장') puts a `![사진](upload:<key>)` line at the caret, swapped for `![사진](image:<id>)` at submit, and `imageIds` are sent in body order so the first photo in the body is the card poster. `PostBody` draws each photo line where it stands; photos with no line (posts from before inline photos) render before the body, and editing such a post seeds them as lines at the top. The server's `PostExcerpt` drops image syntax, so photo lines never reach excerpts.
- **Meeting shared note** (`app/club/[id]/note/[meetingId].tsx`): one large note per club meeting, edited by all members at once. `useMeetingNoteSync` (`src/components/club/`) diffs the editor doc into element-level ops (`noteOps.ts`: upsert/delete by element id, idempotent, last writer wins) and sends them over the WebSocket `/ws/clubs/{clubId}/meetings/{meetingId}/note` (auth = first message with the access token), falling back to REST `applyOps` + 5s polling when the socket is down. Remote ops land via `editor.applyRemote`, which never creates undo entries. The club '노트' tab collects these notes in one place as a 3-column square grid, Instagram-profile style (`MeetingNoteGrid`; cells not yet finished show '작성 중'). The editor keeps a '저장하고 나가기' button above the toolbar for everyone (it waits for `useMeetingNoteSync().drain()` to confirm the server has every edit, and stays put with a notice if offline). The meeting's creator (or the club host) also gets '노트 마무리' (`MeetingNote.canClose`): after a confirm it drains, calls `meetingNoteApi.close`, and the note becomes read-only for everyone — open editors get a `closed` socket message and lock immediately.
- **Club model** (2026-10-03): a club has no period (no D-day, no end date — it runs until the host ends it) and is not tied to one book. Each meeting may pick a book (optional, from the user's 서재 via `MeetingBookPicker`), and the server keeps the club's **current book** = the book of the nearest upcoming meeting that has one (the whole meeting day still counts as upcoming), else the latest past one; `ClubHome.book` / `ClubSummary.book` are that current book (null until a meeting picks one). When it changes, the server re-links every member's reading record to the new book (adding it to their 서재 as 읽고 싶은), so progress, spoiler masking and 지금 읽는 중 all follow the current book; 조각 written for an earlier book are still masked by the viewer's page in *that* book. Checkpoints and 결산 were removed; `daysLeft`, `checkpoints` and `nextCheckpoint` remain in the API only for old app builds — don't use them. Use `nextMeetingAt` for "다음 모임". Meetings may set `maxAttendees` (optional, ≥ 2; the server locks the meeting row and refuses joins with `MEETING_FULL` once full, and refuses shrinking below current attendees). The club list card (`ClubCard`) and home's 추천 클럽 row show no book — the club's background photo (or a serif monogram), one-line intro, people and the meeting that matters to me: the sticky date is **my** nearest upcoming meeting — the earliest OPEN meeting I said 참여해요 to (`ClubSummary.myNextMeetingAt`); with none, there is no sticky. The card has no meeting text line — '참여할 모임 · …' and '다음 모임 · …' were both removed by user request (2026-10-04), so the sticky date is the only meeting info. The host's '관리' button sits at the right end of the '함께하는 사람' line, not on a line of its own.
- **Club home** (`app/club/[id]/index.tsx`): the head stays above the three tabs 홈 · 모임 · 노트 (`ClubTabs`) and is the club's face: name, one mono line (호스트 · 멤버 n/limit · 공개), the one-line intro (`description`, capped at `CLUB_DESCRIPTION_MAX` = 50 chars on both server and app, clipped to 2 lines for old long ones, no 더 보기; hosts with none get '한 줄 소개 적기'), and '함께하는 사람' as a small overlapping-avatar stack that opens 클럽 정보. The club's backdrop (`ClubBackdrop`: the host's uploaded photo `backgroundUrl`, or — when none — a default drawn from theme tokens only — one of four book-club scenes, 모임 테이블 · 책장 · 책갈피 리본 · 독서 타이머 책상, each with a green sticky, picked by club id so a club always gets the same one and neighbours in the list differ) sits behind the SubHeader and head under a paper-colored gradient so the text stays legible; the same backdrop fills the list card band, home's 추천 클럽 band and the settings preview. Hosts get a '정보 수정' button beside the club name (also the list card's '관리' button and the gear on 클럽 정보) leading to `/club/[id]/settings`, whose top is a live preview of the head (backdrop + the name and intro being typed) with '배경 사진 고르기 / 사진 바꾸기 / 기본 배경으로' (`clubApi.uploadBackground` / `removeBackground`, resized by `prepareImage`). The 홈 tab stacks '다가오는 모임' — every OPEN meeting from today on (`isTodayOrLater` in `meetingTime.ts`; a meeting that already started today stays, marked 진행 중), up to 4 with '모두 보기' to the 모임 tab, each a card whose body opens the meeting and whose right side is the join state ('참여하기' as an outline button, or 참여해요 · 정원 마감 · 응답 마감); a meeting I'm attending gets an accent (green) border, and the 모임 tab boxes my today-or-later meetings the same way with the state '참여해요'; hosts with none get '모임 만들기', which opens the 모임 tab with the form expanded — then the 3 latest notes (`MeetingNoteCell`), and — only when the club has a current book — '읽기 조각': reading-now line plus the 3 latest 조각 as one-line rows (`LogLine`) and '한 조각 남기기'. There is no separate 소식 feed tab any more; 조각 are still written after a timer session (the timer hands off to `/club/[id]/log/new`). `useClubLogFeed` (`src/components/clubLog/queries.ts`) finds recent 조각: the server has no list endpoint for LOG posts (the `/posts` feed excludes them), so it walks back 14 days at a time with `logDays` and loads each non-empty day with `logs`. Club chat is not a tab: it is its own full screen `/club/[id]/chat`, opened from the header speech-bubble icon (unread badge from `chatState`), shaped like the 1:1 room so the keyboard never competes with the club head and a tab swipe can't drop a draft; old `?tab=chat` links push it over the home. Members (progress · 찌르기), 이번 주 카드, invite code and 나가기 live on 클럽 정보 `/club/[id]/info` (⋯ or 함께하는 사람); host operations stay in `/club/[id]/settings` (the gear on 클럽 정보).
- **고객문의 · FAQ** (`app/inquiry/`, `src/components/inquiry/`): 설정 › '고객문의' opens `/inquiry` — two segments 자주 묻는 질문 (FAQ accordion grouped by category, edited in the admin) | 내 문의 (newest first, 답변 대기/답변 완료) over one primary '문의하기'. `/inquiry/new` is one screen: category chips (server order from `inquiryApi.categories`, first = default), body (≤2000), up to 3 photos (`usePhotoUploads` with `inquiryApi.uploadImage`), and the app version/OS/model attached automatically (`deviceInfo.ts`, shown in a caption); the label is '보내기' (it goes to staff, not a public post), unsent text survives a back-out in a module-memory draft, and `?category=&body=` prefills it (도서 상세's '관리자에게 문의하기'). Sending replaces the screen with `/inquiry/[id]`. 1문 1답: an admin answer arrives as `INQUIRY_ANSWERED` (payload `inquiryId` → `/inquiry/[id]`); edits show '수정됨' and don't notify again. The user can delete an inquiry before or after the answer.
- **한 마디** (`src/components/remark/`, 2026-10-04): a one-line note (≤ `REMARK_MAX` = 60 chars, server and app) left when a book is finished or abandoned — one per reading record (회차), upserted via `libraryApi.saveRemark` (`PUT /library/{recordId}/remark`, refused with `REMARK_NOT_CLOSED` unless the record is FINISHED/ABANDONED; the stored `kind` follows the record's status at write time, and rewriting moves it to the front). 도서 상세 shows everyone's as '독자들의 한 마디' (`RemarkTicker`, under the stat strip): newest first, one memo at a time, rotating every 5s like home's '오늘의 글'; tapping advances, it stops auto-rotating while a screen reader is on (`useScreenReaderEnabled` — the `.web.ts` returns false because react-native-web always reports true), and it renders every line invisibly to lock the box to the tallest so the page doesn't jump. It is asked at the moment of closing: finishing (the in-page '완독 처리' or the timer's `finished=1`) makes `FinishReviewSheet` ask 한 마디 first (`remarkStep`, '건너뛰기') and then the review; abandoning opens `RemarkSheet`. Afterwards '내 한 마디' in the 내 진척 card (`MyRemark`) writes, edits or deletes it.
- **Auth** (`src/store/auth.ts`): zustand store with `status: 'loading' | 'authenticated' | 'anonymous'`. Tokens persist via `src/store/tokenStorage.ts` — SecureStore on native, AsyncStorage on web. The root layout (`app/_layout.tsx`) awaits `restore()` before rendering anything; `app/index.tsx` redirects to `/home` or `/login` based on status. Login (`app/login.tsx`, dark-only) is email-first: email + password sign-in, and email sign-up whose verification follows the server's `authApi.signupConfig()` — `IDENTITY` (phone identity check; `identityDevStub` passes it instantly in dev), `EMAIL_CODE` (6-digit code, `requestEmailCode`) or `NONE` — plus the required terms/privacy consent (each document must be read to the end; kept by user decision). 비밀번호 찾기 is `/password-reset` (dark-only like login, opened from the '비밀번호 찾기 ›' link under the login password field with the typed email): ① `authApi.requestPasswordResetCode` sends a 6-digit code to a registered email (`EMAIL_NOT_REGISTERED` otherwise; local servers return `devCode`, auto-filled) ② code + new password → `resetPassword`, which logs the user straight in (the server revokes every other session) and goes to `/home` with the login screen dismissed. A social-only account with an email gets a password this way. The Apple · Kakao · Google buttons call `socialLogin` (`POST /api/v1/auth/social`): a linked social account signs in, and an unseen one is signed up on the spot (`newUser`, a password-less social-only account); if its email matches an existing account the server refuses with `EMAIL_ALREADY_EXISTS` instead of merging. So email users link their social accounts in 설정 › 소셜 로그인 연동 (`SocialLinkCard` in `app/settings.tsx` → `authApi.linkSocial` / `unlinkSocial`), which reads `Me.linkedProviders` and `Me.hasPassword`; the server blocks removing a password-less account's last link (`LAST_LOGIN_METHOD`) and the card disables that 해제 too. Provider tokens for login and linking come from `src/hooks/useSocialTokens.ts` (Apple module, Google client IDs, Kakao). After sign-up (or a social `newUser`), the onboarding picks from `/onboarding` (preferred categories and books, added as 읽고 싶은) are applied, then the new account goes through the profile-basics step `/profile-photo` (gender, birth date, optional photo; '나중에 하기' skips to `/home`). The same screen opened with `returnTo=profile` (from the 나 avatar) is the photo-only change mode. The app tour (`AppTourOverlay`) waits while the user is on `/login`, `/onboarding` or `/profile-photo`, and starts once they reach the app.
- **Data fetching**: TanStack React Query; the `QueryClient` and all `Stack.Screen` registrations live in `app/_layout.tsx`. Section screens live in the `app/(tabs)/` group (its `_layout.tsx` draws the bottom `SectionNav`); sub-screens are flat file-based routes under `app/`.
- **Navigation**: the Stack sets `headerShown: false` globally — there is no native header anywhere. Each screen draws its own chrome: the five sections (광장 `/plaza` · 클럽 `/clubs` · 서가 `/home` · 메신저 `/messenger` · 나 `/profile`) render `BrandHeader` at the top and share the bottom `SectionNav`, and sub-screens render `SubHeader`. 탐색 `/book-search` is a full stack screen entered from the home search bar (its exit is the '취소' beside the search field). 클럽 is the list only — 코드로 참가 `/club/join` and 클럽 만들기 `/club/create` (one screen: name · intro · size · public — no book or period) are pushed screens, the same ones home's club row opens. Section screens end their scroll content with `NAV_CLEARANCE` (from `@/components/collage`) so the floating bar never covers the last item. 설정 `/settings` is a sub-screen, entered from the gear button in the 나 profile row — it is not a tab. 메신저 groups the 엽서함 and 채팅 lists as segments; the old `/postcards` and `/chats` routes redirect into it. Screens still register a Korean `title`, which the web build uses as the browser tab title. Moving *between sections* uses `router.navigate` (or `replace` inside `SectionNav`) so the stack never stacks duplicate section entries; pushing to a sub-route (`/book/[id]`, `/post/new`, `/post/[id]`, `/post/mine`, `/library`, `/club/[id]`, `/timer`, ...) uses `router.push`.
- **Path alias**: `@/*` → `src/*`.

## UX 철칙 — 디자인·서비스 구조의 다섯 법칙

화면·컴포넌트·플로우·내비게이션 구조를 만들거나 고칠 때 **예외 없이** 지킨다. 아래 Design system과 "모바일 앱 디자인 원칙"은 이 다섯 법칙을 구체화한 규칙이다. 요청이 법칙과 부딪치면(예: 한 화면에 CTA 버튼 셋) 그대로 만들지 말고, 어느 법칙과 충돌하는지 짚은 뒤 대안을 제안한다.

1. **Hick — 선택을 줄인다.** 한 화면의 주요 행동은 하나다. 지금 단계에 필요 없는 선택지는 다음 단계로 미루거나 '더 보기'·시트 뒤로 숨긴다. 고를 것이 있으면 가장 흔한 값을 기본값으로 미리 선택해 둔다. 탭·세그먼트·메뉴·설정 항목을 늘리려면 기존 항목을 합치거나 빼는 방안부터 검토한다. 하단 `SectionNav`의 다섯 섹션이 상한이다.
2. **Fitts — 누르기 쉽게 만든다.** 터치 영역은 최소 44×44pt로 하고, 작은 아이콘은 `hitSlop`으로 넓힌다. 주요 동작은 크게 만들어 엄지가 닿는 화면 하단에 두고, 자주 함께 쓰는 동작끼리는 가까이 둔다. 삭제·나가기 같은 파괴적 동작은 주요 버튼에서 떨어뜨린다. 세부 규칙은 "터치·조작"을 따른다.
3. **Jakob — 익숙한 방식으로 만든다.** 사용자는 다른 앱에서 익힌 방식대로 이 앱을 쓴다. 하단 탭 이동, 좌상단 뒤로 가기, 당겨서 새로고침, 아래에서 올라오는 시트처럼 iOS·Android 표준 패턴과 널리 쓰이는 앱의 관례를 먼저 쓴다. 콜라주 미감은 겉모습에만 적용하고 조작 방식은 표준을 따른다. 새 인터랙션을 만들기 전에 표준 패턴으로 풀리는지부터 확인하고, 같은 동작은 앱 전체에서 같은 위치·같은 방식·같은 문구로 만든다.
4. **Proximity — 간격으로 관계를 보여준다.** 서로 관련된 요소(제목과 설명, 라벨과 입력창, 버튼과 그 버튼이 다루는 대상)는 가깝게 두고, 다른 그룹과는 멀리 띄운다. 그룹 안 간격은 언제나 그룹 사이 간격보다 작아야 한다. 예를 들어 그룹 안은 `spacing.xs`~`sm`, 항목 사이는 `md`~`lg`, 섹션 사이는 `xl`로 둔다. 구분선이나 박스를 더하기 전에 간격만으로 묶음이 읽히는지 먼저 본다.
5. **Von Restorff — 중요한 것 하나만 강조한다.** 한 화면에서 눈에 띄는 요소는 하나뿐이다. `accent`로 채운 `Button variant="primary"`는 화면당 하나만 두고, 나머지 버튼은 `outline`·`ghost`로 낮춘다. 강조색·굵은 글씨·큰 글자를 여러 곳에 흩뿌리지 않는다. 모두 강조하면 아무것도 강조되지 않는다.

새 화면을 마치면 다섯 가지를 차례로 점검한다. 주요 행동이 하나인가? 엄지로 쉽게 누를 수 있는가? 처음 보는 사람도 조작법을 아는가? 간격만으로 묶음이 보이는가? 강조가 하나뿐인가?

### 같은 동작은 같은 방식으로 (Jakob — 앱 안의 일관성)

- **버튼 순서**: `[취소/이전][주요 버튼]` — 주요 버튼이 오른쪽. 주요 버튼 옆 취소·이전은 `variant="outline"`.
- **삭제 확인**: 내가 쓴 것(독후감·댓글·엽서·채팅·알림·조각·한 마디)은 `useDeleteConfirm`로 두 번 누른다 — 라벨 '삭제' → '한 번 더'(보통 `FootAction`). 계정·클럽 단위로 되돌릴 수 없는 동작(계정 삭제, 클럽 나가기·종료, 모임 취소, 호스트 넘기기)은 `confirmAsync`(`@/components/club`) 확인 창. `Alert.alert`로 버튼 대화상자를 직접 띄우지 않는다 — 웹에서 뜨지 않는다.
- **제출 라벨**: 긴 글을 처음 내보낼 땐 '올리기', 고칠 땐 '저장', 짧은 글(댓글·한 마디·리뷰)은 '남기기'.
- **독서 시작**: 읽기를 시작·재개하는 버튼은 모두 `playLabel('독서 시작')`(홈 히어로는 '▶ 이어서'). 누르면 `/timer?recordId=…&autoStart=1`로 보내 타이머가 바로 잰다 — 타이머에서 한 번 더 누르게 하지 않는다.
- **제스처**: 밀어서 지우기 같은 제스처에는 늘 눈에 보이는 버튼을 함께 둔다.

### 사용자 결정으로 둔 예외 (2026-10-03)

UX 철칙을 적용하다가도 아래는 바꾸지 않는다 — 사용자가 직접 정했다.

- **초록(accent)을 유지하는 곳**: 하단 구역 탭(아이콘만, 활성은 초록 아이콘), 탭 밑줄 표시(클럽 홈·도서 상세의 리뷰/독후감 탭), 알림 숫자 배지, 좋아요 하트(켜짐 상태), 스티키 메모, 내가 참여한 모임의 테두리(클럽 홈 '다가오는 모임' 카드·모임 탭 줄 — '참여해요' 글자와 함께). CTA 와 같은 색이어도 '한 화면 하나만 강조'의 예외로 본다.
- **가입 필수 약관**: 전문을 끝까지 읽어야 동의되는 지금 방식을 유지한다. 체크박스를 바로 누르게 바꾸지 않는다.
- **좋아요는 하트** (2026-10-04): 독후감·책·조각 반응 어디서나 좋아요는 하트 아이콘(lucide `Heart` + `iconStroke`) + 숫자로 그린다 — 누르는 자리는 `LikeAction`(도서 상세 히어로는 같은 하트를 테두리 상자에), 표시만 하는 메타 줄은 `LikeCount`(`src/components/post/`). 켜지면 하트를 초록으로 채운다(조각 반응 칩만 다른 반응처럼 잉크로 뒤집혀 하트를 `onInk`로 채운다). '좋아요 N' 글자나 ♥·♡ 글리프로 되돌리지 않는다.
- **독후감 조회수** (2026-10-04): 어디서나 눈 아이콘 + 숫자로 둔다 — 카드 발치는 좋아요 하트 옆에 하트 크기로, 상세 작성자 줄 같은 메타 줄은 `ViewCount`(`src/components/post/`)로. 하트처럼 눌러 볼 것 같다는 이유로 '조회 N' 글자로 바꾸지 않는다.
- **리뷰는 반듯하게** (2026-10-04): 리뷰 조각(`ReviewScrap`)과 리뷰 상세 카드(`ReviewCard`)는 기울이지 않는다 — 콜라주 미감이라도 리뷰 목록·상세에 회전을 다시 넣지 않는다. 리뷰 쓰는 칸도 같은 조각 모양(점선 메모)으로 반듯하게 둔다.
- **닉네임 옆 프로필 편집 연필** (2026-10-04): '나' 화면 닉네임 옆 연필(`MyPage` `editButton`)은 테두리 상자 없이 회색(`textMuted`) 19px 아이콘으로 둔다 — '누를 수 있는 것은 `control` 테두리' 규칙의 예외. 상자를 다시 씌우지 않는다.
- **서체** (2026-10-04): 본문·라벨·숫자는 IBM Plex Sans KR, 표제·인용은 마루 부리 — 시안에서 여러 조합을 비교한 뒤 사용자가 골랐다. 라벨·아이브로우를 다시 모노 서체로 되돌리지 않는다.
- **토큰 밖 숫자 간격**: 리듬 간격(8px 이상)은 `spacing` 토큰(합도 허용: `spacing.lg + spacing.xs`)으로 쓴다. 1~6px 의 광학 보정(라벨↔값 2px 등)과, 다른 요소 크기에 맞춘 값(고정 CTA·탭 바에 가리지 않게 비우는 하단 여백, 핀 가운데 맞춤, 터치 상자를 넓히는 여백/음수 마진 짝)은 숫자를 그대로 쓴다.

## Design system

The aesthetic is **collage desk** — books, memos and sticky notes scattered across a sheet of paper. Design spec: `docs/superpowers/specs/2026-09-01-collage-redesign-design.md`.

Tokens live in `src/theme/` and are re-exported from `src/theme/index.ts`:

- `palette.ts` — one semantic contract (`ColorTokens`) filled twice, `darkColors` / `lightColors`. Adding a key to only one palette fails typecheck, so the two can never drift. Read colors through `useTheme()`, never by importing a palette directly — that's how light mode breaks. Domain enums map to colors through the `getLagStyle(colors)` / `getPaceStyle(colors)` functions here (`statusLabel` is in `tokens.ts`).
- `tokens.ts` — mode-independent values. Type is two families (2026-10-04): IBM Plex Sans KR (sans — body/UI, and also 아이브로우·라벨·숫자 through the `mono` tokens, which kept their name but now point at Plex Sans KR one weight heavier; Korean gets tight tracking, `letterSpacing` ≤ 1; its digits are all one width, so ticking numbers like the timer don't jitter) and Maru Buri (serif, 표제·섹션 헤딩·인용). Both ship as files in `assets/fonts`, loaded in `app/_layout.tsx`. IBM Plex Mono survives only as `noteMono`, the '모노' choice for meeting-note text — never use it for app chrome. Shape is **square paper cut** (2026-09-28): `radius.sm` (2) for chips, buttons, tags, inputs and book covers, `radius.md` (4) for cards, `radius.lg` (6) for sheets; `radius.round` only for avatars, dots and radios. There is no pill token — never write `borderRadius: 999` or a literal radius. Selection states (chips, segments, capsule tabs, toggles, calendar days, reactions, radios) invert to ink via `colors.ink`/`onInk` (liked hearts and the active section/tab markers stay accent — see '사용자 결정으로 둔 예외'); `accent` is reserved for CTAs, progress and links — `Eyebrow` is always muted (there is no accent eyebrow), and in-place confirms (`ConfirmButton`) use ink, not accent. Line icons spread `iconStroke` (square caps, miter joins) and are drawn with react-native-svg — no emoji in chrome. There is no elevation: paper is separated by hairline borders only — `cardShadow`/`coverShadow` in `palette.ts` are intentionally empty (blur shadows and hard paper edges were both tried and rejected), so never add `shadow*`/`elevation`/`boxShadow` styles. **Anything pressable is bordered in `colors.control`** (2026-10-04) — outline buttons, chips, toggles, segments, `FootAction`, `NoteAction` and hand-rolled bordered buttons; it holds ≥ 3:1 against `bg`/`surface`/`surfaceRaised` in both modes. `line`/`lineStrong` (≈1.1–1.6:1) are for dividers, sheets, inputs, placeholders and drawings only — a `lineStrong` button border reads as plain text. Card-foot actions (고치기·삭제·선물·호스트 넘기기 …) are `FootAction`, a small outline button (34pt + hitSlop, label without glyph); section/card text links ('전체보기 ›', '모임 노트 ›') are `TextLink` (12px mono in `text`, never accent). Press feedback everywhere (Button, text links, chips, rows, icon buttons) is `pressedStyle` (opacity 0.72) — no spring scale, no translate, no ad-hoc opacity values. Link labels go through `linkLabel(label, kind)` in ui.tsx: navigation links end with " ›", in-place actions (더 보기, 다시 시도, 쓰기) carry no glyph, "→" is only a range separator (기간·쪽수), Button labels never carry glyphs, and "▶" comes from `playLabel` on read/resume CTAs only. Motion tokens for the collage feel: `tilt`/`tiltFor()` (cover rotation), `stagger` (entrance), `rowOffsetY` (row zigzag).

Shared primitives are in `src/components/ui.tsx` (`Card`, `Button`, `Tag`, `ProgressBar`, `Field`, `Segmented`, ...) and the collage-specific ones in `src/components/collage/` — `PaperScreen` (dot-grid paper background), `TiltCover` (tilted book cover), `SectionNav` (floating glass bar — **icons only, active = accent (green) icon** inside a sliding glass marker; the bar's blur shadow and capsule radius are the deliberate exception to the no-shadow/no-pill rules. 라벨을 붙이거나 활성 색을 잉크로 바꾸지 않는다 — 위 '사용자 결정으로 둔 예외'), `SubHeader`, `MemoScrap`, `StickyNote`, `Chip`. Build new UI from these tokens and components — don't introduce ad-hoc colors, fonts, or radii.

## 모바일 앱 디자인 원칙

bookey는 **휴대폰에서 한 손으로 쓰는 앱**이 1순위다. 웹(`npm run web`)은 확인용 미리보기일 뿐이니, 데스크톱 브라우저 화면 기준으로 레이아웃을 잡지 않는다. 새 화면·컴포넌트를 만들거나 손볼 때 아래를 지킨다.

### 화면 크기·레이아웃

- 기준 폭은 **360~430pt 세로 화면**이다. 가장 좁은 360pt에서 글자가 잘리거나 두 줄로 깨지지 않는지 먼저 본다. 가로 모드는 고려하지 않는다.
- 폭은 고정 px로 박지 말고 `flex`·퍼센트·`useWindowDimensions()`로 잡는다. 태블릿·웹에서 퍼지지 않도록 본문은 `layout.content`(maxWidth 560, 가운데 정렬)로 감싼다.
- 좌우 여백·간격은 `spacing` 토큰만 쓴다(예외는 위 '사용자 결정으로 둔 예외'). 한 화면 안에서 좌우 여백은 통일한다. `Field`는 바깥 여백이 없다 — 칸 사이는 쓰는 화면이 `gap`으로 정한다.
- 한국어 문구는 길어지기 쉽다 — 버튼·칩·탭 라벨은 짧게 쓰고, 넘칠 수 있는 텍스트에는 `numberOfLines` + 말줄임을 건다. 책 제목·닉네임처럼 사용자 입력 값은 항상 길 수 있다고 가정한다.

### 세이프에어리어·시스템 UI

- 노치·다이내믹 아일랜드·홈 인디케이터를 피한다. 상단은 `PaperScreen withTopInset` 또는 `SubHeader`/`BrandHeader`가, 하단은 `SectionNav`가 `useSafeAreaInsets()`로 처리한다. 이 셸들을 거치지 않는 화면(모달·시트·전체화면 노트 등)은 직접 인셋을 준다.
- 하단 고정 CTA·입력창은 `insets.bottom`만큼 띄우고, 스크롤 콘텐츠 마지막에는 `SectionNav`·고정 버튼에 가리지 않을 만큼 하단 패딩을 둔다.
- 상태 표시줄 색(밝음/어두움)은 현재 테마 모드를 따른다.

### 터치·조작

- 터치 영역은 **최소 44×44pt**. 아이콘 버튼처럼 눈에 보이는 크기가 작으면 `hitSlop`으로 넓힌다. 인접한 터치 대상끼리는 최소 `spacing.sm` 이상 떨어뜨려 오터치를 막는다. 공용 부품은 이미 맞춰 두었다 — `Button` md 46pt, `size="sm"`은 겉모습 34pt + 위아래 hitSlop, `variant="ghost"`는 44pt 상자 + 좌우 hitSlop, `Segmented`·`CapsuleTabs`·`ConfirmButton` 44pt, `Chip`은 hitSlop, `Toggle`은 라벨 행 전체가 눌린다. 직접 만든 Pressable만 따로 챙기면 된다.
- 자주 누르는 주요 동작(저장, 기록 시작, 보내기)은 엄지가 닿는 화면 하단 쪽에 둔다. 화면 상단 구석에는 파괴적이거나 자주 쓰는 동작을 두지 않는다.
- hover에 기대는 UI는 만들지 않는다(모바일엔 hover가 없다). 툴팁·마우스 오버로만 드러나는 정보·버튼 금지.
- 눌림 피드백은 `pressedStyle` 하나로 통일한다(Design system 참고). 삭제·나가기처럼 되돌릴 수 없는 동작은 확인 단계를 거친다(`ConfirmButton` 등).
- 제스처(스와이프 탭, 노트 줌 등)는 항상 눈에 보이는 버튼 대안과 함께 둔다. 제스처만으로 할 수 있는 기능은 만들지 않는다. 시스템 뒤로 가기 제스처(iOS 가장자리 스와이프, Android 뒤로 버튼)와 충돌하지 않게 한다.

### 키보드·입력

- 입력이 있는 화면은 `src/components/keyboard.tsx` 부품으로 키보드가 입력창·다음 단계 버튼을 가리지 않게 한다. `KeyboardAvoidingView`를 `Platform` 분기로 직접 쓰지 않는다 — Android는 엣지투엣지(`app.json` `edgeToEdgeEnabled`)라 키보드가 떠도 창이 줄지 않아, 예전의 `behavior={ios ? 'padding' : undefined}`로는 Android에서 하단 바·입력줄·시트가 키보드 밑에 깔렸다(2026-10-04 정리).
  - `KeyboardArea`: 키보드와 겹친 만큼 아래를 비우는 상자. 두 플랫폼 모두 같은 방식이고, 겹침을 창 기준으로 재므로 시트·모달(`NoteSheet`, iOS 시트로 뜨는 타이머)에서도 맞는다.
  - 하단 고정 바·입력줄은 `KeyboardArea` 안에서 스크롤의 형제로 둔 `KeyboardDock`(또는 `useBottomBarPadding`)으로 그린다 — 키보드 위에 붙을 땐 홈 인디케이터 몫을 거둔다. 주요 버튼이 하나뿐인 쓰기 화면은 이 하단 바에 둔다(독후감 쓰기·클럽 만들기·조각 남기기·프로필 편집).
  - 긴 스크롤 안의 입력 카드(엽서·리뷰·모임 만들기·클럽 설정·답장)는 `KeyboardScroll`로 감싸고, 입력창 `onFocus`에서 `useKeyboardReveal()`(안쪽 부품) 또는 `useScrollReveal(scrollRef)`(스크롤을 가진 화면)로 그 밑 버튼(줄)을 넘긴다 — 버튼이 키보드와 여유(`spacing.xl`)를 두고 올라오되, 누르고 있는 입력칸은 화면 위로 밀려나지 않는다. 여러 줄 입력은 `onContentSizeChange`에서 `{ onlyIfOpen: true }`로 다시 맞추고 `maxHeight`로 높이를 묶어, 길어져도 버튼이 키보드 밑으로 숨지 않게 한다.
  - 키보드가 떠 있는 동안 하단 `SectionNav`는 숨는다(`useKeyboardOpen`).
- 입력창이 있는 스크롤 뷰에는 `keyboardShouldPersistTaps="handled"`를 준다(`KeyboardScroll`은 기본) — 안 주면 키보드가 떠 있을 때 버튼 첫 탭이 먹히지 않는다.
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
