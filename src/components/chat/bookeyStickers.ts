import type { ImageSourcePropType } from 'react-native';

export type BookeyChatSticker = {
  code: string;
  label: string;
  source: ImageSourcePropType;
};

export type BookeyStickerPack = {
  id: string;
  name: string;
  thumbnail: ImageSourcePropType;
  stickers: readonly BookeyChatSticker[];
};

const sticker = (character: string, action: string, label: string, source: ImageSourcePropType): BookeyChatSticker => ({
  code: `[bookey:${character}:${action}]`,
  label,
  source,
});

const bookmarkEars = [
  sticker('bookmark-ears', 'wave', '책갈피귀 인사', require('../../../assets/chat-stickers/bookmark-ears-actions/01.png')),
  sticker('bookmark-ears', 'cheer', '책갈피귀 영차', require('../../../assets/chat-stickers/bookmark-ears-actions/02.png')),
  sticker('bookmark-ears', 'cry', '책갈피귀 엉엉', require('../../../assets/chat-stickers/bookmark-ears-actions/03.png')),
  sticker('bookmark-ears', 'love', '책갈피귀 책 좋아', require('../../../assets/chat-stickers/bookmark-ears-actions/04.png')),
  sticker('bookmark-ears', 'sleep', '책갈피귀 쿨쿨', require('../../../assets/chat-stickers/bookmark-ears-actions/05.png')),
  sticker('bookmark-ears', 'lifting', '책갈피귀 영차', require('../../../assets/chat-stickers/bookmark-ears/lifting.png')),
  sticker('bookmark-ears', 'flattened', '책갈피귀 깔렸어요', require('../../../assets/chat-stickers/bookmark-ears/flattened.png')),
  sticker('bookmark-ears', 'page-turn', '책갈피귀 독서 중', require('../../../assets/chat-stickers/bookmark-ears/page-turn.png')),
  sticker('bookmark-ears', 'exhausted', '책갈피귀 지쳤어요', require('../../../assets/chat-stickers/bookmark-ears/exhausted.png')),
  sticker('bookmark-ears', 'hugging', '책갈피귀 책 좋아', require('../../../assets/chat-stickers/bookmark-ears/hugging.png')),
] as const;

const dustReader = [
  sticker('dust-reader', 'read', '먼지독자 독서 중', require('../../../assets/chat-stickers/dust-reader/01.png')),
  sticker('dust-reader', 'panic', '먼지독자 당황', require('../../../assets/chat-stickers/dust-reader/02.png')),
  sticker('dust-reader', 'okay', '먼지독자 이해 완료', require('../../../assets/chat-stickers/dust-reader/03.png')),
  sticker('dust-reader', 'angry', '먼지독자 화남', require('../../../assets/chat-stickers/dust-reader/04.png')),
  sticker('dust-reader', 'sleep', '먼지독자 쿨쿨', require('../../../assets/chat-stickers/dust-reader/05.png')),
  sticker('dust-reader', 'classic-read', '먼지독자 책 읽기', require('../../../assets/chat-stickers/dust-reader-reference/01.png')),
  sticker('dust-reader', 'classic-question', '먼지독자 궁금해', require('../../../assets/chat-stickers/dust-reader-reference/02.png')),
  sticker('dust-reader', 'classic-upset', '먼지독자 속상해', require('../../../assets/chat-stickers/dust-reader-reference/03.png')),
  sticker('dust-reader', 'classic-rest', '먼지독자 책에 기대기', require('../../../assets/chat-stickers/dust-reader-reference/04.png')),
  sticker('dust-reader', 'classic-focus', '먼지독자 집중', require('../../../assets/chat-stickers/dust-reader-reference/05.png')),
] as const;

const paperScrap = [
  sticker('paper-scrap', 'wave', '종이조각 인사', require('../../../assets/chat-stickers/paper-scrap/01.png')),
  sticker('paper-scrap', 'search', '종이조각 찾는 중', require('../../../assets/chat-stickers/paper-scrap/02.png')),
  sticker('paper-scrap', 'celebrate', '종이조각 신남', require('../../../assets/chat-stickers/paper-scrap/03.png')),
  sticker('paper-scrap', 'shock', '종이조각 깜짝', require('../../../assets/chat-stickers/paper-scrap/04.png')),
  sticker('paper-scrap', 'cry', '종이조각 속상해', require('../../../assets/chat-stickers/paper-scrap/05.png')),
  sticker('paper-scrap', 'classic-search', '종이조각 안경 찾기', require('../../../assets/chat-stickers/paper-scrap-reference/01.png')),
  sticker('paper-scrap', 'classic-down', '종이조각 풀이 죽음', require('../../../assets/chat-stickers/paper-scrap-reference/02.png')),
  sticker('paper-scrap', 'classic-panic', '종이조각 안경 소동', require('../../../assets/chat-stickers/paper-scrap-reference/03.png')),
  sticker('paper-scrap', 'classic-shock', '종이조각 깜짝', require('../../../assets/chat-stickers/paper-scrap-reference/04.png')),
  sticker('paper-scrap', 'classic-read', '종이조각 독서', require('../../../assets/chat-stickers/paper-scrap-reference/05.png')),
] as const;

const bookmarkWorm = [
  sticker('bookmark-worm', 'peek', '책갈피벌레 빼꼼', require('../../../assets/chat-stickers/bookmark-worm/01.png')),
  sticker('bookmark-worm', 'love', '책갈피벌레 하트', require('../../../assets/chat-stickers/bookmark-worm/02.png')),
  sticker('bookmark-worm', 'squashed', '책갈피벌레 납작', require('../../../assets/chat-stickers/bookmark-worm/03.png')),
  sticker('bookmark-worm', 'wave', '책갈피벌레 인사', require('../../../assets/chat-stickers/bookmark-worm/04.png')),
  sticker('bookmark-worm', 'question', '책갈피벌레 궁금', require('../../../assets/chat-stickers/bookmark-worm/05.png')),
  sticker('bookmark-worm', 'classic-read', '책갈피벌레 책 위 독서', require('../../../assets/chat-stickers/bookmark-worm-reference/01.png')),
  sticker('bookmark-worm', 'classic-squashed', '책갈피벌레 책 사이', require('../../../assets/chat-stickers/bookmark-worm-reference/02.png')),
  sticker('bookmark-worm', 'classic-peek', '책갈피벌레 빼꼼', require('../../../assets/chat-stickers/bookmark-worm-reference/03.png')),
  sticker('bookmark-worm', 'classic-rest', '책갈피벌레 쉬는 중', require('../../../assets/chat-stickers/bookmark-worm-reference/04.png')),
  sticker('bookmark-worm', 'classic-question', '책갈피벌레 물음표', require('../../../assets/chat-stickers/bookmark-worm-reference/05.png')),
] as const;

const pencilDumpling = [
  sticker('pencil-dumpling', 'oops', '연필만두 앗', require('../../../assets/chat-stickers/pencil-dumpling/01.png')),
  sticker('pencil-dumpling', 'reach', '연필만두 끙차', require('../../../assets/chat-stickers/pencil-dumpling/02.png')),
  sticker('pencil-dumpling', 'done', '연필만두 완료', require('../../../assets/chat-stickers/pencil-dumpling/03.png')),
  sticker('pencil-dumpling', 'angry', '연필만두 화남', require('../../../assets/chat-stickers/pencil-dumpling/04.png')),
  sticker('pencil-dumpling', 'sleep', '연필만두 쿨쿨', require('../../../assets/chat-stickers/pencil-dumpling/05.png')),
  sticker('pencil-dumpling', 'classic-study', '연필만두 공부 중', require('../../../assets/chat-stickers/pencil-dumpling-reference/01.png')),
  sticker('pencil-dumpling', 'classic-push', '연필만두 끙차', require('../../../assets/chat-stickers/pencil-dumpling-reference/02.png')),
  sticker('pencil-dumpling', 'classic-drop', '연필만두 연필 놓침', require('../../../assets/chat-stickers/pencil-dumpling-reference/03.png')),
  sticker('pencil-dumpling', 'classic-write', '연필만두 필기 중', require('../../../assets/chat-stickers/pencil-dumpling-reference/04.png')),
  sticker('pencil-dumpling', 'classic-rest', '연필만두 책에 기대기', require('../../../assets/chat-stickers/pencil-dumpling-reference/05.png')),
] as const;

const sleepySprout = [
  sticker('sleepy-sprout', 'wave', '졸린새싹 인사', require('../../../assets/chat-stickers/sleepy-sprout/01.png')),
  sticker('sleepy-sprout', 'cheer', '졸린새싹 신남', require('../../../assets/chat-stickers/sleepy-sprout/02.png')),
  sticker('sleepy-sprout', 'yawn', '졸린새싹 하품', require('../../../assets/chat-stickers/sleepy-sprout/03.png')),
  sticker('sleepy-sprout', 'cry', '졸린새싹 눈물', require('../../../assets/chat-stickers/sleepy-sprout/04.png')),
  sticker('sleepy-sprout', 'love', '졸린새싹 하트', require('../../../assets/chat-stickers/sleepy-sprout/05.png')),
  sticker('sleepy-sprout', 'classic-hide', '졸린새싹 책 속', require('../../../assets/chat-stickers/sleepy-sprout-reference/01.png')),
  sticker('sleepy-sprout', 'classic-yawn', '졸린새싹 하품', require('../../../assets/chat-stickers/sleepy-sprout-reference/02.png')),
  sticker('sleepy-sprout', 'classic-sleep', '졸린새싹 잠듦', require('../../../assets/chat-stickers/sleepy-sprout-reference/03.png')),
  sticker('sleepy-sprout', 'classic-peek', '졸린새싹 책 읽기', require('../../../assets/chat-stickers/sleepy-sprout-reference/04.png')),
  sticker('sleepy-sprout', 'classic-clover', '졸린새싹 네잎클로버', require('../../../assets/chat-stickers/sleepy-sprout-reference/05.png')),
] as const;

export const BOOKEY_STICKER_PACKS: readonly BookeyStickerPack[] = [
  { id: 'bookmark-ears', name: '책갈피귀', thumbnail: bookmarkEars[0].source, stickers: bookmarkEars },
  { id: 'dust-reader', name: '먼지독자', thumbnail: dustReader[0].source, stickers: dustReader },
  { id: 'paper-scrap', name: '종이조각', thumbnail: paperScrap[0].source, stickers: paperScrap },
  { id: 'bookmark-worm', name: '책갈피벌레', thumbnail: bookmarkWorm[0].source, stickers: bookmarkWorm },
  { id: 'pencil-dumpling', name: '연필만두', thumbnail: pencilDumpling[0].source, stickers: pencilDumpling },
  { id: 'sleepy-sprout', name: '졸린새싹', thumbnail: sleepySprout[0].source, stickers: sleepySprout },
] as const;

export const BOOKEY_CHAT_STICKERS = BOOKEY_STICKER_PACKS.flatMap((pack) => pack.stickers);

// 이미 전송된 초기 테스트 이모티콘은 선택창에서 숨기되 계속 표시할 수 있게 유지한다.
const LEGACY_STICKERS: readonly BookeyChatSticker[] = [
  sticker('bookmark-ears', 'front', '버티는 중', require('../../../assets/chat-stickers/bookmark-ears/front.png')),
  sticker('bookmark-ears', 'side', '낑낑', require('../../../assets/chat-stickers/bookmark-ears/side.png')),
  sticker('bookmark-ears', 'back', '뒷모습', require('../../../assets/chat-stickers/bookmark-ears/back.png')),
];

const STICKER_BY_CODE = new Map(
  [...BOOKEY_CHAT_STICKERS, ...LEGACY_STICKERS].map((item) => [item.code, item]),
);

export function findBookeyChatSticker(body: string | null | undefined): BookeyChatSticker | undefined {
  return body ? STICKER_BY_CODE.get(body.trim()) : undefined;
}

export function chatMessagePreview(body: string | null | undefined): string {
  if (!body) return '';
  return findBookeyChatSticker(body) ? 'BOOKEY 이모티콘' : body;
}
