/** 모임 노트북 공용 모듈 배럴. */
export { NoteCanvas, scaleFor } from './NoteCanvas';
export { InkLayer } from './InkLayer';
export type { LiveStroke } from './InkLayer';
export { NotePaper } from './NotePaper';
export { NoteElementView, renderElementBody } from './NoteElementView';
export { STICKER_PACK, EMOJI_STICKERS, findPackSticker } from './stickerPack';
export type { PackSticker } from './stickerPack';
export * from './noteDoc';
export { mergeDocs, changedIds, PAPER_TOUCH_KEY } from './noteMerge';
export {
  pointsToPath, farEnough, simplifyRdp, strokeHit, strokeBounds, distToSegmentSq, handleDelta, clamp,
} from './noteGeometry';
export type { Point } from './noteGeometry';
