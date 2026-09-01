# 콜라주 책상 전면 리디자인 — 디자인 스펙

2026-09-01. 사용자 시안(`책 커뮤니티 홈 - 시안.dc.html`, TURN 2 5화면: 서가·탐색·책 상세·광장·나) 기준.
브레인스토밍 확정: ① 풀 스코프(비주얼 전면 교체 + 밑줄·광장 신규 도메인) ② 상단 텍스트 라벨 네비 채택(서재는 '나'로 통합) ③ 표지 동적 효과 3종(입장 정착+스태거 · 프레스 리프트 · 히어로 패럴랙스, 아이들 모션 제외).

## 1. 디자인 언어

기존 OTT(넷플릭스풍) 언어를 "콜라주 책상"으로 교체한다 — 어두운 책상 위에 책·메모·스티키 노트가 흩어져 있는 감각. 흔한 앱처럼 보이지 않는 것이 목표.

- **색**: 근검정 배경 `#0c0e0d` + 민트 악센트 `#3ddc97`(다크). 라이트는 "종이" 등가(`#faf8f4` + 딥그린 `#177a54`). 블랙 크롬 폐기 — 헤더가 배경과 동화된다.
- **활자**: 나눔명조(세리프) = 표제·섹션 헤딩·인용문. Pretendard = 본문(시안의 IBM Plex Sans KR 대체 — 시각 등가·기번들). IBM Plex Mono = 아이브로우·라벨·숫자(한글 글리프는 시스템 폴백 — 시안 웹 동작과 동일).
- **질감**: 화면 배경에 16px 간격 1px 도트 그리드(`dotGrid` 토큰).
- **형태**: 칩·CTA는 pill(999) — 기존 "pill 금지" 규칙 반전. 카드 md 6 / lg 10, 책 표지 sm 2 유지.
- **콜라주 요소**: 기울어진 표지(`tilt` 토큰 -4°~6° 순환), 더블 표지 스택, 민트 스티키 노트(`note`), dashed 메모 조각, 가로 행 지그재그 오프셋(`rowOffsetY`), 깊은 그림자(다크에서도 — `cardShadow.dark` 반전, `coverShadow {rest,lifted}`).

## 2. 팔레트 (ColorTokens)

| 키 | dark | light |
|---|---|---|
| bg | `#0c0e0d` | `#faf8f4` |
| surface | `#171a16` | `#ffffff` |
| surfaceRaised | `#1d211c` | `#efece4` |
| text / textMuted / textFaint | `#e8e6e1` / `#9a9790` / `#6f6d66` | `#1a1c18` / `#57554f` / `#8b887f` |
| line / lineStrong | `#23261f` / `#33372e` | `#e5e1d7` / `#cfcabc` |
| accent / onAccent / accentSoft | `#3ddc97` / `#0c0e0d` / `#16352a` | `#177a54` / `#ffffff` / `#ddf2e7` |
| chrome / onChrome / onChromeFaint | =bg / =text / =textFaint | =bg / =text / =textFaint |
| **신규** bgAlt | `#131413` | `#f4f1ea` |
| **신규** surfaceDeep | `#141712` | `#f1eee6` |
| **신규** dotGrid | `#1b1e1a` | `#e7e3d9` |
| **신규** note / onNote | `#3ddc97` / `#0c0e0d` | `#177a54` / `#ffffff` |
| **신규** mid | `#8c8981` | `#6e6b63` |

warn/danger/scrim 유지. `brandGradientStops`는 새 민트 기준 재조정.

## 3. 타입 스케일 추가

`serif`(NanumMyeongjo 400/700/800), `mono`(IBMPlexMono 400/500/600) 패밀리 상수. typeScale 추가: `displaySerif`(extraBold 30/40, ls -0.5), `titleSerif`(bold 22/30), `quote`(regular 17/28), `monoLabel`(medium 11, ls 1.2), `monoEyebrow`(semiBold 10, ls 2), `monoNumeral`(semiBold 13). 기존 Pretendard 스케일 유지.

## 4. 모션 토큰

`tilt = [-4, -2, 3, -3, 5, -2, 6, 2]` + `tiltFor(i)`(인덱스 순환), `stagger = {step: 60, max: 8}`, `rowOffsetY = [0, 10, 4, 14, 6, 12]`. 동적 효과는 reanimated 4 — TiltCover 단일 컴포넌트가 입장(opacity/translateY/rotate 스프링+지연)·프레스(scale 1.04·rotate→0·lifted 그림자 프록시 opacity)를 담당, 홈 히어로는 스크롤 배속 translateY 패럴랙스(표지 0.25x·노트 0.45x·표제 0.12x, 레이어 3개 제한).

## 5. 네비게이션

4구역 상단 텍스트 라벨 네비(`SectionNav`): 서가(/home)·탐색(/search)·광장(/plaza 신규)·나(/profile). 활성 = titleSerif + 민트 2px 언더라인, 전환은 `router.replace`. 우측 슬롯 알림 종. 서브 화면은 `SubHeader`(`← / 카테고리(monoEyebrow) / ⋯`). `/library`(전체 서재 그리드)·`/clubs`(토론 모임)는 서브 루트로 존치. LogoHome·HomeHeaderIcons·블랙 크롬은 폐기.

## 6. 화면

- **서가(홈)**: 검색바 → 배너 → 히어로 콜라주(더블 표지 스택+스티키 노트 스트릭+세리프 표제+pill CTA, 패럴랙스) → 지금 붐비는 책(스태거 행+랭크 배지) → 추천 → 읽는 중 → 읽고 싶은 → 챌린지 → 모임 → 오려둔 문장(광장 QUOTE 상위 3, A8에서).
- **탐색**: pill 검색바 → '상황으로' 무드 칩(클라 고정 키워드 매핑) → '오늘의 한 칸'(추천 캐시 날짜 시드 랜덤 1권) → 추천 스태거 행 → 결과 행 re-skin.
- **책 상세**: SubHeader + 콜라주 표지 스택 + 세리프 표제. 스탯 스트립은 실존 필드만(verifiedRating·verifiedReviewCount·likeCount — '가장 많이 접힌'은 서버 데이터 없어 드랍). 리뷰 = MemoScrap.
- **광장(신규)**: 필터 칩 전체·밑줄·완독 자랑·토론. 밑줄 = StickyNote/MemoScrap 교차 카드(세리프 인용+공감 토글), 완독 자랑 = 표지+배지 카드, 토론 = `/clubs` 진입. `+ 밑줄` 작성 시트. useInfiniteQuery.
- **나**: 세리프 닉네임 → 내 서가 가로 선반(READING+WANT_TO_READ, 전체보기→/library) → 올해 읽은 시간 월별 바(statsApi.summary(180) daily 클라 집계, 실범위 방어) + 히트맵 새 스킨 → 내가 오려둔 문장(A8에서) → 설정 섹션(재촉 톤·알림·테마·로그아웃 기능 유지).
- **잔여**(타이머·모임 5종·챌린지 2종·알림·로그인): 새 토큰 re-skin + SubHeader 전환, BookCover→TiltCover(entering=false), 완료 후 호환 레이어 삭제.

## 7. 신규 도메인 (백엔드 — project-bookey-backend)

- **book_quotes**(V8): user·book·record? ·content(500)·page? — 작성/삭제/내 목록/책별 목록 + quote_agrees 공감 토글(book_likes 미러). 전부 공개(MVP).
- **광장 피드**: GET /api/v1/plaza/feed?type=QUOTE|FINISH — FINISH는 reading_records(FINISHED·finished_at) 파생, 신규 테이블 없음. 토론은 기존 /clubs/public 재사용.
- 컷(백로그): 답글·re-clip·문장 수정·신고/모더레이션·완독 공유 옵트아웃·agree 레이스 409.

## 8. 검증

각 phase: `npm run typecheck` + `npm run web` 다크/라이트 스모크. 애니메이션 phase는 육안 확인(`expo start -c` 캐시 클리어). 광장 E2E: 시드 계정으로 밑줄 작성→피드 노출→공감→홈/나 섹션 반영.
