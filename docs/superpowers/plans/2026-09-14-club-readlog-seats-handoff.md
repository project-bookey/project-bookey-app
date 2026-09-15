# 모임 읽기로그 · 자리 늘리기 — 이어서 작업하기

2026-09-14 기준 인수인계 문서. 다음 세션은 이 문서부터 읽고 시작한다.

- 설계 문서: [`docs/superpowers/specs/2026-09-14-club-readlog-seats-design.md`](../specs/2026-09-14-club-readlog-seats-design.md) — 정책·API·화면의 기준. 어긋나면 설계 문서가 이긴다.
- 목업: [bookey 읽기로그 캔버스](https://claude.ai/code/artifact/247f2be5-59ee-4b46-9d8e-aa7096271265)(작성자만 볼 수 있는 비공개 링크). 화면 번호 1~7 은 설계 문서와 같다.

## 1. 지금 상태

설계 문서의 1~3단계는 **모두 구현·머지·push 완료**. 백엔드는 Cloud Run 배포까지 성공했다(새 엔드포인트가 운영 OpenAPI 에 노출되는 것 확인).

| 단계 | 백엔드 커밋 | 앱 커밋 | 내용 |
|---|---|---|---|
| 1 자리 늘리기 | `29fe66b` | `1384d64` | 무료 3명, 호스트가 책갈피(자리당 4개)로 최대 6명. 모임 종료 시 소멸 |
| 2 읽기로그 | `145aaba` (V20) | `2d9bd05` | 타이머 끝 조각(사진 1장 + 한 줄), 콜라주 보드, 지금 읽는 중, 모임 홈 카드 |
| 3 주간 카드 | `bcc41e5` | `f264002` | 한 주 조각 9:16 이미지 공유, 일요일 21:00 알림 |
| 설계 문서 | — | `f8e497d` | 스펙 |

검증: 백엔드 단위 테스트 343개 통과 · 로컬 서버 API 스모크 · 앱 `npm run typecheck` 0 · 로컬 Chrome 헤드리스로 웹 화면 흐름 확인.
**실기기(네이티브) 확인은 아직 안 했다** — 아래 2-1.

## 2. 남은 작업 (우선순위 순)

> 2026-09-15 정리 — 사진(GCS)·책갈피 구매는 사용자 결정으로 후순위. 알림 이동과 토론왕 집계는
> 끝나서 2-6 으로 옮겼고, 그만큼 아래 번호가 하나씩 당겨졌다.

### 2-1. dev client 재빌드 + 실기기 확인 — 먼저

네이티브 설정이 바뀌어 지금 설치된 dev client 로는 촬영·공유가 동작하지 않는다.

- 바뀐 것: `app.json` 의 `expo-image-picker.cameraPermission` 추가, 플러그인 `expo-sharing` 추가, 의존성 `react-native-view-shot`·`expo-sharing`.
- [ ] iOS·Android dev client 재빌드
- [ ] 한 조각 남기기: 촬영(카메라 권한 문구) · 앨범(사진 권한 문구) · 권한 거절 시 안내 문구 · 사진 업로드 성공
- [ ] 타이머 '세션 종료' → 모임 책이면 조각 남기기 화면으로 전환(완독이면 책 상세)
- [ ] 보드: 기울어진 폴라로이드가 안드로이드에서 잘리거나 넘치지 않는지, 반응 줄 열기
- [ ] 주간 카드: `captureRef` → 공유 시트, 인스타 스토리로 공유했을 때 1080×1920 이 꽉 차는지
- [ ] 자리 늘리기 화면: 책갈피 충분/부족 두 상태, 늘린 뒤 모임 홈 복귀

### 2-2. 운영에서 사진 조각 켜기 (GCS) — 후순위

운영 `prod` 프로필의 `STORAGE_TYPE` 기본값이 `none` 이라 **사진이 붙은 조각은 `503 STORAGE_DISABLED` 로 거절**된다. 글만 쓴 조각·보드·주간 카드는 정상.
켜는 절차는 백엔드 README 의 "GCS 준비 (운영) — 업로드를 켤 때 한 번" 을 그대로 따른다(버킷 → 공개 읽기 → 서비스계정 권한 → GitHub Variable `GCP_MEDIA_BUCKET` → 워크플로 `env_vars` 에 `STORAGE_TYPE`·`GCS_BUCKET` → push).
콘솔에서 환경변수를 손으로 넣으면 다음 배포에서 지워진다(`env_vars_update_strategy: overwrite`).

### 2-3. 책갈피 구매 연동 (백엔드) — 후순위

자리 늘리기 '책갈피 n개 더 구매하기 →' 는 앱의 `/bookmarks` 화면으로 가지만 **백엔드에 구매 경로가 없다**(`WalletTransactionKind.PURCHASE` 미사용, 유입은 `AdminUserService` → `WalletService.adminAdjust` 뿐).
그 전까지 운영에서 자리 늘리기는 어드민이 책갈피를 지급해야 쓸 수 있다.

### 2-4. 로컬 서버 기동 오류 (팀원 커밋, 미수정)

`9b4b17b Implement SMTP email verification sender`(Jay) 이후 **기본 로컬 설정으로 백엔드가 뜨지 않는다**:
`AuthService required a bean of type EmailCodeSender that could not be found`. 원인은 `LoggingEmailCodeSender` 의 `@ConditionalOnMissingBean` 을
일반 `@Component` 에 쓴 것(자동설정용 조건이라 컴포넌트 스캔 순서에 따라 빈이 안 생긴다). 운영 배포는 성공했으므로 운영 설정에서는 문제 없어 보인다.
남의 코드라 고치지 않는다(2026-09-15 재확인) — 담당자 공유 사항이다. 그 전까지 로컬은 아래 우회로로 띄운다.

담당자에게 넘길 내용: `LoggingEmailCodeSender` 의 `@ConditionalOnMissingBean` 을 `SmtpEmailCodeSender` 조건의 반대
(`@ConditionalOnProperty(prefix = "bookey.mail", name = "enabled", havingValue = "false", matchIfMissing = true)`)로 바꾸면
두 구현 중 정확히 하나만 뜬다. 운영은 메일이 켜져 있어 지금과 동작이 같다.

### 2-5. 백로그

- 같은 책으로 모임이 여러 개일 때 조각 남길 모임 고르기(지금은 타이머 종료 후 첫 모임으로 간다)
- 조각 사진 서명 URL — 지금은 추측 어려운 공개 URL 이라 링크를 알면 모임 밖에서도 열린다
- 페이지 도착 알림("지유님이 87쪽에 조각을 남겼어요") · 예약형 같이 읽기 시간 · 조각 여러 장/짧은 영상
- 모임 생성 시 바로 자리 구매 · 자리 구매 이력 화면(원장 조회 API 없음) · `Club.archive()` 전환 배치

### 2-6. 끝난 것 (2026-09-15)

| 한 일 | 커밋 | 검증 |
|---|---|---|
| 알림 탭 → 화면 이동 | 앱 `38dd852` | 가짜 API(8098)+웹(8099)에서 11종 전부 목적지 확인 |
| 결산 토론왕은 토론 글만 | 백엔드 `b4aeb4d` | `./mvnw test` 통과 |
| 조각 쪽 입력 · 한 마디 · 수정 | 백엔드 `7b2dcfd` · 앱 (아래) | 로컬 백엔드 + 더미데이터로 화면에서 직접 확인 |

- 알림 이동: 종류·페이로드로 목적지를 정한다 — `CLUB_WEEKLY_LOG` → `/club/[id]/log/week?weekOf=`,
  `CLUB_NEW_POST` → 토론, `CLUB_ENDED` → 결산, 나머지 모임 알림 → 모임 홈, 독후감·밑줄·채팅·맞팔로우 →
  각 상세, 엽서(받음/답장) → 메신저의 받은/보낸 칸, 내 독서 알림 → 서가. 목적지를 모르면 전처럼 열람 처리만.
  판단은 `app/notifications.tsx` 의 `targetOf()` 한 곳에 모여 있다.
- 토론왕: `ClubPostRepository.countDiscussions`(`type <> 'LOG'`)로 세고, 아무도 글을 안 쓴 모임은 뽑지 않는다.
- 조각에 빠져 있던 세 가지(2026-09-15 사용자 지적):
  - **쪽 입력** — 조각 남기기에 쪽 칸을 뒀다. 타이머에서 오면 방금 읽은 쪽, 보드에서 오면 내 진도가 채워지고 직접 고칠 수 있다.
    적은 쪽이 서재 진도보다 앞서면 `libraryApi.updateProgress` 로 진도도 같이 올린다(되감지는 않는다).
    쪽과 가림은 따로다 — 토글을 끄면 쪽은 적어 두되 모두에게 보인다.
  - **한 마디** — 조각을 탭하면 `app/club/[id]/log/[postId].tsx` 가 열린다(길게 누르면 예전처럼 보드에서 반응만).
    댓글은 서버 변경 없이 `POST /clubs/{id}/posts` 에 `parentId` 로 단다. 보드 조각 메타에 '한 마디 n' 이 붙는다.
  - **수정** — 백엔드에 `PATCH /clubs/{clubId}/posts/{postId}` 를 새로 뚫었다(V21 `edited_at`). 작성자만, 한 줄과 쪽을 바꾼다.
    사진은 바꾸지 않는다. 고친 조각에는 '수정됨'이 붙는다. 토론 글·인용도 같은 경로를 쓴다.

## 3. 정책 요약 (구현된 그대로)

**자리**
- 무료 정원 3명(호스트 포함), 최대 6명, 자리당 책갈피 4개. 설정은 `bookey.club.free-member-limit` · `max-member-limit` · `seat-cost-bookmarks`.
- 호스트(`clubs.owner_id`)만 늘린다. 차이만큼 차감, 원장 `CLUB_SEAT`(ref `CLUB`/clubId). 종료된 모임은 늘릴 수 없고 환불·이월 없음.
- 모임 생성 정원은 2~3명만. 모임 수정(`PATCH /clubs/{id}`)에서 정원 변경은 **제거**했다.
- 정원이 3을 넘는 기존 모임은 그대로 둔다(DB CHECK `2..50` 유지). 참가·자리 늘리기는 모임 행 비관적 잠금(동시 참가 초과 방지).

**읽기로그**
- 조각은 `club_posts.type = 'LOG'`. 토론 목록·토론 작성에서는 제외된다. 가림·반응·신고는 토론 글 규칙 그대로.
- 쪽에 붙이면 `PAGE` 가림 — 그 쪽까지 읽은 멤버에게만 `body`·`imageUrl` 이 내려간다. 사진 1장(선택) + 한 줄 100자, 하루 20개.
- 하루 합산은 **진척 공개 멤버**의 그날 끝난 세션 기준(쪽·시간·읽은 사람). 지금 읽는 중은 나·비공개·4시간 넘은 세션 제외, 앱은 30초마다 갱신.
- 주간 카드 대표 조각·문장은 **보는 사람에게 가려지지 않은 것만**(이미지로 모임 밖에 공유되므로). 사진 → 반응 → 먼저 남긴 순 6개.

## 4. 파일 지도

**백엔드** (`project-bookey-backend/server/src/main/java/app/bookey/`)
- `api/club/ClubSeatService.java` — 자리 늘리기. `api/social/WalletService.spendBookmarks` 공용 차감 경로
- `api/club/ClubLogService.java` · `ClubLogController.java` — 조각 작성(멀티파트)·하루 보드·요일 스트립·지금 읽는 중·주간 카드
- `api/club/ClubPostService.viewsFor` — 가림 규칙을 적용해 글을 그리는 공용 메서드
- `domain/club/ClubPost.log(...)` · `ClubPostRepository.findLogs/findLogTimes/findQuotesBetween/findClubIdsWithLogsBetween`
- `domain/reading/SessionTotals` · `ReadingSessionRepository.sumTotalsEndedBetween`
- `batch/ClubScheduleJob.notifyWeeklyLogCards` — 일요일 21:00 KST
- `resources/db/migration/V20__club_logs.sql`
- 테스트: `ClubTest` · `ClubPostTest` · `ClubServiceTest` · `ClubSeatServiceTest` · `ClubLogServiceTest`

**앱**
- `app/club/[id]/seats.tsx` — 자리 늘리기(부족 상태 포함). 모임 홈 자리 줄은 `app/club/[id]/index.tsx` 의 `SeatRow`
- `app/club/[id]/log/index.tsx` 보드 · `log/new.tsx` 한 조각 남기기 · `log/week.tsx` 주간 카드
- `src/components/clubLog/` — `LogScrap`(조각) · `LogBoardParts`(지금 읽는 중·요일 스트립·합산 스티키) · `LogEntryCard`(모임 홈 카드) · `WeekCard` · `dates.ts`(KST 날짜) · `queries.ts`(`clubLogKeys`, `useMyClubRecord`)
- `app/timer.tsx` — 세션 종료 후 조각 남기기로 전환
- `app/club/create.tsx` — 정원 2명·3명 선택

## 5. 로컬에서 돌려 보기

```bash
# 백엔드 (project-bookey-backend)
npm run infra:up                                        # Docker Desktop 먼저 켜기
MAIL_ENABLED=true SPRING_MAIL_HOST=localhost npm run dev  # 2-4 우회 — 메일은 실제로 보내지 않는다

# 앱 — 로컬 백엔드를 보게 해서 띄운다(기본값은 운영 Cloud Run)
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8082
npm run types                                           # 백엔드가 떠 있을 때 타입 재생성
```

- 가입: `POST /api/v1/auth/signup {"email","password","nickname","identityVerificationId":"dev-아무값"}` (같은 dev id 는 중복 가입으로 막힌다).
- 책갈피 지급(로컬 DB): `docker exec bookey-postgres psql -U bookey -d bookey -c "update wallets set bookmark_balance=15 where user_id=<id>"` — 지갑 행이 없으면 `GET /api/v1/wallet` 을 한 번 호출해 만든다.
- 로컬 DB 에 남아 있는 테스트 데이터: `lu-me-1789391196@dev.local` / `password1234` — 모임 5(월요일의 데미안), 조각·인용·세션이 들어 있다. 모임 3 은 자리 늘리기 확인용(이미 6명으로 늘린 상태 — 다시 보려면 `update clubs set member_limit=3 where id=3`).
- 웹 화면 확인: 연결된 Chrome 확장은 이 맥의 localhost 에 접속하지 못했다. scratchpad 에 `playwright-core` 를 받아 `/Applications/Google Chrome.app` 을 헤드리스로 띄우고, `localStorage['bookey.tokens']` 에 로그인 토큰을 넣어 들어가는 방식으로 확인했다.
  헤드리스 Chrome 은 `navigator.canShare` 가 있어 공유 시트를 기다리며 멈추므로, 주간 카드 내려받기를 확인할 때는 `navigator.canShare = undefined` 로 막는다.

## 6. 알아둘 제약

- 웹 캡처(html2canvas)는 도트 종이 질감(radial-gradient)을 그리지 못한다 — 네이티브는 정상일 것으로 예상(미확인).
- 앱은 `seatPolicy` 가 없는 구버전 서버에서도 자리 줄만 숨기고, 읽기로그 API 가 없으면 모임 홈 카드만 숨긴다.
- 조각 남기기 성공 후 `router.dismissTo(보드)` — 보드에서 왔으면 보드로 돌아가 스택이 두 겹 쌓이지 않는다.
- 닉네임 끝이 숫자·영문이면 이/가를 못 고르므로 '지유 님이' 식으로 통일했다.
- 세션 정리 배치가 10분 주기라 끝나지 않은 세션은 최대 10분 더 '읽는 중'으로 보일 수 있다(4시간 초과는 즉시 제외).

## 7. 작업 규칙 (두 저장소 공통, CLAUDE.md)

- main 에서 직접 작업하지 않는다 → 작업 브랜치 → 검증(앱 `npm run typecheck`, 백엔드 `cd server && ./mvnw test`) → main 머지 → 브랜치 삭제.
- 커밋 첫 줄은 `신규:` / `수정:`. **AI 어트리뷰션을 넣지 않는다.**
- 백엔드 main push 는 곧 Cloud Run 배포다. 응답 스키마를 바꾸면 앱에서 `npm run types` 후 diff 를 커밋한다.
- 브랜치 삭제는 본인(bottleOne)·Claude 가 만든 브랜치만.
