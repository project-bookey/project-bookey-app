# 챌린지 (타임워치) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-09-01-reading-challenge-design.md`)대로 독서시간 예산 챌린지를 백엔드(V7·전이 규칙·API 6종)와 앱(홈 섹션·생성/진행 화면·폭죽)에 구현한다.

**Architecture:** 시간의 진실은 서버 — 엔티티의 순수 전이 메서드(`effectiveElapsedSec`/`pause`/`resume`/`fail`/`succeed`)를 TDD로 만들고, 서비스는 지연 만료 후 전이만 조율한다. 앱은 서버 `remainingSec` 스냅샷 + 로컬 1초 티크로 표시하고 모든 전이는 API 호출.

**Tech Stack:** Spring Boot 4.1/Java 21/Flyway · Expo RN + react-query. 새 의존성 없음(폭죽은 RN Animated 커스텀).

## Global Constraints

- **커밋 규칙**: AI 어트리뷰션 금지, 첫 줄 "신규:"/"수정:" 접두 + 한국어.
- 백엔드 Maven: `JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7'` 프리픽스 필수. 저장소: BE `D:\Develop\workspace\myproject\project-bookey-backend`(server/), APP `D:\Develop\workspace\myproject\project-bookey-app`.
- 엔티티: 클래스 레벨 `@Builder` 금지 — 필드 제한 private 생성자에 `@Builder`.
- `ChallengeView` 스키마·필드는 앱 코드젠 계약: `{ id, readingRecordId, book, budgetSec, elapsedSec, remainingSec, running, status, currentPage, totalPages, completedAt }`.
- 새 앱 파일은 새 토큰 API만. 검증 게이트: BE `./mvnw test`, APP `npm run typecheck`.

---

### Task 1 (BE): V7 + ReadingChallenge 엔티티·전이 규칙 (TDD)

**Files:**
- Create: `server/src/main/resources/db/migration/V7__reading_challenges.sql`
- Create: `server/src/main/java/app/bookey/domain/challenge/ReadingChallenge.java`
- Create: `server/src/main/java/app/bookey/domain/challenge/ChallengeStatus.java`
- Create: `server/src/main/java/app/bookey/domain/challenge/ReadingChallengeRepository.java`
- Test: `server/src/test/java/app/bookey/domain/challenge/ReadingChallengeTest.java`

**Interfaces:**
- Produces: `ReadingChallenge`(순수 메서드 `effectiveElapsedSec(Instant)`, `remainingSec(Instant)`, `isExpired(Instant)`, `resume(Instant)`, `pause(Instant)`, `fail(Instant)`, `succeed(Instant)`, `cancel(Instant)`), `ChallengeStatus { ACTIVE, SUCCEEDED, FAILED, CANCELLED }`, `ReadingChallengeRepository.findAllByUserIdAndStatus(Long, ChallengeStatus)` · `findByIdAndUserId(Long, Long)` · `existsByReadingRecordIdAndStatus(Long, ChallengeStatus)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package app.bookey.domain.challenge;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ReadingChallengeTest {

    private static final Instant T0 = Instant.parse("2026-09-01T12:00:00Z");

    private ReadingChallenge challenge(int budgetSec) {
        ReadingChallenge c = ReadingChallenge.builder()
                .userId(1L).readingRecordId(10L).budgetSec(budgetSec).build();
        c.resume(T0); // 생성 즉시 시작
        return c;
    }

    @Test
    @DisplayName("타임워치가 도는 동안만 시간이 소모된다")
    void elapsedCountsOnlyWhileRunning() {
        ReadingChallenge c = challenge(3600);
        assertThat(c.effectiveElapsedSec(T0.plusSeconds(100))).isEqualTo(100);

        c.pause(T0.plusSeconds(100));
        assertThat(c.effectiveElapsedSec(T0.plusSeconds(500))).isEqualTo(100); // 멈춤 동안 고정

        c.resume(T0.plusSeconds(500));
        assertThat(c.effectiveElapsedSec(T0.plusSeconds(700))).isEqualTo(300); // 100 + 200
        assertThat(c.remainingSec(T0.plusSeconds(700))).isEqualTo(3300);
    }

    @Test
    @DisplayName("일시정지·재개는 멱등이다")
    void pauseAndResumeAreIdempotent() {
        ReadingChallenge c = challenge(3600);
        c.pause(T0.plusSeconds(50));
        c.pause(T0.plusSeconds(80)); // 두 번째 pause는 무해
        assertThat(c.effectiveElapsedSec(T0.plusSeconds(80))).isEqualTo(50);

        c.resume(T0.plusSeconds(100));
        c.resume(T0.plusSeconds(150)); // 두 번째 resume은 구간 시작을 덮지 않는다
        assertThat(c.effectiveElapsedSec(T0.plusSeconds(200))).isEqualTo(150); // 50 + 100
    }

    @Test
    @DisplayName("예산 소진 시 만료되고, fail은 경과를 예산으로 고정한다")
    void failCapsElapsedAtBudget() {
        ReadingChallenge c = challenge(100);
        assertThat(c.isExpired(T0.plusSeconds(99))).isFalse();
        assertThat(c.isExpired(T0.plusSeconds(100))).isTrue();

        c.fail(T0.plusSeconds(250));
        assertThat(c.getStatus()).isEqualTo(ChallengeStatus.FAILED);
        assertThat(c.isRunning()).isFalse();
        assertThat(c.getElapsedSec()).isEqualTo(100); // 예산 초과분은 버림
        assertThat(c.getCompletedAt()).isEqualTo(T0.plusSeconds(250));
    }

    @Test
    @DisplayName("성공 전이는 타임워치를 멈추고 경과를 확정한다")
    void succeedStopsWatch() {
        ReadingChallenge c = challenge(3600);
        c.succeed(T0.plusSeconds(1200));
        assertThat(c.getStatus()).isEqualTo(ChallengeStatus.SUCCEEDED);
        assertThat(c.isRunning()).isFalse();
        assertThat(c.getElapsedSec()).isEqualTo(1200);
        assertThat(c.remainingSec(T0.plusSeconds(9999))).isEqualTo(2400); // 종료 후 고정
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cd .../server && JAVA_HOME=... ./mvnw test -Dtest=ReadingChallengeTest` → 컴파일 오류(클래스 없음).

- [ ] **Step 3: 구현**

`V7__reading_challenges.sql`:

```sql
-- 챌린지 — 독서시간 예산 타임워치 (스펙: app 저장소 2026-09-01-reading-challenge-design.md)
CREATE TABLE reading_challenges (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_record_id BIGINT NOT NULL REFERENCES reading_records(id) ON DELETE CASCADE,
    budget_sec        INT NOT NULL CHECK (budget_sec > 0),
    elapsed_sec       INT NOT NULL DEFAULT 0,
    running           BOOLEAN NOT NULL DEFAULT FALSE,
    last_started_at   TIMESTAMPTZ,
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE|SUCCEEDED|FAILED|CANCELLED
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_challenges_active ON reading_challenges(reading_record_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_challenges_user_status ON reading_challenges(user_id, status);
```

`ChallengeStatus.java`:

```java
package app.bookey.domain.challenge;

public enum ChallengeStatus { ACTIVE, SUCCEEDED, FAILED, CANCELLED }
```

`ReadingChallenge.java`:

```java
package app.bookey.domain.challenge;

import app.bookey.common.support.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.Instant;

/**
 * 챌린지 — 독서시간 예산 타임워치. 시간의 진실은 서버:
 * running 구간의 경과는 last_started_at과 now의 차로 계산한다 (§F3 철학).
 */
@Getter
@Entity
@Table(name = "reading_challenges")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReadingChallenge extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reading_record_id", nullable = false)
    private Long readingRecordId;

    @Column(name = "budget_sec", nullable = false)
    private int budgetSec;

    @Column(name = "elapsed_sec", nullable = false)
    private int elapsedSec;

    @Column(nullable = false)
    private boolean running;

    @Column(name = "last_started_at")
    private Instant lastStartedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChallengeStatus status = ChallengeStatus.ACTIVE;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Builder
    private ReadingChallenge(Long userId, Long readingRecordId, int budgetSec) {
        this.userId = userId;
        this.readingRecordId = readingRecordId;
        this.budgetSec = budgetSec;
        this.status = ChallengeStatus.ACTIVE;
    }

    /** 확정 누적 + (도는 중이면) 이번 구간 경과. */
    public int effectiveElapsedSec(Instant now) {
        long base = elapsedSec;
        if (running && lastStartedAt != null) {
            base += Math.max(0, Duration.between(lastStartedAt, now).getSeconds());
        }
        return (int) Math.min(Integer.MAX_VALUE, base);
    }

    public int remainingSec(Instant now) {
        return Math.max(0, budgetSec - effectiveElapsedSec(now));
    }

    public boolean isExpired(Instant now) {
        return effectiveElapsedSec(now) >= budgetSec;
    }

    /** 재개 — 이미 도는 중이면 무해(구간 시작을 덮지 않는다). */
    public void resume(Instant now) {
        if (!running) {
            running = true;
            lastStartedAt = now;
        }
    }

    /** 일시정지 — 경과 확정. 이미 멈춰 있으면 무해. */
    public void pause(Instant now) {
        if (running) {
            elapsedSec = effectiveElapsedSec(now);
            running = false;
            lastStartedAt = null;
        }
    }

    /** 만료 실패 — 경과는 예산으로 고정한다. */
    public void fail(Instant now) {
        pause(now);
        elapsedSec = Math.min(elapsedSec, budgetSec);
        status = ChallengeStatus.FAILED;
        completedAt = now;
    }

    public void succeed(Instant now) {
        pause(now);
        status = ChallengeStatus.SUCCEEDED;
        completedAt = now;
    }

    public void cancel(Instant now) {
        pause(now);
        status = ChallengeStatus.CANCELLED;
        completedAt = now;
    }
}
```

`ReadingChallengeRepository.java`:

```java
package app.bookey.domain.challenge;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReadingChallengeRepository extends JpaRepository<ReadingChallenge, Long> {
    List<ReadingChallenge> findAllByUserIdAndStatusOrderByCreatedAtDesc(Long userId, ChallengeStatus status);
    Optional<ReadingChallenge> findByIdAndUserId(Long id, Long userId);
    boolean existsByReadingRecordIdAndStatus(Long readingRecordId, ChallengeStatus status);
}
```

주의: `BaseTimeEntity`가 `updated_at`을 매핑하므로 V7에 이미 포함했다. `ReadingChallengeTest`의 리포지토리 메서드명과 정확히 일치시킬 것.

- [ ] **Step 4: 통과 확인** — `./mvnw test -Dtest=ReadingChallengeTest` → 4 PASS.
- [ ] **Step 5: 전체 + 커밋**

Run: `./mvnw test` → 전체 PASS (73+4).

```bash
git add server/src/main/resources/db/migration/V7__reading_challenges.sql server/src/main/java/app/bookey/domain/challenge server/src/test/java/app/bookey/domain/challenge
git commit -m "신규: 챌린지 스키마·엔티티 — 타임워치 전이 규칙"
```

---

### Task 2 (BE): 챌린지 API

**Files:**
- Create: `server/src/main/java/app/bookey/api/challenge/dto/ChallengeDtos.java`
- Create: `server/src/main/java/app/bookey/api/challenge/ChallengeService.java`
- Create: `server/src/main/java/app/bookey/api/challenge/ChallengeController.java`
- Modify: `server/src/main/java/app/bookey/common/error/ErrorCode.java` (4개 추가)

**Interfaces:**
- Consumes: Task 1 전부, 기존 `LibraryService`의 진도 갱신·완독 처리 public 메서드(정확한 시그니처는 `LibraryController`가 호출하는 메서드를 확인해 재사용 — 진도: PATCH `/library/{id}/progress` 경로의 서비스 메서드, 완독: POST `/library/{id}/finish` 경로의 메서드), `ReadingRecordRepository`, `BookRepository`, `BookSummary.from`
- Produces: 스펙 표의 API 6종, `ChallengeDtos.ChallengeView`·`CreateChallengeRequest(readingRecordId, budgetSec)`·`ChallengeProgressRequest(currentPage)`

- [ ] **Step 1: ErrorCode 추가** (기존 스타일대로)

```java
CHALLENGE_NOT_FOUND(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."),
CHALLENGE_ALREADY_ACTIVE(HttpStatus.CONFLICT, "이 책에는 진행 중인 챌린지가 이미 있습니다."),
CHALLENGE_NOT_ACTIVE(HttpStatus.BAD_REQUEST, "이미 종료된 챌린지입니다."),
CHALLENGE_REQUIRES_PAGES(HttpStatus.BAD_REQUEST, "총 쪽수가 있는 책에만 챌린지를 걸 수 있습니다."),
CHALLENGE_INVALID_RECORD(HttpStatus.BAD_REQUEST, "읽는 중인 책에만 챌린지를 걸 수 있습니다."),
```

- [ ] **Step 2: DTO·서비스·컨트롤러**

`ChallengeDtos.java`:

```java
package app.bookey.api.challenge.dto;

import app.bookey.api.book.dto.BookDtos.BookSummary;
import app.bookey.domain.challenge.ChallengeStatus;
import app.bookey.domain.challenge.ReadingChallenge;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class ChallengeDtos {
    private ChallengeDtos() {}

    public record CreateChallengeRequest(@NotNull Long readingRecordId, @Min(600) int budgetSec) {}

    public record ChallengeProgressRequest(@Min(0) int currentPage) {}

    /** 챌린지 상태 — elapsed/remaining은 서버가 now 기준으로 계산해 내려준다. */
    public record ChallengeView(
            @NotNull Long id,
            @NotNull Long readingRecordId,
            BookSummary book,
            int budgetSec,
            int elapsedSec,
            int remainingSec,
            boolean running,
            @NotNull ChallengeStatus status,
            int currentPage,
            int totalPages,
            Instant completedAt
    ) {
        public static ChallengeView of(ReadingChallenge c, BookSummary book,
                                       int currentPage, int totalPages, Instant now) {
            return new ChallengeView(c.getId(), c.getReadingRecordId(), book,
                    c.getBudgetSec(), c.effectiveElapsedSec(now), c.remainingSec(now),
                    c.isRunning(), c.getStatus(), currentPage, totalPages, c.getCompletedAt());
        }
    }
}
```

`ChallengeService.java` — 핵심 뼈대 (진도·완독 메서드명은 실제 `LibraryService`를 확인해 맞춘다):

```java
package app.bookey.api.challenge;

import app.bookey.api.book.dto.BookDtos.BookSummary;
import app.bookey.api.challenge.dto.ChallengeDtos.ChallengeProgressRequest;
import app.bookey.api.challenge.dto.ChallengeDtos.ChallengeView;
import app.bookey.api.challenge.dto.ChallengeDtos.CreateChallengeRequest;
import app.bookey.api.library.LibraryService;
import app.bookey.common.error.ApiException;
import app.bookey.common.error.ErrorCode;
import app.bookey.domain.book.Book;
import app.bookey.domain.book.BookRepository;
import app.bookey.domain.challenge.ChallengeStatus;
import app.bookey.domain.challenge.ReadingChallenge;
import app.bookey.domain.challenge.ReadingChallengeRepository;
import app.bookey.domain.reading.ReadingRecord;
import app.bookey.domain.reading.ReadingRecordRepository;
import app.bookey.domain.reading.ReadingStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChallengeService {

    private final ReadingChallengeRepository challengeRepository;
    private final ReadingRecordRepository recordRepository;
    private final BookRepository bookRepository;
    private final LibraryService libraryService;

    @Transactional
    public ChallengeView create(Long userId, CreateChallengeRequest req) {
        ReadingRecord record = ownedRecord(userId, req.readingRecordId());
        if (record.getStatus() != ReadingStatus.READING) {
            throw ApiException.of(ErrorCode.CHALLENGE_INVALID_RECORD);
        }
        if (totalPages(record) <= 0) {
            throw ApiException.of(ErrorCode.CHALLENGE_REQUIRES_PAGES);
        }
        if (challengeRepository.existsByReadingRecordIdAndStatus(record.getId(), ChallengeStatus.ACTIVE)) {
            throw ApiException.of(ErrorCode.CHALLENGE_ALREADY_ACTIVE);
        }
        Instant now = Instant.now();
        ReadingChallenge challenge = ReadingChallenge.builder()
                .userId(userId).readingRecordId(record.getId()).budgetSec(req.budgetSec())
                .build();
        challenge.resume(now); // 생성 즉시 시작
        return view(challengeRepository.save(challenge), record, now);
    }

    @Transactional
    public List<ChallengeView> active(Long userId) {
        Instant now = Instant.now();
        return challengeRepository.findAllByUserIdAndStatusOrderByCreatedAtDesc(userId, ChallengeStatus.ACTIVE)
                .stream()
                .map(c -> { lazyExpire(c, now); return view(c, ownedRecord(userId, c.getReadingRecordId()), now); })
                .toList();
    }

    @Transactional
    public ChallengeView get(Long userId, Long id) {
        Instant now = Instant.now();
        ReadingChallenge c = owned(userId, id);
        lazyExpire(c, now);
        return view(c, ownedRecord(userId, c.getReadingRecordId()), now);
    }

    @Transactional
    public ChallengeView resume(Long userId, Long id) {
        return transition(userId, id, (c, now) -> c.resume(now));
    }

    @Transactional
    public ChallengeView pause(Long userId, Long id) {
        return transition(userId, id, (c, now) -> c.pause(now));
    }

    @Transactional
    public ChallengeView progress(Long userId, Long id, ChallengeProgressRequest req) {
        Instant now = Instant.now();
        ReadingChallenge c = owned(userId, id);
        lazyExpire(c, now);
        if (c.getStatus() != ChallengeStatus.ACTIVE) {
            throw ApiException.of(ErrorCode.CHALLENGE_NOT_ACTIVE);
        }
        // 서재 진도 갱신 재사용 (실제 메서드명은 LibraryController 참조)
        libraryService.updateProgress(userId, c.getReadingRecordId(), req.currentPage());
        ReadingRecord record = ownedRecord(userId, c.getReadingRecordId());
        if (req.currentPage() >= totalPages(record)) {
            c.succeed(now);
            libraryService.finish(userId, c.getReadingRecordId(), null); // 완독 처리 재사용
            record = ownedRecord(userId, c.getReadingRecordId());
        }
        return view(c, record, now);
    }

    @Transactional
    public void cancel(Long userId, Long id) {
        Instant now = Instant.now();
        ReadingChallenge c = owned(userId, id);
        lazyExpire(c, now);
        if (c.getStatus() != ChallengeStatus.ACTIVE) {
            throw ApiException.of(ErrorCode.CHALLENGE_NOT_ACTIVE);
        }
        c.cancel(now);
    }

    // ── 내부 ─────────────────────────────────────────────
    private interface Transition { void apply(ReadingChallenge c, Instant now); }

    private ChallengeView transition(Long userId, Long id, Transition t) {
        Instant now = Instant.now();
        ReadingChallenge c = owned(userId, id);
        lazyExpire(c, now);
        if (c.getStatus() != ChallengeStatus.ACTIVE) {
            throw ApiException.of(ErrorCode.CHALLENGE_NOT_ACTIVE);
        }
        t.apply(c, now);
        return view(c, ownedRecord(userId, c.getReadingRecordId()), now);
    }

    /** ACTIVE인데 예산을 다 썼으면 실패로 확정한다 (지연 만료). */
    private void lazyExpire(ReadingChallenge c, Instant now) {
        if (c.getStatus() == ChallengeStatus.ACTIVE && c.isExpired(now)) {
            c.fail(now);
        }
    }

    private ReadingChallenge owned(Long userId, Long id) {
        return challengeRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.of(ErrorCode.CHALLENGE_NOT_FOUND));
    }

    private ReadingRecord ownedRecord(Long userId, Long recordId) {
        return recordRepository.findById(recordId)
                .filter(r -> r.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.of(ErrorCode.RECORD_NOT_FOUND));
    }

    private int totalPages(ReadingRecord record) {
        if (record.getTotalPagesOverride() != null && record.getTotalPagesOverride() > 0) {
            return record.getTotalPagesOverride();
        }
        Book book = bookRepository.findById(record.getBookId()).orElse(null);
        return book != null && book.getTotalPages() != null ? book.getTotalPages() : 0;
    }

    private ChallengeView view(ReadingChallenge c, ReadingRecord record, Instant now) {
        Book book = bookRepository.findById(record.getBookId()).orElse(null);
        BookSummary summary = book != null ? BookSummary.from(book) : null;
        return ChallengeView.of(c, summary, record.getCurrentPage(), totalPages(record), now);
    }
}
```

`ChallengeController.java`:

```java
package app.bookey.api.challenge;

import app.bookey.api.challenge.dto.ChallengeDtos.ChallengeProgressRequest;
import app.bookey.api.challenge.dto.ChallengeDtos.ChallengeView;
import app.bookey.api.challenge.dto.ChallengeDtos.CreateChallengeRequest;
import app.bookey.common.security.AuthUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Challenge", description = "챌린지 — 독서시간 예산 타임워치")
@RestController
@RequestMapping("/api/v1/challenges")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;

    @Operation(summary = "챌린지 생성 — 즉시 시작")
    @PostMapping
    public ChallengeView create(@AuthenticationPrincipal AuthUser user,
                                @Valid @RequestBody CreateChallengeRequest request) {
        return challengeService.create(user.id(), request);
    }

    @Operation(summary = "진행 중 챌린지 목록")
    @GetMapping("/active")
    public List<ChallengeView> active(@AuthenticationPrincipal AuthUser user) {
        return challengeService.active(user.id());
    }

    @Operation(summary = "챌린지 단건")
    @GetMapping("/{id}")
    public ChallengeView get(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return challengeService.get(user.id(), id);
    }

    @Operation(summary = "타임워치 재개")
    @PostMapping("/{id}/start")
    public ChallengeView start(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return challengeService.resume(user.id(), id);
    }

    @Operation(summary = "타임워치 일시정지")
    @PostMapping("/{id}/pause")
    public ChallengeView pause(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return challengeService.pause(user.id(), id);
    }

    @Operation(summary = "쪽수 기록 — 총쪽수 도달 시 성공 전이")
    @PatchMapping("/{id}/progress")
    public ChallengeView progress(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                                  @Valid @RequestBody ChallengeProgressRequest request) {
        return challengeService.progress(user.id(), id, request);
    }

    @Operation(summary = "챌린지 포기")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        challengeService.cancel(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 3: 전체 테스트 + 커밋**

Run: `./mvnw test` → 전체 PASS. (`LibraryService`의 진도·완독 메서드명이 다르면 컴파일 오류로 드러난다 — `LibraryController`가 쓰는 public 메서드로 맞추고, `finish`가 rating 파라미터를 안 받으면 그에 맞춰 조정.)

```bash
git add server/src/main/java/app/bookey/api/challenge server/src/main/java/app/bookey/common/error/ErrorCode.java
git commit -m "신규: 챌린지 API — 생성·재개·일시정지·쪽수 기록·포기"
```

---

### Task 3 (APP): 타입 재생성 + challengeApi

**Files:** `src/api/generated.ts`(재생성) · `src/api/types.ts` · `src/api/endpoints.ts`

**Interfaces:**
- Consumes: 백엔드 서버(8080)가 Task 2 코드로 재기동된 상태 (컨트롤러가 처리)
- Produces: `Challenge = Schemas['ChallengeView']`, `challengeApi.create/active/get/start/pause/progress/cancel`

- [ ] **Step 1: 재생성 + 별칭 + 클라이언트**

`npm run types` (실패 시 수동 재현: `openapi.json` fetch → `npx openapi-typescript@7 --root-types` → 기존 헤더 유지).

`types.ts` (새 섹션):

```ts
// ── 챌린지 ───────────────────────────────────────────────
export type Challenge = Schemas['ChallengeView'];
export type ChallengeStatus = Challenge['status'];
```

`endpoints.ts` (하단):

```ts
export const challengeApi = {
  create: (body: { readingRecordId: number; budgetSec: number }) =>
    api<Challenge>('/api/v1/challenges', { method: 'POST', body }),
  active: () => api<Challenge[]>('/api/v1/challenges/active'),
  get: (id: number) => api<Challenge>(`/api/v1/challenges/${id}`),
  start: (id: number) => api<Challenge>(`/api/v1/challenges/${id}/start`, { method: 'POST' }),
  pause: (id: number) => api<Challenge>(`/api/v1/challenges/${id}/pause`, { method: 'POST' }),
  progress: (id: number, currentPage: number) =>
    api<Challenge>(`/api/v1/challenges/${id}/progress`, { method: 'PATCH', body: { currentPage } }),
  cancel: (id: number) => api<void>(`/api/v1/challenges/${id}`, { method: 'DELETE' }),
};
```

(import에 `Challenge` 추가.)

- [ ] **Step 2: 검증 + 커밋** — `npm run typecheck` → exit 0.

```bash
git add src/api/generated.ts src/api/types.ts src/api/endpoints.ts
git commit -m "신규: 챌린지 API 타입·클라이언트"
```

---

### Task 4 (APP): Confetti + ChallengeRow

**Files:**
- Create: `src/components/Confetti.tsx`
- Create: `src/components/home/ChallengeRow.tsx`

**Interfaces:**
- Consumes: Task 3의 `challengeApi`·`Challenge`
- Produces: `Confetti({ run })`(1회 재생 폭죽), `ChallengeRow()`(홈 섹션, 자체 쿼리 `['challenges','active']`), `useRemainingSec(challenge, dataUpdatedAt)`(ChallengeRow에서 export — Task 5 화면이 재사용)

- [ ] **Step 1: Confetti.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { darkColors } from '@/theme';

const COLORS = [darkColors.accent, darkColors.warn, darkColors.danger, '#F5F5F5', '#7B6BB0'];
const COUNT = 40;

/** 축하 폭죽 — 의존성 없이 Animated 파티클. run이 true가 되는 순간 1회 재생. */
export function Confetti({ run }: { run: boolean }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const played = useRef(false);

  useEffect(() => {
    if (run && !played.current) {
      played.current = true;
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [run, progress]);

  if (!run) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: COUNT }, (_, i) => {
        // 파티클별 고정 난수 대용 — 인덱스 기반 의사난수(재현 가능)
        const seed = (i * 9301 + 49297) % 233280 / 233280;
        const seed2 = (i * 233 + 977) % 1000 / 1000;
        const x = seed * width;
        const drift = (seed2 - 0.5) * 120;
        const size = 6 + seed2 * 6;
        const color = COLORS[i % COLORS.length];
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40 - seed2 * 200, height + 40],
        });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [x, x + drift] });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${360 + seed * 720}deg`],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size * 0.5,
              backgroundColor: color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </Animated.View>
  );
}
```

- [ ] **Step 2: ChallengeRow.tsx**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { challengeApi } from '@/api/endpoints';
import type { Challenge } from '@/api/types';
import { formatClock } from '@/components/ui';
import { radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 서버 remainingSec 스냅샷 + 로컬 1초 티크 — 표시 전용, 판정은 서버. */
export function useRemainingSec(challenge: Challenge | undefined, dataUpdatedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  const running = challenge?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  if (!challenge) return 0;
  const drift = running ? Math.floor((now - dataUpdatedAt) / 1000) : 0;
  return Math.max(0, challenge.remainingSec - drift);
}

function ChallengeCard({ challenge, dataUpdatedAt }: { challenge: Challenge; dataUpdatedAt: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const remaining = useRemainingSec(challenge, dataUpdatedAt);
  return (
    <Pressable
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      accessibilityRole="button"
      accessibilityLabel={challenge.book?.title ?? '챌린지'}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
        {challenge.book?.coverUrl ? (
          <Image source={{ uri: challenge.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text numberOfLines={3} style={[typeScale.caption, { color: colors.textMuted, padding: spacing.xs }]}>
            {challenge.book?.title}
          </Text>
        )}
      </View>
      <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
        {challenge.book?.title}
      </Text>
      <Text style={[{ fontFamily: sans.extraBold, fontSize: 18 }, { color: colors.accent }]}>
        {formatClock(remaining)}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>
        {challenge.running ? '▶ 진행 중' : '⏸ 일시정지'} · {challenge.currentPage}/{challenge.totalPages}쪽
      </Text>
    </Pressable>
  );
}

/** 홈 챌린지 섹션 — 진행 중 카드 + 맨 끝 '+ 새 챌린지' 타일. 0건이어도 유지. */
export function ChallengeRow() {
  const router = useRouter();
  const { colors } = useTheme();
  const challenges = useQuery({ queryKey: ['challenges', 'active'], queryFn: challengeApi.active });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>챌린지</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={challenges.data ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/challenge/new')}
            accessibilityRole="button"
            accessibilityLabel="새 챌린지"
            style={[styles.card, styles.createTile, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.title, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>새 챌린지</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <ChallengeCard challenge={item} dataUpdatedAt={challenges.dataUpdatedAt} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { width: 150, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  cover: { width: 52, height: 78, borderRadius: radius.sm, overflow: 'hidden' },
  createTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
});
```

주: `formatClock`이 `@/components/ui`에 없거나 시그니처(초 → "HH:MM:SS")가 다르면, `ChallengeRow.tsx` 안에 로컬 `formatClock(sec)`을 만들어 쓴다(시:분:초 zero-pad).

- [ ] **Step 3: 검증 + 커밋** — `npm run typecheck` → exit 0.

```bash
git add src/components/Confetti.tsx src/components/home/ChallengeRow.tsx
git commit -m "신규: 폭죽 컴포넌트·홈 챌린지 섹션"
```

---

### Task 5 (APP): 챌린지 화면 2개 + 라우트·홈 연결

**Files:**
- Create: `app/challenge/new.tsx`
- Create: `app/challenge/[id].tsx`
- Modify: `app/_layout.tsx` (Stack.Screen 2개 등록 — `challenge/new` "새 챌린지" · `challenge/[id]` "챌린지")
- Modify: `app/home.tsx` (`<ChallengeRow />`를 `<HeroContinue …/>` 바로 다음에 추가 + import, `refetchAll`에 `queryClient.invalidateQueries({ queryKey: ['challenges'] })` 추가 — `useQueryClient` import 필요)

**Interfaces:**
- Consumes: Task 3 `challengeApi`, Task 4 `Confetti`·`useRemainingSec`, 기존 `ConfirmButton`·`ApiError`·`libraryApi`

- [ ] **Step 1: app/challenge/new.tsx**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { challengeApi, libraryApi } from '@/api/endpoints';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 새 챌린지 — 읽는 중 책 선택 + 예산(시간·분) 입력. 재도전 프리필 지원. */
export default function NewChallengeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ recordId?: string; budgetSec?: string }>();

  const [recordId, setRecordId] = useState<number | null>(
    params.recordId ? Number(params.recordId) : null,
  );
  const preBudget = params.budgetSec ? Number(params.budgetSec) : 0;
  const [hours, setHours] = useState(preBudget ? String(Math.floor(preBudget / 3600)) : '');
  const [minutes, setMinutes] = useState(preBudget ? String(Math.floor((preBudget % 3600) / 60)) : '');

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const records = reading.data?.content ?? [];

  const budgetSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
  const valid = recordId != null && budgetSec >= 600;

  const create = useMutation({
    mutationFn: () => challengeApi.create({ readingRecordId: recordId!, budgetSec }),
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      router.replace(`/challenge/${challenge.id}`);
    },
  });
  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError ? create.error.message : '만들지 못했어요 · 다시 시도'
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={records}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[typeScale.section, { color: colors.text, marginBottom: spacing.sm }]}>
            어떤 책으로 도전할까요?
          </Text>
        }
        ListEmptyComponent={
          reading.isLoading ? null : (
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              읽는 중인 책이 없어요. 서재에서 책을 먼저 시작해주세요.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const selected = item.id === recordId;
          return (
            <Pressable
              onPress={() => setRecordId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.book?.title ?? '책'}
              style={[
                styles.row,
                { backgroundColor: colors.surface },
                selected && { borderWidth: 1, borderColor: colors.accent },
              ]}
            >
              <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
                {item.book?.coverUrl ? (
                  <Image source={{ uri: item.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {item.book?.title}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                  {item.progress.currentPage}/{item.progress.totalPages}쪽
                </Text>
              </View>
              {selected ? <Text style={[typeScale.label, { color: colors.accent }]}>✓</Text> : null}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={[typeScale.section, { color: colors.text }]}>예산 시간</Text>
            <View style={styles.budgetRow}>
              <TextInput
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
              />
              <Text style={[typeScale.body, { color: colors.textMuted }]}>시간</Text>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
              />
              <Text style={[typeScale.body, { color: colors.textMuted }]}>분</Text>
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>최소 10분부터 시작할 수 있어요.</Text>
            {errorMessage ? (
              <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
            ) : null}
            <Pressable
              disabled={!valid || create.isPending}
              onPress={() => create.mutate()}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent, opacity: !valid || create.isPending ? 0.5 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>
                {create.isPending ? '만드는 중…' : '⏱ 챌린지 시작'}
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { ...layout.content, padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cover: { width: 40, height: 60, borderRadius: radius.sm, overflow: 'hidden' },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetInput: {
    width: 72,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 18,
    textAlign: 'center',
  },
  cta: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 2: app/challenge/[id].tsx**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { challengeApi } from '@/api/endpoints';
import type { Challenge } from '@/api/types';
import { Confetti } from '@/components/Confetti';
import { ConfirmButton } from '@/components/ConfirmButton';
import { useRemainingSec } from '@/components/home/ChallengeRow';
import { formatClock } from '@/components/ui';
import { layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 챌린지 진행 — 타임워치·일시정지/재개·쪽수 기록·성공 폭죽·실패 재도전. */
export default function ChallengeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const challengeId = Number(id);

  const query = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => challengeApi.get(challengeId),
    enabled: Number.isFinite(challengeId),
  });
  const challenge = query.data;
  const remaining = useRemainingSec(challenge, query.dataUpdatedAt);

  // 로컬 티크가 0에 닿으면 서버로 확정(FAILED 판정은 서버가)
  useEffect(() => {
    if (challenge?.status === 'ACTIVE' && challenge.running && remaining === 0) {
      query.refetch();
    }
  }, [remaining, challenge?.status, challenge?.running]);

  const setCache = (c: Challenge) => {
    queryClient.setQueryData(['challenge', challengeId], c);
    queryClient.invalidateQueries({ queryKey: ['challenges', 'active'] });
  };
  const toggle = useMutation({
    mutationFn: () => (challenge?.running ? challengeApi.pause(challengeId) : challengeApi.start(challengeId)),
    onSuccess: setCache,
  });

  const [pageInput, setPageInput] = useState('');
  useEffect(() => {
    if (challenge && pageInput === '') {
      setPageInput(String(challenge.currentPage));
    }
  }, [challenge]);

  const progress = useMutation({
    mutationFn: () => challengeApi.progress(challengeId, Number(pageInput)),
    onSuccess: (c) => {
      setCache(c);
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => challengeApi.cancel(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges', 'active'] });
      router.back();
    },
  });

  const errorMessage = [toggle, progress, cancel]
    .map((m) => (m.isError && !m.isPending
      ? m.error instanceof ApiError ? m.error.message : '처리하지 못했어요 · 다시 시도'
      : null))
    .find((v) => v != null) ?? null;

  if (!challenge) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]} />;
  }

  const succeeded = challenge.status === 'SUCCEEDED';
  const failed = challenge.status === 'FAILED';
  const active = challenge.status === 'ACTIVE';
  const usedSec = challenge.budgetSec - challenge.remainingSec;
  const ratio = challenge.budgetSec > 0 ? remaining / challenge.budgetSec : 0;
  const gaugeColor = ratio < 0.2 ? colors.warn : colors.accent;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text numberOfLines={1} style={[typeScale.title, { color: colors.text, textAlign: 'center' }]}>
          {challenge.book?.title}
        </Text>

        {succeeded ? (
          <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.display, { color: colors.text, textAlign: 'center' }]}>완독! 🎉</Text>
            <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {formatClock(usedSec)} 만에 {challenge.totalPages}쪽을 읽었어요.
            </Text>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}>
              <Text style={[typeScale.label, { color: colors.onAccent }]}>홈으로</Text>
            </Pressable>
          </View>
        ) : failed ? (
          <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.display, { color: colors.text, textAlign: 'center' }]}>시간이 다 됐어요</Text>
            <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {challenge.currentPage}/{challenge.totalPages}쪽까지 읽었어요. 다시 도전해볼까요?
            </Text>
            <Pressable
              onPress={() =>
                router.replace(`/challenge/new?recordId=${challenge.readingRecordId}&budgetSec=${challenge.budgetSec}`)}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>재도전</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
              style={[styles.cta, { borderWidth: 1, borderColor: colors.lineStrong }]}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>홈으로</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.clock, { fontFamily: sans.extraBold, color: colors.text }]}>
              {formatClock(remaining)}
            </Text>
            <View style={[styles.gauge, { backgroundColor: colors.line }]}>
              <View style={[styles.gaugeFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: gaugeColor }]} />
            </View>
            <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              예산 {formatClock(challenge.budgetSec)} 중 남은 시간
            </Text>

            <Pressable
              disabled={toggle.isPending}
              onPress={() => toggle.mutate()}
              accessibilityRole="button"
              style={[styles.cta, {
                backgroundColor: challenge.running ? colors.surfaceRaised : colors.accent,
                opacity: toggle.isPending ? 0.6 : 1,
              }]}
            >
              <Text style={[typeScale.label, { color: challenge.running ? colors.text : colors.onAccent }]}>
                {challenge.running ? '⏸ 일시정지' : '▶ 재개'}
              </Text>
            </Pressable>

            <View style={[styles.pageCard, { backgroundColor: colors.surface }]}>
              <Text style={[typeScale.overline, { color: colors.accent }]}>지금 몇 쪽인가요?</Text>
              <View style={styles.pageRow}>
                <TextInput
                  value={pageInput}
                  onChangeText={setPageInput}
                  keyboardType="number-pad"
                  style={[styles.pageInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
                />
                <Text style={[typeScale.body, { color: colors.textMuted }]}>/ {challenge.totalPages}쪽</Text>
                <Pressable
                  disabled={progress.isPending || pageInput.trim() === ''}
                  onPress={() => progress.mutate()}
                  accessibilityRole="button"
                  style={[styles.recordButton, {
                    backgroundColor: colors.accent,
                    opacity: progress.isPending || pageInput.trim() === '' ? 0.5 : 1,
                  }]}
                >
                  <Text style={[typeScale.label, { color: colors.onAccent }]}>기록</Text>
                </Pressable>
              </View>
            </View>

            <ConfirmButton
              label="포기하기"
              question="정말 포기할까요?"
              tone="danger"
              variant="ghost"
              pending={cancel.isPending}
              onConfirm={() => cancel.mutate()}
            />
          </>
        )}

        {errorMessage && active ? (
          <Text style={[typeScale.caption, { color: colors.warn, textAlign: 'center' }]}>{errorMessage}</Text>
        ) : null}
      </ScrollView>
      <Confetti run={succeeded} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  clock: { fontSize: 56, textAlign: 'center', letterSpacing: 1 },
  gauge: { height: 6, borderRadius: radius.none, overflow: 'hidden' },
  gaugeFill: { height: 6 },
  cta: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  resultCard: { borderRadius: radius.md, padding: spacing.xl, gap: spacing.md },
  pageCard: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageInput: { width: 88, borderRadius: radius.md, padding: spacing.md, fontSize: 18, textAlign: 'center' },
  recordButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, marginLeft: 'auto' },
});
```

- [ ] **Step 3: 라우트 등록 + 홈 연결**

`app/_layout.tsx` — `club/join` 라인 근처에 추가:

```tsx
          <Stack.Screen name="challenge/new" options={{ title: '새 챌린지' }} />
          <Stack.Screen name="challenge/[id]" options={{ title: '챌린지' }} />
```

`app/home.tsx`:
- import 추가: `import { ChallengeRow } from '@/components/home/ChallengeRow';`, `useQueryClient`를 `@tanstack/react-query` import에 추가.
- 컴포넌트에 `const queryClient = useQueryClient();` 추가, `refetchAll`에 `queryClient.invalidateQueries({ queryKey: ['challenges'] });` 한 줄 추가.
- `<HeroContinue …/>` 바로 다음에 `<ChallengeRow />` 추가.

- [ ] **Step 4: 검증 + 커밋** — `npm run typecheck` → exit 0.

```bash
git add app/challenge app/_layout.tsx app/home.tsx
git commit -m "신규: 챌린지 화면 — 타임워치·쪽수 기록·성공 폭죽·재도전"
```

---

### Task 6: 스모크·육안 검증 (컨트롤러 수행)

- [ ] 백엔드 재기동(V7 적용) → `/api/v1/challenges/active` 401, OpenAPI에 `ChallengeView`.
- [ ] 웹 육안: 홈 챌린지 섹션 → 새 챌린지(책 선택·예산 입력) → 타임워치 감소 → 일시정지 시 멈춤·재개 → 쪽수 기록 → 총쪽수 도달 시 폭죽+완독 카드 → 서재 완독 반영. 짧은 예산(10분… 테스트는 progress로 성공 경로 우선)으로 실패 화면·재도전 프리필 확인.
