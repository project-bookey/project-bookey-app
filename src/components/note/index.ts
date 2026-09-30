/** 노트 캔버스 엔진 배럴 — 노트 모드 독후감(여러 페이지·노트 종류·대형노트 줌)과 옛 모임 노트북이 같이 쓴다. */
export { NoteCanvas, scaleFor, pageHeightFor } from './NoteCanvas';
export { InkLayer } from './InkLayer';
export type { LiveStroke } from './InkLayer';
export { NotePaper } from './NotePaper';
export { NoteElementView, renderElementBody } from './NoteElementView';
export { quoteMetaOf } from './elements/QuoteElement';
export { STICKER_PACK, EMOJI_STICKERS, findPackSticker } from './stickerPack';
export type { PackSticker } from './stickerPack';
export * from './noteDoc';
export { mergeDocs, changedIds, PAPER_TOUCH_KEY } from './noteMerge';
export {
  pointsToPath, farEnough, simplifyRdp, strokeHit, strokeBounds, distToSegmentSq, handleDelta, clamp,
} from './noteGeometry';
export type { Point } from './noteGeometry';
export { useNoteEditor } from './useNoteEditor';
export type { ApplyOptions, NoteEditor, NoteEditorState } from './useNoteEditor';
export { usePostNoteEditor } from './usePostNoteEditor';
export type { PostNoteEditor } from './usePostNoteEditor';
export { useNotePhotos } from './useNotePhotos';
export type { NoteImageUpload, PendingPhoto } from './useNotePhotos';
export { useNoteInserts, anchorOf } from './useNoteInserts';
export type { AnchorFn, NoteSpeaker } from './useNoteInserts';
export { useNoteSelection } from './useNoteSelection';
export { useInkGesture } from './useInkGesture';
export type { InkTool, PenState } from './useInkGesture';
export { applyPreview, settle, IDLE_DELTA } from './editing';
export type { Delta, Preview } from './editing';
export { ZoomStage, ZoomControls, useNoteZoom, ZOOM_MIN, ZOOM_MAX } from './ZoomStage';
export type { NoteZoom } from './ZoomStage';
