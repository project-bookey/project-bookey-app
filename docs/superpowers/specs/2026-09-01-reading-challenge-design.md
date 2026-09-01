# 챌린지 (타임워치) — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰](2026-08-31-design-tokens-design.md) · [탭 해체](2026-09-01-tabless-nav-design.md)

## 목표

"읽는 중" 책 하나에 **독서시간 예산**을 걸고 그 안에 완독하는 게임형 콘텐츠.
타임워치가 도는 동안만 시간이 소모되고, 일시정지하면 멈춘다. 완독하면 폭죽.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 시간 모델 | 독서시간 예산 (일시정지 가능한 카운트다운 — 달력 기한 아님) |
| 저장 | 백엔드 신설 (`reading_challenges`) — 시간의 진실은 서버 (§F3 철학) |
| 시간 초과 | 실패 처리 + 재도전 (같은 책·예산 프리필) |
| 진입점 | 홈 챌린지 섹션 (히어로 아래) |
| 완독 판정 | 쪽수 직접 입력 — 총쪽수 도달 시 서버가 성공 전이 + 서재 기록 완독 처리 |
| 폭죽 | 의존성 없이 RN Animated 커스텀 파티클 (팔레트 색) |

## 백엔드 (project-bookey-backend)

### V7 마이그레이션 `reading_challenges`

```sql
id BIGSERIAL PK
user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
reading_record_id BIGINT NOT NULL REFERENCES reading_records(id) ON DELETE CASCADE
budget_sec INT NOT NULL CHECK (budget_sec > 0)
elapsed_sec INT NOT NULL DEFAULT 0        -- 확정된 누적(일시정지 시점까지)
running BOOLEAN NOT NULL DEFAULT FALSE
last_started_at TIMESTAMPTZ               -- running=true일 때 이번 구간 시작 시각
status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE|SUCCEEDED|FAILED|CANCELLED
completed_at TIMESTAMPTZ
created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

부분 유니크: `CREATE UNIQUE INDEX ux_challenges_active ON reading_challenges(reading_record_id)
WHERE status = 'ACTIVE';` (기록당 ACTIVE 1개)

### 시간 규칙 (엔티티 순수 메서드 — 단위 테스트 대상)

- `effectiveElapsedSec(now)` = `elapsed_sec + (running ? now - last_started_at : 0)` (초, 내림)
- `remainingSec(now)` = `max(0, budget_sec - effectiveElapsedSec(now))`
- `isExpired(now)` = `effectiveElapsedSec(now) >= budget_sec`
- **지연 만료**: 조회·전이 진입 시 `ACTIVE && isExpired` → `FAILED` 전이(running 해제,
  elapsed는 budget으로 고정, completed_at 기록) 후 진행.

### API (`api/challenge/`, USER 인증)

| 엔드포인트 | 동작 |
|---|---|
| `POST /api/v1/challenges` `{readingRecordId, budgetSec}` | 생성(즉시 running 시작). 기록 소유·READING 상태·**총쪽수 존재**(없으면 `CHALLENGE_REQUIRES_PAGES` 400 — 완독 판정 불가) 검증, ACTIVE 중복이면 `CHALLENGE_ALREADY_ACTIVE`(409) |
| `GET /api/v1/challenges/active` | 내 ACTIVE 챌린지 목록 (지연 만료 적용 후) — 홈 섹션용 |
| `GET /api/v1/challenges/{id}` | 단건 (지연 만료 적용) |
| `POST /api/v1/challenges/{id}/start` | 재개 — running=true, last_started_at=now. 이미 running이면 무해(멱등) |
| `POST /api/v1/challenges/{id}/pause` | 일시정지 — elapsed 확정, running=false. 이미 멈춤이면 멱등 |
| `PATCH /api/v1/challenges/{id}/progress` `{currentPage}` | 쪽수 입력 — 서재 기록 진도 갱신(기존 진도 갱신 로직 재사용). `currentPage >= totalPages`면 **SUCCEEDED** 전이(+서재 기록 FINISHED 처리, 타임워치 정지) |
| `DELETE /api/v1/challenges/{id}` | 포기 — CANCELLED |

응답 `ChallengeView { id, readingRecordId, book: BookSummary, budgetSec, elapsedSec,
remainingSec, running, status, currentPage, totalPages, completedAt }` — elapsed/remaining은
서버가 now 기준 계산해 내려줌. 스키마 이름·필드는 앱 코드젠 계약.

- 새 ErrorCode: `CHALLENGE_NOT_FOUND`(404), `CHALLENGE_ALREADY_ACTIVE`(409),
  `CHALLENGE_NOT_ACTIVE`(400 — 종료된 챌린지에 전이 시도).
- 기존 reading_sessions·검증과 미연동 (추후 백로그 — 챌린지 시간을 세션으로도 기록).

## 앱 (project-bookey-app)

### 홈 챌린지 섹션 (`ChallengeRow`, 히어로 아래)

- `GET /challenges/active` (`['challenges','active']`). 카드: 표지(소) + 책 제목 +
  **남은 시간 카운트다운**(로컬 1초 티크, running일 때만 감소) + ▶/⏸ 상태 + 진도 `p/총`.
  탭 → `/challenge/{id}`. 맨 끝 "+ 새 챌린지" 점선 타일 → `/challenge/new`.
  ACTIVE 0건이면 + 타일만(섹션 유지 — 콘텐츠 발견 겸 진입점).

### 생성 화면 (`/challenge/new`)

- **책 선정 2경로** (2026-09-01 확장 — 사용자 결정):
  ① 읽는 중 책 목록(`['library','READING']` 재사용)에서 선택 —
  ② **상단 검색 바**(디바운스 400ms·2자, 검색 화면 문법)로 아무 책이나 검색해 선택.
  검색 결과 중 총쪽수 없는 책은 "쪽수 없음" 태그와 함께 선택 비활성(서버도
  `CHALLENGE_REQUIRES_PAGES`로 거부).
- 예산 입력(시간·분, 합산 budgetSec, 최소 10분) → "챌린지 시작" → `/challenge/{id}` 교체 이동.
- **생성 API 확장**: `POST /challenges`가 `readingRecordId` 또는 `bookId` 중 하나를 받는다.
  `bookId`인 경우 서버가 원자적으로 처리 — 내 최신 기록이 있으면 사용(READING이면 그대로,
  WANT_TO_READ·PAUSED면 READING으로 전환, FINISHED·ABANDONED면 `CHALLENGE_INVALID_RECORD`),
  없으면 서재에 READING으로 자동 담은 뒤 챌린지 생성.
- 재도전 프리필: `/challenge/new?recordId=&budgetSec=` 파라미터 지원.

### 챌린지 화면 (`/challenge/[id]`)

- **타임워치**: 남은 시간 대형 표시(`sans.extraBold`, HH:MM:SS), 예산 게이지 바
  (남은 비율, `accent` — 20% 미만이면 `warn`, 소진 임박 시각화). 서버 `remainingSec` 기준
  로컬 티크; 화면 진입·전이 시 서버 재동기화.
- **컨트롤**: running이면 [⏸ 일시정지], 아니면 [▶ 재개]. 하단에 [포기](2탭 확인 —
  기존 `ConfirmButton`).
- **쪽수 입력**: 현재 쪽 TextInput(숫자) + [기록] → `PATCH /progress`. 응답 status가
  SUCCEEDED면 → **성공 상태**: 폭죽 + "완독! 🎉" 카드(걸린 시간 `budgetSec-remainingSec`,
  총 쪽수) + [홈으로]. `['library']`·`['challenges','active']` invalidate.
- **실패 상태**(서버가 FAILED 반환/전이): "시간이 다 됐어요" + 최종 진도 + [재도전]
  (프리필 생성 화면) + [홈으로].
- 로컬 티크가 0에 도달하면 서버 단건 재조회로 확정(FAILED 판정은 서버가).

### 폭죽 (`src/components/Confetti.tsx`, 공용)

- 의존성 0 — `Animated`로 파티클 ~40개(팔레트 색: accent·warn·danger·onChrome 혼합)를
  상단에서 낙하+회전. `Confetti({ run })` — run true 시 1회 재생. 추후 다른 축하에 재사용.

### 쿼리·기타

- 새 쿼리 키: `['challenges','active']`, `['challenge', id]`. 홈 새로고침 refetch에
  `['challenges','active']` 추가.
- 홈 챌린지 카드의 카운트다운은 표시용 — 전이·판정은 전부 서버.

## 검증

- 백엔드: 전이 규칙(effectiveElapsed/remaining/isExpired/지연 만료·성공 전이) 순수 단위
  테스트 + `mvnw test` 회귀 + 기동 스모크(라우트 401, OpenAPI에 ChallengeView).
- 앱: `npm run typecheck` + 웹 육안(생성 → 카운트다운 → 일시정지/재개 → 쪽수 입력 →
  성공 폭죽 · 짧은 예산으로 실패 → 재도전).
