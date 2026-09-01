# 도서 상세 OTT 리디자인 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰](2026-08-31-design-tokens-design.md) · [홈](2026-08-31-home-redesign-design.md) · [검색](2026-09-01-search-redesign-design.md)

## 목표

도서 상세를 OTT 상세 페이지 문법(풀블리드 히어로 + 카드 섹션)으로 다시 만든다.
검색·홈·서재의 공통 목적지이며, 레거시 호환 레이어를 벗어나는 네 번째 화면.
기존 화면의 거친 동작(하차·완독 즉시 실행)과 공백(소개 미표시, 리뷰 쓰기 부재)을 고친다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 헤더 | 풀블리드 히어로 — 블러 표지 배경 + 스크림 + 중앙 원본 표지·제목 (시각 비교 A안) |
| 담기 CTA | 넣지 않음 — 담기는 검색 화면 전담, 상세는 정보·관리만 |
| 하차·완독 | 2탭 확인 — 버튼 자리가 "…할까요? [확정] [취소]"로 인라인 전환 |
| 소개 | `description` 3줄 + 더보기/접기 (없으면 섹션 숨김) |
| 리뷰 쓰기 | 이번에 포함 — 리뷰 섹션 인라인 폼 (별점 1~5 + 본문 + 등록) |
| 하차 사유 | 기존 기본값(`NOT_MY_TASTE`) 유지 — 사유 선택 UI는 백로그 |

## 화면 구성 (위→아래)

1. **풀블리드 히어로** — 높이 ~340. 표지 이미지를 `blurRadius 16`으로 확대해 배경,
   `darkColors.scrimStops` 그라데이션(expo-linear-gradient), 중앙에 원본 표지 110×165
   (`radius.sm`, 그림자) + 제목(`typeScale.title`, `darkColors.text`) + 저자·출판사·쪽수
   (`typeScale.caption`, `darkColors.textMuted`). 오버레이는 `darkColors` 고정(홈 히어로 문법).
   표지 없으면 배경은 `darkColors.surfaceRaised` 단색, 중앙 표지는 제목 폴백 타일.
2. **내 진척 카드** (record 있을 때만) — `surface` 배경 카드:
   현재 쪽 큰 숫자(`sans.extraBold` 28) + `/총쪽·%` + 진행 바(`accent`) + 지연 태그
   (`getLagStyle(colors)`, L0이면 숨김). KV 4종: 누적 독서시간 · 최근 7일 페이스 ·
   필요 페이스(있을 때) · 예상 완독일(있을 때).
   액션 — "▶ 독서 시작"(accent, → `/timer?recordId=`) · 완독 전이면 "완독 처리"(아웃라인,
   2탭 확인) · READING이면 "하차하기"(ghost, 2탭 확인).
3. **소개 카드** — `description` 3줄(`numberOfLines`) + "더보기/접기" 토글. 없으면 숨김.
4. **리뷰 검증 상태 카드** (record 있을 때) — 기대 배지 라벨 + "지금 리뷰를 쓰면 받게 될 배지"
   힌트 + KV(읽은 범위·타이머 세션·인정 독서시간) + 신호(warn). 기존 정보 그대로 새 토큰.
5. **세션 기록** — 최근 8건: `시작→끝쪽`, 상대시각·출처(타이머/수동), 시간, "검증 제외" 태그.
6. **리뷰 섹션** — 목록: 작성자 · 검증 배지(VERIFIED_FULL이면 `accent`/`accentSoft`) ·
   별점 · 본문. 빈 목록 문구 유지.
   **리뷰 쓰기**: record 있고 이 세션에서 아직 등록 안 했으면 섹션 헤더 우측 "리뷰 쓰기" 버튼 →
   인라인 폼 확장: 별점 1~5(★ 탭 선택, 선택 안 하면 별점 없이 등록 가능) + 본문
   멀티라인 TextInput + [등록]/[취소]. 등록 성공 → 폼 닫힘·버튼 숨김·`['book', bookId,
   'reviews']`와 `['review','preview',rid]` invalidate. 실패 → 폼 유지 + warn 캡션
   "등록하지 못했어요 · 다시 시도" (서버 메시지가 있으면 그 메시지).

## 2탭 확인 규칙 (`ConfirmButton`)

- 1탭: 버튼이 확인 상태로 전환 — 질문 텍스트 + [확정](danger 또는 accent) + [취소].
- 확정 탭: 뮤테이션 실행(`isPending` 동안 비활성). 성공 시 원상 복귀.
- 취소 탭 또는 뮤테이션 실패: 원래 버튼으로 복귀 (실패 시 warn 캡션 표시).
- 완독: "완독으로 기록할까요?" — 확정 버튼은 `accent`. / 하차: "정말 하차할까요?" — 확정 버튼은 `danger`.

## 구조 · 데이터

- **파일**: `app/book/[id].tsx` 전면 재작성 — 히어로·진척 카드·소개·검증·세션·리뷰(폼 포함)는
  화면 로컬 컴포넌트. **`src/components/ConfirmButton.tsx`만 공용 추출** (2탭 확인 패턴 —
  모임 탈퇴·종료 화면이 곧 재사용).
- **쿼리**: 기존 키 전부 유지 — `['book', bookId]`, `['library','record',rid]`,
  `['sessions', rid]`, `['review','preview',rid]`, `['book', bookId, 'reviews']`.
- **뮤테이션**: finish/abandon 기존 + `reviewApi.create({ readingRecordId, rating?, body })`
  신규. 성공 invalidate는 화면 구성 6번 참조. 완독·하차 성공 시 기존 invalidate 유지 +
  `['library','record',rid]` 추가(진척 카드 상태 갱신).
- **recordId 없음** (검색·추천 경유): 히어로 + 소개 + 리뷰 목록만. 진척·검증·세션·리뷰 쓰기 숨김.
- 새 토큰만 사용, 레거시 import 0.

## 검증

- `npm run typecheck` + 레거시 import grep 무매치.
- 웹 육안: 히어로(표지 유/무), record 유/무 분기, 2탭 확인(완독·하차·취소·실패 복귀),
  소개 접기, 리뷰 폼(별점·등록·실패), 다크/라이트.
- 로그인 상태 검수가 막히면 메모리의 `__preview` 목 데이터 우회를 쓴다.
- 테스트 스위트 없음 — 추가하지 않는다.
