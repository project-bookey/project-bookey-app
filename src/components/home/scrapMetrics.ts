import { AVATAR_SIZE } from '@/components/quote/QuoteCard';
import { typeScale } from '@/theme';

/**
 * 홈 '오늘의 글' 조각의 치수 — 밑줄 조각(HomeScraps)과 독후감 조각(PostScrap)이 같은 자리에
 * 번갈아 서므로 두 파일이 반드시 같은 숫자를 봐야 한다. 각자 상수를 두면 한쪽만 고쳐졌을 때
 * 6초마다 행이 출렁이는데, 그 어긋남은 코드만 봐서는 눈에 띄지 않는다 — 그래서 한 곳에 둔다.
 *
 * 여기는 값만 있는 모듈이라 어느 쪽에서 가져와도 순환 import 가 생기지 않는다
 * (HomeScraps → PostScrap 방향의 기존 import 는 그대로다). 아바타 지름만 QuoteCard 의 상수를
 * 그대로 받는다 — QuoteCard 는 홈 쪽을 모르므로 이쪽도 순환이 없다.
 */

/**
 * 작성자 행 — 아바타 지름(px). 앱 공통 크기(QuoteCard 의 AVATAR_SIZE, 40)를 그대로 쓴다 —
 * '오늘의 글'은 누가 썼는지가 먼저 보여야 한다는 피드백(2026-09-08, 32 → 40 두 번 키움)으로
 * 여기서 먼저 키웠고, 이어 광장·상세·댓글도 같은 크기로 맞췄다.
 */
export const AUTHOR_AVATAR = AVATAR_SIZE;

/** 메타(작성자 행의 책 제목·핫 지표) 조판 — 두 조각이 같은 자리에 같은 크기로 세운다. */
export const META_SIZE = 10;
export const META_LH = 14;

/** 작성자 행 첫 줄(닉네임·종류 태그) 높이(px) — 태그(안쪽 여백 3 + 글자)와 같아 줄이 안 늘어난다. */
export const AUTHOR_LINE1_H = 20;
/**
 * 작성자 행 두 줄 사이 간격(px).
 *
 * 오른쪽 열에 `밑줄|독후감` 태그와 `좋아요 n` 이 위아래로 서는데, 2px 이던 때는 둘이 한 덩어리로
 * 붙어 보인다는 피드백(2026-09-08)으로 벌렸다. 왼쪽 열(닉네임·책 제목)도 같이 벌어진다.
 */
export const AUTHOR_LINE_GAP = 10;
/**
 * 작성자 행 높이(px) — 아바타(40)와 오른쪽 두 줄(20 + 10 + 14 = 44) 중 큰 쪽.
 * 줄 간격을 벌리면 행이 따라 커져야 아래 글 상자를 파고들지 않는다.
 */
export const AUTHOR_H = Math.max(AUTHOR_AVATAR, AUTHOR_LINE1_H + AUTHOR_LINE_GAP + META_LH);
/** 작성자 행과 글 상자 사이 간격(px). */
export const AUTHOR_GAP = 8;

/**
 * 인용 줄 수 — 스포트라이트의 밑줄은 한 줄에서 끊는다.
 *
 * 글 상자가 옆 표지보다 훨씬 커서 어색하다는 피드백(2026-09-08)으로 조각 높이를 표지와 같은
 * 108 로 맞췄고(HomeScraps 의 ROW_H), 작성자 행을 뺀 나머지가 딱 한 줄이다.
 */
export const QUOTE_LINES = 1;
/**
 * 인용 줄높이(px) — 숫자를 베끼지 않고 토큰에서 읽는다(토큰이 바뀌면 상자도 따라 움직인다).
 * 밖에서 쓰는 곳은 없다 — 조각들이 보는 것은 이 값이 아니라 아래 QUOTE_MAX_H 다.
 */
const QUOTE_LH = typeScale.quote.lineHeight;

/**
 * 글 상자 높이 상한(px) — 딱 인용 한 줄.
 *
 * `numberOfLines` 만으로는 부족하다. 웹에서는 이 Text 가 조각(flex 컨테이너)의 자식이라
 * `-webkit-line-clamp` 가 걸린 `display:-webkit-box` 가 블록으로 바뀌어(computed `flow-root`)
 * 말줄임표만 찍히고 **다음 줄이 상자 높이만큼 그대로 그려진다** — 잘린 반 줄이 메타 위로
 * 겹쳐 보인다. 상자 자체를 한 줄로 못 박아 둘째 줄이 놓일 자리를 없앤다.
 * 독후감 조각(PostScrap 의 home)도 제목을 이만한 상자에 가둔다.
 */
export const QUOTE_MAX_H = QUOTE_LINES * QUOTE_LH;
