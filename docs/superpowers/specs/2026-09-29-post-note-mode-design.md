# 독후감 노트 모드 · 모임 독후감 — 설계 메모

2026-09-29~30. 사용자 요청 "모임 노트를 독후감과 합치고 싶다 → 독후감을 노트 모드와 텍스트 모드로 나누자".
전제: [광장 독후감](2026-09-03-book-posts-design.md), [모임 노트북](2026-09-28-club-notebook-design.md) (이 작업으로 폐기).

## 확정 결정 (사용자)

1. 독후감은 **텍스트 모드**(지금 그대로: 마크다운·사진·본문 안 오려둔 문장)와 **노트 모드**(캔버스) 중 하나.
   처음에 고르고, 빈 초안일 때만 바꿀 수 있다.
2. 노트 모드는 **최대 6페이지**, 좌우로 넘긴다.
3. **모임 독후감**: 모임 안에서만 만들고 모임 멤버만 본다. 만들 때 **광장에도 공개**할지 고른다.
   광장·책 상세에서 만든 독후감은 모임에 들어가지 않는다.
4. 텍스트 모드에 노트 페이지(PNG)를 붙이는 다리는 **만들지 않는다**.
5. 노트 종류 **격자노트 · 줄노트 · 대형노트**. 대형노트는 말 그대로 큰 종이 — 줌아웃으로 전체를 보고 줌인해서 쓴다.
6. 모임 노트북의 **공동 편집은 없앤다**. 모임 노트북 API·테이블·화면은 걷어낸다(데이터는 로컬 시드뿐).

## 백엔드 계약 (project-bookey-backend, V32)

- `posts` 에 `format VARCHAR(10) NOT NULL DEFAULT 'TEXT'`(TEXT|NOTE), `document JSONB`(NOTE 만), `club_id BIGINT REFERENCES clubs ON DELETE CASCADE`.
  `PostVisibility` 에 `CLUB` 추가. `club_note_pages`·`club_note_images` 는 DROP.
- **공개 범위 규칙**: 모임 밖 글은 PUBLIC·LINK·PRIVATE, 모임 글은 PUBLIC(모임+광장)·CLUB(모임만). 어기면 400.
  CLUB 글은 작성자와 그 모임 활성 멤버만 읽는다. 광장 피드·책별 목록은 지금처럼 PUBLIC 만.
- **CreatePostRequest**: `format`(생략=TEXT) · `document`(NOTE 필수) · `clubId`(선택, 활성 멤버·진행 중 모임만) 추가.
  `bodyMd` 는 NOTE 에서 빈 문자열 허용(앱이 노트 속 글을 이어 보내 발췌·검색에 쓴다). `imageIds` 상한 TEXT 10 · NOTE 30.
- **document 검사**: 객체이고 `pages` 배열 길이 1~6, 직렬화 1MB 이하. 내용은 해석하지 않는다(앱 소유 스키마).
- **UpdatePostRequest**: `document`(null=유지) 추가. `format`·`clubId` 는 바꿀 수 없다. 버전 잠금은 두지 않는다(개인 글).
- **PostView** 뒤에 `format`·`document`·`clubId`·`clubName` 추가.
- **신규** `GET /api/v1/posts/clubs/{clubId}?page&size` — 모임 멤버만, 그 모임 글(PUBLIC+CLUB) 최신순.
- 사진·밑줄: 앱이 문서에서 `imageIds`·`quoteIds` 를 뽑아 보낸다 — 서버의 기존 첨부 로직을 그대로 쓴다.

## 앱

- **문서 스키마**(`src/components/note/noteDoc.ts`, 앱 소유): `{ v: 1, kind: 'grid'|'lined'|'large', pages: { id, elements }[] }`.
  격자·줄은 논리 캔버스 1000×1333, 대형은 2000×2666(같은 3:4, 넓이 4배). 요소는 기존 5종 + **오려둔 문장 조각**
  (`quote`: quoteId 와 문장·쪽·책 제목 스냅숏).
- **대형노트 줌**: 캔버스를 `폭×줌` 으로 그리고 잘린 뷰포트 안에서 옮긴다(자식 제스처가 그대로 논리 좌표를 쓴다).
  핀치·− 맞춤 + 버튼, 확대 중엔 손 도구가 페이지를 넘기는 대신 종이를 끈다.
- **작성**: `post/new` 는 모드 고르기(글로 쓰기 / 노트로 꾸미기 + 종류) → 텍스트는 지금 화면, 노트는 `post/note` 전체 화면 편집기
  (자동 저장 없음, 되돌리기, 페이지 추가·삭제 ≤6, '다음' → 책·제목·공개 범위 시트 → 올리기). 사진은 독후감 사진 업로드를 쓴다.
- **보기**: 상세는 노트면 페이지 넘김 뷰어(대형은 줌) + 제목·바이라인·액션. 카드는 노트면 1쪽 썸네일.
- **모임**: 모임 홈 '노트' 탭 → **'독후감'** 탭(3열 격자, 노트는 썸네일·글은 종이 카드). 옛 노트 경로·알림은 이 탭으로.

### 구현 메모 (2026-09-30)

- 경로: `post/new`(모드 고르기 `PostModeChooser` → `format=TEXT` 면 기존 폼) · `post/note`(노트 편집기, `kind`·`bookId`·`clubId` 또는 `id`).
  고칠 글이 노트면 `post/new?id=` 가 `post/note?id=` 로, 반대도 마찬가지로 넘긴다.
- '다음' 시트(`NotePublishSheet`)는 밑줄 고르기처럼 전체 화면 모달이다(책 검색 입력·키보드 때문에). 상태는 편집기가 쥔다.
- 올리기: `format:'NOTE'`, `document`, `bodyMd = plainTextOf`, `imageIds`·`quoteIds` 는 문서에서. 빈 노트·1MB 초과는 앱에서 먼저 막는다.
- 말풍선 화자는 나. 모임 글이면 모임 멤버 중에서 고를 수 있다(멤버가 둘 이상일 때만 고르기 줄이 뜬다).
- 공개 범위: 모임 밖 공개·비공개(링크 공개 글은 고칠 때만 유지), 모임 글 모임만(기본)·광장에도. 상세는 모임 글에 '모임 · 이름' 태그(누르면 그 모임 독후감 탭).
- 모임 탭 키 `reviews`('독후감'), `?tab=notebook` 은 별칭. `club/[id]/notebook`·`notebook/[pageId]` 는 이 탭으로 리다이렉트, 알림 `CLUB_NOTE_PAGE` 도.
- 엔진 정리: 서버 노트북 전용(`useNotePage`·`noteMerge`·`queries`·`NoteGrid`·`ReadOnlyPage`·`TitlePrompt`, `parseDoc`·`emptyDoc`, 편집기의 touched·replace·reset)을 걷어냈다.
  `PageStrip`(‹ N / M + ›)·`PageMenu`(페이지 추가·지우기)는 페이지 수만 받는 일반 컴포넌트로 바꿨다. 문장 조각 메타는 `N쪽`.
