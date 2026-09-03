import { typeScale } from '@/theme';

/**
 * 홈 '오려둔 글' 조각의 치수 — 밑줄 조각(HomeScraps)과 독후감 조각(PostScrap)이 같은 자리에
 * 번갈아 서므로 두 파일이 반드시 같은 숫자를 봐야 한다. 각자 상수를 두면 한쪽만 고쳐졌을 때
 * 6초마다 행이 출렁이는데, 그 어긋남은 코드만 봐서는 눈에 띄지 않는다 — 그래서 한 곳에 둔다.
 *
 * 여기는 값만 있는 모듈이라 어느 쪽에서 가져와도 순환 import 가 생기지 않는다
 * (HomeScraps → PostScrap 방향의 기존 import 는 그대로다).
 */

/** 인용 줄 수 — 스포트라이트의 밑줄은 세 줄에서 끊는다. */
export const QUOTE_LINES = 3;
/**
 * 인용 줄높이(px) — 숫자를 베끼지 않고 토큰에서 읽는다(토큰이 바뀌면 상자도 따라 움직인다).
 * 밖에서 쓰는 곳은 없다 — 조각들이 보는 것은 이 값이 아니라 아래 QUOTE_MAX_H 다.
 */
const QUOTE_LH = typeScale.quote.lineHeight;

/**
 * 글 상자 높이 상한(px) — 딱 인용 3줄.
 *
 * `numberOfLines` 만으로는 부족하다. 웹에서는 이 Text 가 조각(flex 컨테이너)의 자식이라
 * `-webkit-line-clamp` 가 걸린 `display:-webkit-box` 가 블록으로 바뀌어(computed `flow-root`)
 * 말줄임표만 찍히고 **넷째 줄이 상자 높이만큼 그대로 그려진다** — 잘린 반 줄이 메타 위로
 * 겹쳐 보인다. 상자 자체를 3줄로 못 박아 넷째 줄이 놓일 자리를 없앤다.
 * 독후감 조각(PostScrap 의 home)도 제목+발췌를 이만한 상자에 가둔다.
 */
export const QUOTE_MAX_H = QUOTE_LINES * QUOTE_LH;

/** 메타(닉네임·책)·핫 지표 조판 — 두 조각이 같은 자리에 같은 크기로 세운다. */
export const META_SIZE = 10;
export const META_LH = 14;
/** 핫 지표와 메타 사이 간격(px). */
export const HOT_GAP = 3;
