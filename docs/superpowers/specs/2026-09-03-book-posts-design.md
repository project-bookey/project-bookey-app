# 광장 독후감 — 설계 문서

2026-09-03 · 사용자 요청("광장에 독후감 기능 — 책 검색해 넣고, 사진·밑줄도 넣고, 댓글·좋아요·조회수")
전제: [밑줄 댓글 스펙](2026-09-02-quote-comments-design.md), [리뷰 댓글 스펙](2026-09-03-review-comments-design.md).
독후감 댓글은 그 두 스펙이 만든 공용 댓글 스레드를 그대로 쓴다.

## 목표

1. 광장에 **독후감** 탭 — 긴 글(마크다운)에 사진·내 밑줄을 붙이고 좋아요·댓글·조회수가 붙는다.
2. 책은 **선택** — 검색해서 붙일 수도, 책 없이 쓸 수도 있다.
3. 밑줄 첨부는 **책과 완전 별개** — 내 밑줄이면 어느 책이든(읽은 책·안 읽은 책·글의 책과 다른 책) 붙는다.
4. 노출: 광장 탭 · 홈 '오려둔 글'(밑줄과 섞어 회전) · 나 화면 '내 독후감' · 도서 상세 '독후감' 탭.

## 범위 밖

별점(도서 리뷰가 담당) · 태그 입력 UI · 인기순 정렬 · 카메라 촬영 · 사진 확대 뷰어 · 작성 중 이탈 경고 ·
LINK 공유 UI · 댓글 수정/알림/신고 · 팔로우 · 서명 URL(공개 버킷) · 서버 썸네일.

## 백엔드 (project-bookey-backend, `feature/post-api` → `feature/post-images`)

기존 `Post`(독후감, 미사용 상태로 존재하던 도메인)를 살려 쓰고 부속 테이블만 더한다 — `V10__post_social.sql`.

| 테이블 | 내용 |
|---|---|
| `post_images` | 업로드 시 `post_id` NULL 로 먼저 만들고 글에 붙일 때 채운다. `storage_key`·`url`·`content_type`·`byte_size`·`width/height`·`sort_order`. 부분 인덱스 `WHERE post_id IS NULL` 로 고아 회수. |
| `post_quotes` | 글 ↔ 밑줄 연결(순서 보존), `UNIQUE(post_id, quote_id)`. |
| `post_likes` | `quote_agrees` 미러, `UNIQUE(user_id, post_id)`. |
| `post_comments` | `parent_id` 자기참조(2단계), 300자, 루트 삭제 시 답글 CASCADE. |

- **API**: `GET /posts/feed`(공개 최신순) · `GET /posts/{id}`(조회수 +1, 본인 제외·1시간 중복 제거, 비공개 타인은 404) · `POST/PATCH/DELETE /posts` · `GET /posts`(내 글 전부) · `POST /posts/{id}/like` · `GET/POST /posts/{id}/comments`·`DELETE …/{commentId}` · `POST /posts/images`(multipart) · `GET /books/{bookId}/posts` · `GET /quotes?bookId=`(밑줄 시트 필터).
- **PostView** 는 이름·기존 13필드 순서를 유지하고 뒤에만 더했다: `authorId·authorAvatarUrl·excerpt·images·quotes·likeCount·likedByMe·commentCount·mine·createdAt`. 공개 블로그 API 와 어드민 타입이 같은 스키마를 쓰므로 필드 삭제·개명은 하지 않는다.
- **밑줄 첨부 규칙**: 서버는 **소유만** 검사한다(내 밑줄인가). 글의 책 유무·일치는 보지 않는다. 책을 바꿔도 첨부 밑줄은 그대로 두고, `readingRecordId` 만 해제한다.
- **댓글**: 목록은 루트 오래된 순 + 답글을 **인라인**(`replies[]`)으로 내린다. 답글의 답글은 400.
- **조립**: 카운터 비정규화 없이 페이지 단위 배치 로드(글 수와 무관하게 고정 쿼리 수). 탈퇴 작성자는 "알 수 없음", 결측 책은 null.
- **발췌**: `PostExcerpt` 가 마크다운 기호(이미지·링크·헤딩·강조 쌍·코드펜스·인용·목록·수평선)를 벗겨 140자로 자른다.
- **스토리지**: `StorageService` — 로컬 디스크(기본, `/uploads/**` 공개 GET)와 GCS(운영 프로필 기본, 버킷 없으면 기동 실패). 형식은 매직넘버로만 판별(JPEG·PNG·WebP), 10MB, 키는 `posts/{userId}/{yyyy}/{MM}/{uuid}.{ext}`(클라이언트 파일명 미사용). 24시간 안 붙지 않은 이미지는 매일 04:20(KST) 배치가 파일·행을 지운다.
- **레이트리밋**: 작성 5/분 · 댓글 20/분 · 업로드 30/분 · 조회수 1/시간.

## 앱 (project-bookey-app, `feature/post-foundation` → `post-screens` → `post-surfaces`)

- **라우트**: `post/new`(작성·수정 `?id=`·`?bookId=`) · `post/[id]`(상세) · `post/mine`(내 독후감).
- **광장**: 칩 `밑줄 · 독후감 · 완독 자랑`. 탭 상태와 광장 피드 타입을 분리해 독후감 탭에서는 밑줄 피드를 호출하지 않는다. 우측 알약은 밑줄 탭에서 `+ 밑줄`, 독후감 탭에서 `+ 독후감`.
- **카드**(`PostCard`): 작성자 행 · 표지(있을 때)와 제목·발췌 · 첫 사진 조각 `+N` · 푸터 `좋아요·댓글·조회·밑줄 N`.
- **상세**: 표지+제목 히어로(책 없으면 '책 없음') · 바이라인 · 사진 가로 스크롤 · 마크다운 본문 · 엮은 밑줄 조각 · 액션 행 · 공용 `CommentThread`. 댓글은 `usePostCommentAdapter` 가 서버의 인라인 답글을 스레드 계약(`replyCount`·`replies()`)으로 매핑한다.
- **작성/수정**: 책 고르기(`BookPicker`, 없이도 가능) · 제목 · 본문(쓰기 | 미리보기) · 사진 ≤10장(고르면 즉시 업로드, 실패 재시도) · 밑줄 ≤10개(시트에서 내 밑줄 전체 또는 '이 책만', 시트 안에서 바로 새로 오려두기) · 공개 범위(공개/비공개).
- **홈 '오려둔 글'**: 밑줄과 독후감을 번갈아 5장 회전(6초). 행 높이는 조각 종류와 무관하게 고정.
- **나 화면**: '내 독후감'(비공개 포함) 조각 + 전부 보기 → `post/mine`.
- **도서 상세**: `리뷰 | 밑줄 | 독후감` 탭. 독후감 탭의 '쓰기 →' 는 독서 기록이 없어도 보인다.
- **캐시**(`postCache.ts`): 광장 피드 · 홈 · 책별 · 내 목록(무한 목록과 프로필의 최신 한 건이 같은 접두사라 함께 걸린다) · 상세 다섯 캐시를 한 패치 함수(`patchPostEverywhere`)로 동기화한다. 댓글은 제 키(`postCommentsKey`)를 두고 공용 스레드가 갱신한다. 밑줄 반응 패치(`quoteCache`)는 독후감 상세에 엮인 밑줄까지 갱신한다.
- **의존성 추가**: `expo-image-picker`·`expo-image-manipulator`(사진, 장변 1600·JPEG 0.8 로 줄여 전송) · `react-native-marked`(마크다운, 콜라주 렌더러로 감쌈). 네이티브 모듈이 늘었으므로 **dev client 재빌드 필요**.

## 검증

- 백엔드 순수 단위 테스트 221건, API 스모크(작성·피드·조회수·좋아요·댓글·책별·공개 API) 11건, 업로드 스모크 21건.
- 앱 `npm run typecheck` 0, 웹(Playwright) 회귀 스모크 단계별 20~56건 — 광장·상세·작성·홈·프로필·도서 상세 전 경로.
- 실기기(Expo Go / dev client) 확인은 미수행 — 사진첩 권한 문구·업로드·키보드 회피·시트 표시·안드로이드 조각 오버플로가 남은 체크리스트다.

## 운영 준비 (푸시 전 필수)

백엔드를 origin 에 푸시하면 Cloud Run 이 자동 배포되고, 운영 프로필은 스토리지 기본값이 GCS 다. 순서를 지켜야 한다:
버킷 생성 → `allUsers:objectViewer` → 런타임 서비스계정에 `roles/storage.objectAdmin` → GitHub Variable `GCP_MEDIA_BUCKET` → 워크플로 `env_vars` 에 `STORAGE_TYPE`·`GCS_BUCKET` 추가 → 푸시. 상세는 백엔드 README 'GCS 준비 (운영)'.

## 백로그

독후감 댓글 API 를 밑줄·리뷰와 같은 `replyCount`/`replies` 엔드포인트로 통일 · `UpdatePostRequest.readingRecordId` ·
목록 응답에서 본문 분리(`PostSummaryView`) · 서명 URL · 서버 썸네일/CDN · 인기순 · 댓글 소프트 삭제·수정·알림·신고 ·
광장 밑줄·완독 자랑 탭의 빈/오류 문구 어투 통일(독후감 쪽은 '…어요'로 맞췄다) ·
운영 Redis 배선(레이트리밋·조회수 중복 제거가 현재 허용 폴백).
