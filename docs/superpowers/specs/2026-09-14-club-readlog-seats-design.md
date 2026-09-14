# 모임 읽기로그 · 자리 늘리기 — 설계 문서

2026-09-14 · 사용자 요청("모임 탭 기능 강화 — 다른 앱과 차별점", 셋로그 참고 → 읽기로그 목업 → 인원 정책)
목업: [bookey 읽기로그 캔버스](https://claude.ai/code/artifact/247f2be5-59ee-4b46-9d8e-aa7096271265) — 화면 1~7 번호는 이 문서의 화면 번호와 같다.
전제: [콜라주 리디자인 스펙](2026-09-01-collage-redesign-design.md). 새 UI 는 전부 기존 토큰·프리미티브로 만든다.

## 배경 — 왜 이 두 가지인가

모임 탭은 이미 진도 공유·체크포인트·페이지 고정 토론(스포일러 가리기)을 갖고 있다. 카카오 오픈채팅(대화), 문토·소모임(모집),
밀리의서재(콘텐츠)와 정면으로 붙지 않고, 이 앱들이 모르는 **"실제로 어디까지, 언제 읽었나"** 를 차별점으로 삼는다.

- **읽기로그** — 셋로그(시간마다 2초 영상 → 하루 영상 자동 조립)의 "짧게 남기면 알아서 한 장이 된다"를 독서에 옮긴다.
  계기는 매시간 알림이 아니라 **타이머 종료**, 결과물은 영상이 아니라 **콜라주 보드**, 스포일러는 **페이지 고정**으로 막는다.
- **자리 늘리기** — 모임은 3명까지 무료, 호스트가 책갈피로 최대 6명까지 연다. 소규모 모임이 완독률이 높다는 기존 가설
  (모임 생성 화면 정원 안내 문구)과 책갈피 경제를 함께 쓴다.

## 목표

1. **자리 정책** — 기본 3명 무료. 호스트만 책갈피로 자리를 늘린다(자리당 4개, 최대 6명). 늘린 자리는 그 모임에만 적용되고 모임이 끝나면 사라진다.
2. **읽기로그 남기기** — 타이머를 끝내면 사진 1장(선택) + 한 줄로 조각을 남긴다. 조각은 방금 읽은 마지막 쪽에 붙어, 그 쪽까지 읽은 멤버에게만 보인다.
3. **읽기로그 보드** — 모임의 하루 조각을 콜라주로 본다. 요일 스트립 · 오늘 합산(쪽·시간) · 지금 읽는 중인 멤버.
4. **모임 홈 진입** — 모임 홈에 읽기로그 카드(지금 읽는 중 + 오늘 조각 미리보기)와 자리 상태 줄을 넣는다.
5. **주간 공유 카드** — 한 주의 조각을 9:16 한 장으로 조립해 공유한다. (3단계)

## 범위 밖

영상 조각 · 조각 여러 장 · 조각 댓글(반응만) · 조각 수정 · 예약형 "같이 읽기 시간" · 페이지 도착 알림 · 모임 생성 시 바로 자리 구매 ·
자리 환불·이월·양도 · 서명 URL · 책갈피 결제 연동(아래 "선행 조건") · 실제 푸시 발송(PushSender 는 현재 로그 스텁).

---

## 1부. 자리 늘리기

### 정책

| 항목 | 값 |
|---|---|
| 무료 정원 | 3명 (호스트 포함) |
| 최대 정원 | 6명 |
| 가격 | 자리당 책갈피 4개 (앱 책갈피 단가 200원 기준 자리당 800원) |
| 누가 | 호스트만 (`clubs.owner_id`) |
| 적용 범위 | 그 모임 하나 |
| 모임 종료 | 늘린 자리는 사라진다 — 환불·이월 없음 |
| 멤버가 나가면 | 빈자리는 그 모임에 남는다(다시 초대 가능) |
| 호스트 위임 | 늘린 자리는 모임에 남는다 |

"사라진다"의 구현: 종료된 모임은 이미 `CLUB_ENDED` 로 참가가 막히므로 **정원 값을 되돌리지 않는다.** 결산 화면의 `n/6명` 표시가
그대로 남아야 하기 때문이다. 자리를 다른 모임으로 옮기거나 돌려받는 경로를 만들지 않는 것으로 정책을 지킨다.

### 백엔드 (project-bookey-backend, `feature/club-seats`)

현재 상태(조사 결과):
- `clubs.member_limit` SMALLINT, DB `CHECK (member_limit BETWEEN 2 AND 50)`, 기본값 20. 생성 DTO 는 `@Min(2) @Max(50)`, 미지정 시 `bookey.club.default-member-limit: 20`.
- 정원 검사는 `Club.joinMember()` 한 곳(`CLUB_FULL`). **`Club` 에 락이 없어** 동시 참가가 정원을 넘을 수 있다.
- 호스트 검사는 `ClubService.requireHost` → `CLUB_NOT_HOST`. 지갑은 `WalletRepository.findByUserIdForUpdate`(비관적 락) + `wallet_transactions` 원장.

변경:

- **설정** — `BookeyProperties.Club` 에 `freeMemberLimit: 3`, `seatCostBookmarks: 4` 를 더하고, 지금 아무도 읽지 않는
  `maxMemberLimit` 을 50 → **6** 으로 바꿔 실제로 쓴다. `defaultMemberLimit` 은 3.
- **마이그레이션 없음** — DB CHECK 는 `2..50` 그대로 둔다(기존 모임 보호, 아래 "기존 모임"). 컬럼 추가도 없다 —
  구매 이력은 원장이 맡는다.
- **생성** — `CreateClubRequest.memberLimit` 는 `@Min(2)` 만 두고, 상한은 서비스가 `freeMemberLimit` 설정으로 검사해 `INVALID_REQUEST` 로 막는다(책 조회 전).
- **수정** — `UpdateClubRequest.memberLimit` 를 제거한다. 올리면 결제를 우회하고, 내리면 산 자리를 버리는 경로가 되기 때문이다.
- **자리 구매 API** — `POST /api/v1/clubs/{clubId}/seats`, 본문 `{ "targetLimit": 4 | 5 | 6 }`. `ClubSeatService` 가 맡고,
  책갈피 차감은 `WalletService.spendBookmarks`(잠근 지갑 + 원장) 공용 경로로 한다.
  1. `requireHost` → `CLUB_NOT_HOST`
  2. `club.status.isOver()` → `CLUB_ENDED`
  3. `targetLimit <= memberLimit` 또는 `> maxMemberLimit` → `INVALID_REQUEST`
  4. 비용 `(targetLimit - memberLimit) × seatCostBookmarks`, `wallet.trySpendBookmarks` 실패 → `INSUFFICIENT_BOOKMARK`(409)
  5. `club.expandMemberLimit(targetLimit)`, 원장에 `kind=CLUB_SEAT`, `bookmark_delta=-비용`, `ref_type=CLUB`, `ref_id=clubId`
  6. 응답: `ClubSeatResult { memberLimit, bookmarkBalance }`
  - 한 트랜잭션. 락 순서는 **모임 → 지갑** 으로 고정한다(참가도 모임 락을 잡으므로 순서가 엇갈리면 교착).
- **동시성** — `ClubRepository.findByIdForUpdate`(`PESSIMISTIC_WRITE`)를 추가해 자리 구매와 **참가(`joinClub`)** 둘 다 이것으로 읽는다.
  돈이 걸린 정원이 되었으므로 기존 초과 참가 버그를 이번에 같이 막는다.
- **enum** — `WalletTransactionKind.CLUB_SEAT` 추가(`kind` 는 VARCHAR, DB CHECK 없음).
- **조회 필드** — `ClubHomeView` 뒤에 `seatPolicy { freeLimit, maxLimit, costPerSeat }` 를 더한다. 앱이 가격·상한을 하드코딩하지 않게 한다.
- **레이트리밋** — `club:seat:{userId}` 10/시간.

기존 모임: 정원이 3을 넘는 기존 모임은 **그대로 둔다**(유예). 새 규칙은 생성·자리 구매 경로에서만 적용되고, DB CHECK 를 좁히지 않는 이유가 이것이다.
정원 3 초과 기존 모임의 자리 구매는 `targetLimit <= memberLimit` 로 자연히 막힌다.

### 앱 (project-bookey-app, `feature/club-seats`)

- **타입** — `npm run types` 후 `types.ts` 에 `ClubSeatResult`, `ClubSeatPolicy` 별칭. `clubApi.expandSeats(clubId, targetLimit)` 추가.
- **모임 생성**(`app/club/create.tsx`) — 정원 `Field`(2~50, 기본 6)를 `Segmented` `2명 | 3명`(기본 3)으로 바꾸고,
  안내를 "자리는 모임을 만든 뒤 책갈피로 6명까지 늘릴 수 있어요." 로 바꾼다.
- **화면 1 · 모임 홈** — 요약 카드 맨 아래에 자리 줄: 정원만큼 점(채움=멤버, 점선=빈자리, 최대 6칸) + 상태 문구.
  - 호스트 · 가득 참 · 정원 < 6 → "자리가 가득 찼어요" + `Button` sm primary "자리 늘리기" → `/club/[id]/seats`
  - 호스트 · 빈자리 있음 → "n자리 비었어요" + outline "자리 늘리기"(6명이면 버튼 없음)
  - **화면 7 · 멤버** → 버튼 없이 "자리가 가득 찼어요 · 호스트만 자리를 늘릴 수 있어요"
- **화면 5 · 자리 늘리기**(`app/club/[id]/seats.tsx`, 신규 서브 라우트 `router.push`) — 지갑·구독 화면 카드 구조를 따른다.
  - 안내 카드: 모임 이름 `Tag` · 제목 · "모임은 3명까지 무료예요…" · 자리 6칸(멤버 이니셜 / 새로 열 자리 점선 +)
  - 교환 카드: `Segmented` 로 목표 인원(현재+1 ~ 6) · `KeyValue` 추가 자리 / 필요한 책갈피 `n개 (4 × k자리)` / 내 책갈피
  - 안내 문구: "늘린 자리는 이 모임에만 적용되고, 모임이 끝나면 사라져요."
  - primary "책갈피로 자리 늘리기" · outline "책갈피 구매 →"(`/bookmarks`)
  - 성공 시 `['club', id]` · `['wallet']` 캐시에 응답을 반영하고 `router.back()`.
- **화면 6 · 책갈피 부족** — 같은 화면의 상태. `KeyValue` "부족한 책갈피 n개"를 `colors.warn` 으로, 지금 잔액으로 가능한 최대 인원 안내,
  primary 를 "책갈피 n개 더 구매하기 →" 로 올리고 교환 버튼은 `disabled`. 서버 409(`INSUFFICIENT_BOOKMARK`)가 오면 지갑을 다시 받아 이 상태로 전환.
- 호스트가 아닌 사용자가 `/club/[id]/seats` 로 딥링크하면 모임 홈으로 `replace`.

### 선행 조건 — 책갈피 구매

앱에는 `/bookmarks` 구매 화면(개당 200원, 10개 이상 10% 보너스)이 있지만 **백엔드에 책갈피 구매 경로가 없다**
(`WalletTransactionKind.PURCHASE` 는 미사용, 책갈피 유입은 어드민 조정뿐). 부족 상태의 "구매하기" CTA 가 실제로 동작하려면
책갈피 결제(토스·인앱) 연동이 먼저 또는 함께 필요하다. 이 문서의 범위 밖으로 두고, 연동 전까지 자리 기능은 어드민 지급 책갈피로 검증한다.

---

## 2부. 읽기로그

### 데이터 — `club_posts` 재사용

새 테이블 대신 `club_posts` 에 `type=LOG` 를 더한다. 스포일러 가리기(`isMaskedFor`)·공개(`reveal`)·반응·신고·자동 숨김·
`CLUB_ENDED` 차단·레이트리밋을 전부 그대로 얻는다.

**마이그레이션 `V20__club_logs.sql`**

| 변경 | 내용 |
|---|---|
| `club_posts.image_url` | VARCHAR(500) NULL — 조각 사진 공개 URL |
| `club_posts.image_storage_key` | VARCHAR(300) NULL UNIQUE |
| `club_posts.image_width/height` | INT NULL |
| `club_posts.reading_session_id` | BIGINT NULL FK `reading_sessions(id)` — 어느 세션 끝에 남긴 조각인가 |
| 인덱스 | `(club_id, created_at DESC) WHERE type = 'LOG' AND status = 'VISIBLE'` |

- `ClubPostType.LOG` 추가. LOG 는 `parentId` 불가(댓글 없음), 본문 1~100자, 사진 없으면 본문 필수.
- 기존 토론 피드(`GET /posts`, `findFeedUpTo`)는 **`type <> 'LOG'`** 로 걸러 토론과 섞이지 않게 한다.
- 스포일러: 쪽에 붙이면 `PAGE` + `anchorPage`, 끄면 `NONE`. 가려질 때 서버는 `body`·`imageUrl` 을 null 로 내린다(기존 `body` 처리와 동일).

### 백엔드 (project-bookey-backend, `feature/club-logs`)

- **작성** — `POST /api/v1/clubs/{clubId}/logs` (multipart: `file` 선택, `body`, `anchorPage`, `spoilerLevel`, `readingSessionId`)
  - 한 요청에 사진과 글을 함께 받는다. 조각은 사진이 1장뿐이라 임시 업로드 + 고아 회수(`post_images` 방식)가 필요 없다.
  - 사진 검사는 기존 `ImageSniffer`(JPEG·PNG·WebP, 10MB), 키는 `StorageKeys.forClubLog` → `clubs/{clubId}/{userId}/{yyyy}/{MM}/{uuid}.{ext}`.
    DB 저장이 실패하면 올린 파일을 지운다.
  - `activeMember` 검사, `readingSessionId` 는 **본인 세션 + 이 모임에 연결된 독서 기록**일 때만 받는다.
  - 레이트리밋 `club:log:{userId}` 20/일(기존 `club:post` 10/분과 별도).
- **보드** — `GET /api/v1/clubs/{clubId}/logs?date=2026-09-14` (KST 날짜, 기본 오늘)
  ```
  ClubLogDayView {
    date, logs: ClubPostView[],                       // LOG, 오래된 순, 가려짐 반영
    summary: { pagesRead, durationSec, logCount, memberCount }
  }
  ```
  - `summary` 는 그날 끝난 세션의 합 — `club_members.reading_record_id` → `reading_sessions`(ACTIVE 멤버, `share_progress=true` 만).
  - `ClubPostView` 뒤에 `imageUrl · imageWidth · imageHeight` 를 더한다.
- **요일 스트립** — `GET /api/v1/clubs/{clubId}/logs/days?from=&to=` → `[{ date, logCount }]` (최대 14일).
- **지금 읽는 중** — `GET /api/v1/clubs/{clubId}/reading-now` → `[{ userId, nickname, avatarUrl, startedAt }]`
  - `reading_sessions.ended_at IS NULL` 인 세션 중 이 모임 ACTIVE 멤버의 `reading_record_id` 에 걸린 것. `share_progress=false` 멤버와 본인은 제외.
  - 4시간 넘은 세션은 `SessionCleanupJob` 이 닫으므로 오래된 "읽는 중"은 최대 10분 남는다.
- **세션 종료 응답 보강** — `ClubProgressEcho.clubName` 이 항상 null 로 나가는 버그를 고친다(캡처 화면에 모임 이름이 필요).
- **알림** — `CLUB_NEW_POST` 를 LOG 에는 보내지 않는다(하루 여러 번 쌓이는 조각이 모임 알림 한도 1/일을 먼저 먹는다).

### 앱 (project-bookey-app, `feature/club-logs`)

- **라우트** — `club/[id]/log`(화면 2, 보드) · `club/[id]/log/new`(화면 3, 남기기). 둘 다 `app/_layout.tsx` 에 한국어 `title` 로 등록.
- **API** — `clubApi.logs(clubId, date)` · `logDays(clubId, from, to)` · `readingNow(clubId)` · `createLog(clubId, FormData)`.
  사진은 `FormData` 로 보내므로 `client.ts` 가 `Content-Type` 을 비워 둔다(기존 동작).
- **화면 3 · 한 조각 남기기** (`SubHeader` 가운데 "한 조각 남기기", 우측 "건너뛰기")
  - 진입: `app/timer.tsx` 종료 `onSuccess` 에서 `result.clubs` 가 있고 완독이 아니면 `router.back()` 대신
    `router.replace('/club/{clubId}/log/new?sessionId=&startPage=&endPage=&durationSec=')`. 같은 책으로 모임이 둘 이상이면 첫 모임으로 간다(고르기는 백로그).
    완독이면 지금처럼 책 상세로 간다.
  - 세션 요약 카드(방금 읽은 시간 · 읽은 쪽 · 오늘 몇 번째 조각)
  - 폴라로이드 프레임(`memoPad` 종이, -2°, 마스킹 테이프) 안에 사진 미리보기. `촬영` · `앨범에서 고르기` · `글만`.
    사진은 `expo-image-picker`(카메라·앨범) + `expo-image-manipulator`(장변 1600, JPEG 0.8) — 독후감에서 이미 쓰는 의존성.
  - 한 줄 `Field`(나눔명조 입력, 100자) · `Toggle` "n쪽에 붙이기 — n쪽까지 읽은 멤버에게만 보여요"(기본 켬)
  - primary "모임 보드에 붙이기" → 보드로 `replace`.
- **화면 2 · 읽기로그 보드**
  - 머리(표지 · 모임 이름 · "9월 둘째 주 · n명이 남긴 조각")
  - 지금 읽는 중 카드(아바타 + "지유, 민수가 지금 읽는 중" + "합류" → 내 독서 기록으로 `/timer`). 아무도 없으면 카드를 숨긴다.
  - 요일 스트립(월~일, 조각 수만큼 점 최대 3, 오늘은 악센트 알약)
  - 콜라주: 사진 조각 = 폴라로이드(`memoPad` + `tiltFor(i)` 기울기), 글만 조각 = `MemoScrap`, 합산 = `StickyNote`("오늘 함께 212쪽").
    배치는 인덱스 기반 2열 지그재그(`rowOffsetY`)로 결정적으로 만든다 — 다시 그려도 조각이 튀지 않게.
  - 가려진 조각: 빗금 면 + 자물쇠 + "142쪽까지 읽으면 열려요" · "내 진도 128쪽". 누르면 기존 `reveal` 확인.
  - 하단 고정 CTA "한 조각 남기기"(세션 없이 들어오면 `sessionId` 없이, 쪽은 내 현재 쪽).
  - 반응은 조각을 눌러(길게 눌러도) 반응 줄을 열고 기존 4종(`LIKE·FIRE·CRY·THINK`)을 고른다.
  - 남기기에 성공하면 `router.dismissTo(보드)` — 보드에서 왔으면 그 보드로 돌아가 스택에 보드가 두 겹 쌓이지 않는다.
- **화면 1 · 모임 홈 진입 카드** — 요약 카드와 다음 체크포인트 사이. `Eyebrow` "읽기로그" + "보드 열기 →".
  지금 읽는 중 한 줄 · 조각 가로 스트립(첫 칸은 점선 "오늘 한 조각", 이어 최근 3조각) · "오늘 함께 212쪽 · 3시간 10분 · 6조각".
- **캐시** — `clubLogKeys`(`src/components/clubLog/queries.ts`): `['club', id, 'log', 'day', date]` · `['club', id, 'log', 'days', monday]` · `['club', id, 'log', 'readingNow']`(30초 `refetchInterval`).
  조각 작성 성공 시 오늘 보드·요일 스트립·모임 홈을 무효화한다.

---

## 3부. 주간 공유 카드 (후속 단계)

- **화면 4** — 360×640(9:16). 표제 "월요일의 데미안, 이번 주" · 조각 6장 콜라주 · 스티키 "함께 읽은 일주일 742쪽 · 3명 · 9시간 40분 · 19조각" · 푸터 `bookey · 9/8 – 9/14`.
- 서버 `GET /api/v1/clubs/{clubId}/logs/week?weekOf=` → 합산 + 대표 조각 6개(반응 많은 순, **가려지지 않는 조각만** — 공유 이미지에 스포일러가 새지 않게) +
  "이번 주 가장 많이 멈춘 문장"(그 주 `QUOTE` 글 중 반응 최다, 없으면 생략).
  "가려지지 않는 조각"은 **보는 사람 기준**이다 — 내 진도보다 뒤 쪽에 붙은 조각·문장은 싣지 않는다.
- 앱 `/club/[id]/log/week`(보드 머리의 '주간 카드'로 진입): 주 이동, 카드 미리보기, '이미지로 공유하기'.
  카드는 `WeekCard` View 를 그대로 캡처한다 — 네이티브 `react-native-view-shot` → `expo-sharing`,
  웹은 html2canvas(view-shot 웹 구현) → 파일 공유 지원 브라우저는 공유 시트, 아니면 PNG 내려받기. 내보내기 1080×1920.
  네이티브 모듈이 늘었으므로 dev client 재빌드 필요. 웹 캡처에서는 도트 종이 질감(radial-gradient)이 빠진다.
- 일요일 21:00 KST `ClubScheduleJob.notifyWeeklyLogCards` — 그 주 조각이 있는 진행 중 모임 멤버에게 `CLUB_WEEKLY_LOG`.
  실제 발송은 푸시 연동 이후이고, 앱 알림 목록은 아직 탭 이동이 없어 카드로 바로 가지 않는다.

---

## 단계와 브랜치

| 단계 | 백엔드 | 앱 | 비고 |
|---|---|---|---|
| 1 ✅ | `feature/club-seats` (마이그레이션 없음) | `feature/club-seats` | 2026-09-14 구현. 책갈피 결제 전에는 DB·어드민 지급으로 검증 |
| 2 ✅ | `feature/club-logs` (V20) | `feature/club-logs` | 2026-09-14 구현. 카메라 권한(`app.json`)이 늘어 dev client 재빌드 필요 |
| 3 ✅ | `feature/club-log-week` | `feature/club-log-week` | 2026-09-14 구현. 네이티브 의존성 추가 → dev client 재빌드 |

각 단계는 백엔드 먼저 머지 → 앱에서 `npm run types` → 타입 diff 커밋 → 화면 작업 순서로 간다.

## 검증

- **백엔드**(순수 단위 테스트, `./mvnw test`)
  - 자리: 호스트 아님 · 종료 모임 · 목표 ≤ 현재 · 목표 > 6 · 잔액 부족 · 정상(원장 행·잔액·정원) · 3→6 한 번에 12개
  - 참가: 정원 도달 시 `CLUB_FULL`, 락 경로로 읽는지
  - 생성: 정원 4 이상 거부, 미지정 시 3
  - 로그: 사진 없음+본문 없음 거부 · 남의 세션 거부 · 가려질 때 `body`/`imageUrl` null · 토론 피드에 LOG 미포함 · 종료 모임 거부
  - 지금 읽는 중: 비공개 멤버·본인 제외
  - 모임 도메인 테스트가 지금 하나도 없으므로 `ClubServiceTest`·`ClubPostServiceTest` 를 이번에 만든다.
- **앱** — `npm run typecheck` 0 · 웹(`npm run web`)에서 호스트/멤버 두 계정으로 화면 1·5·6·7, 두 계정 진도 차이로 화면 2 가려짐 확인.
- **실기기** — 카메라·앨범 권한 문구, 사진 업로드, 타이머 종료 → 캡처 화면 전환은 dev client 에서 확인.

## 정해야 할 것 · 가정

- **기존 모임 유예** — 정원 3 초과 기존 모임을 그대로 두는 것으로 가정했다. 줄여야 한다면 이미 참가한 멤버를 어떻게 할지 먼저 정해야 한다.
- **정원 수정 제거** — 생성 후 정원 수정(`PATCH`)을 막는 것으로 가정했다(내리기도 불가).
- **사진 공개 범위** — 저장소 URL 은 기존 독후감 사진처럼 공개 URL(추측 불가 UUID)이다. 모임원 전용이라는 약속과 어긋나므로 서명 URL 을 백로그 1순위로 둔다.
- **책 본문 사진** — 페이지 고정으로 스포일러는 막지만 저작권 노출은 남는다. 신고 → 자동 숨김(기존 `ModerationTicket`)으로 대응한다.
- **완독 세션** — 완독 순간에는 캡처 화면을 띄우지 않는다(책 상세 축하 흐름 유지). 완독 조각을 따로 원하면 후속.

## 백로그

같은 책 여러 모임일 때 조각 남길 모임 고르기 · 알림 탭 → 해당 화면 이동(주간 카드 등) · 서명 URL · 페이지 도착 알림("지유님이 87쪽에 조각을 남겼어요") · 예약형 같이 읽기 시간 · 조각 여러 장/짧은 영상 ·
모임 생성 시 자리 구매 · 책갈피 결제 연동 · `Club.archive()` 전환 배치 · 자리 구매 이력 화면(원장 조회 API).
