# 도서 상세 진척도 직접 수정 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [도서 상세 리디자인](2026-09-01-book-detail-redesign.md)

## 목표

도서 상세 '내 진척' 카드에서 현재 페이지를 화면에서 바로 고칠 수 있게 한다.
지금은 타이머 세션을 거쳐야만 진척이 갱신되는데, 책을 앱 밖에서 읽었거나
시작 페이지를 맞추고 싶을 때 수단이 없다. 서버에는 이미
`PATCH /library/{id}/progress` (`libraryApi.updateProgress`)가 있으므로 UI만 붙인다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 수정 방식 | 둘 다 — 진행 바 드래그(대략) + 큰 숫자 탭 입력(정밀) |
| 슬라이더 구현 | 커스텀 (PanResponder + onLayout) — 외부 슬라이더 라이브러리 미도입 |
| 시각 유지 | 평상시 바는 지금처럼 얇게(4px), 드래그 중에만 두껍게 + 썸 마커 |
| 범위 제한 | 0 ~ totalPages 클램프 · totalPages 없으면(0) 드래그 비활성 |
| 실패 처리 | 이전 값 복원 + warn 캡션 "처리하지 못했어요 · 다시 시도" |

## 동작 상세

1. **바 드래그/탭** — 진행 바를 감싸는 터치 영역을 세로 ~32px로 키운다.
   `onLayout`으로 바 너비를 재고, 탭/드래그 x좌표 → `round(x / width × totalPages)`로
   환산해 로컬 상태에 반영(큰 숫자·%·바가 즉시 따라 움직임). 손을 떼는 순간
   `updateProgress(rid, page)` 호출. 드래그 중에는 썸 마커(직각 사각형, `accent`)를 표시.
   `totalPages ≤ 0`이면 제스처를 붙이지 않는다(표시 전용 유지).
2. **숫자 탭 입력** — 큰 숫자를 탭하면 같은 자리에서 숫자 키패드 TextInput으로 전환.
   확정(submit/blur) 시 정수 파싱 → 0~totalPages 클램프 → `updateProgress` 호출.
   빈 값·숫자 아님이면 원래 값으로 복귀만 하고 호출하지 않는다.
   totalPages가 없어도 숫자 입력은 허용(클램프 상한 없음).
3. **뮤테이션** — `useMutation(libraryApi.updateProgress)` 성공 시 기존
   `invalidateRecord()` 재사용(`['library']` · `['library','record',rid]` ·
   `['review','preview',rid]`). 진행 중(`isPending`)에는 로컬 값을 그대로 보여
   깜빡임을 막고, 실패 시 서버 값으로 복원 + warn 캡션(기존 `actionFailed` 패턴에 합류).
4. **접근성** — 바에 `accessibilityRole="adjustable"` + label "진척도 조절",
   숫자에 `accessibilityRole="button"` + label "현재 페이지 수정".

## 구조 · 데이터

- **파일**: `app/book/[id].tsx`만 수정 — 진척 숫자+바를 화면 로컬 컴포넌트
  `ProgressEditor`로 묶는다 (드래그 로컬 상태·TextInput 전환·뮤테이션 소유).
- **API**: 변경 없음 — `libraryApi.updateProgress` 기존 것 사용.
- **의존성**: 추가 없음.
- 새 토큰만 사용 — 색은 `accent`/`line`/`warn`, 서체는 `sans.extraBold`(숫자) 유지.

## 검증

- `npm run typecheck`.
- 웹 육안: 바 탭·드래그로 숫자/%/바 동기 이동, 놓으면 서버 반영(새로고침 후 유지),
  숫자 탭 → 입력 → 확정/취소, 0·totalPages 초과 클램프, totalPages 없는 책(드래그 비활성),
  실패 시 복원(warn 캡션), 다크/라이트.
- 테스트 스위트 없음 — 추가하지 않는다.
