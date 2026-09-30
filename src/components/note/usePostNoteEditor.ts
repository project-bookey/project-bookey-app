import { useCallback, useRef, useState } from 'react';

import {
  DOC_VERSION, NOTE_PAGE_MAX, canvasFor, emptyNotePage, pageDocOf, paperFor, type CanvasSize, type NoteDoc, type NoteKind,
  type PostNoteDoc,
} from './noteDoc';
import { useNoteEditor, type ApplyOptions, type NoteEditor, type NoteEditorState } from './useNoteEditor';

/** 되돌리기 깊이 — useNoteEditor 와 같은 값(맡겨 둔 페이지에 직접 얹을 때). */
const UNDO_LIMIT = 30;

export type PostNoteEditor = {
  /** 노트 종류 — 만든 뒤엔 바뀌지 않는다. */
  kind: NoteKind;
  /** 논리 캔버스 크기(canvasFor(kind)). */
  canvas: CanvasSize;
  /** 지금 페이지 편집기 — NoteCanvas·useNoteSelection·useNoteInserts·useInkGesture 에 그대로 넘긴다. doc 은 pageDocOf 모양(kind·paper 포함). */
  editor: NoteEditor;
  pageIndex: number;
  pageCount: number;
  /** 페이지 id — 순서대로. 페이저 key·useNotePhotos 의 pageId 로 쓴다. */
  pageIds: string[];
  /** 지금 페이지 id. */
  pageId: string;
  /** index 번째 페이지의 캔버스 문서 — 이웃 페이지를 읽기 전용으로 그릴 때. 지금 페이지면 편집 중 문서. */
  pageDoc: (index: number) => NoteDoc;
  /** 페이지 넘기기 — 되돌리기 스택은 페이지마다 따로 남는다. */
  goTo: (index: number) => void;
  canAddPage: boolean;
  /** 지금 페이지 뒤에 빈 페이지를 넣고 그리로 간다. 상한(6)이면 false. */
  addPage: () => boolean;
  canDeletePage: boolean;
  /** 페이지를 지운다(기본: 지금 페이지). 한 장만 남았으면 false. 지운 뒤엔 같은 자리(없으면 앞) 페이지로. */
  deletePage: (index?: number) => boolean;
  /** 페이지 id 로 문서를 바꾼다 — 지금 페이지면 편집기로, 아니면 맡겨 둔 상태에(되돌리기 한 건). 사진 업로드 완료용. */
  applyToPage: (pageId: string, mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => void;
  /** 처음(또는 markClean) 이후 바뀐 게 있는지 — 나가기 확인·올리기 버튼에 쓴다. */
  dirty: boolean;
  /** 올린 뒤 부른다. */
  markClean: () => void;
  /** 지금 상태의 노트 문서 스냅숏 — 올릴 때 serializePostNoteDoc 에 넘긴다. */
  toDoc: () => PostNoteDoc;
};

/**
 * 노트 모드 독후감 편집 — 여러 페이지 문서를 통째로 메모리에 든다. 서버와 무관하다(자동 저장·버전·409 없음).
 * 지금 페이지는 useNoteEditor 가 들고, 나머지 페이지는 {문서, 되돌리기 스택} 으로 맡겨 둔다 —
 * 페이지를 넘겼다 돌아와도 그 페이지의 되돌리기가 살아 있다.
 * initial 은 첫 렌더에만 쓴다(다른 글을 열려면 key 를 바꿔 다시 마운트).
 */
export function usePostNoteEditor(initial: PostNoteDoc): PostNoteEditor {
  const kind = initial.kind;
  const canvas = canvasFor(kind);
  const toPageDoc = useCallback((elements: NoteDoc['elements']): NoteDoc => ({
    v: DOC_VERSION, paper: paperFor(kind), kind, elements,
  }), [kind]);

  const [pageIds, setPageIds] = useState<string[]>(() => initial.pages.map((p) => p.id));
  const [pageIndex, setPageIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  /** 지금 페이지 밖의 페이지 상태. 지금 페이지 항목은 넘길 때마다 새로 맡긴다(그 사이엔 낡은 값). */
  const storeRef = useRef<Map<string, NoteEditorState> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new Map(initial.pages.map((p) => [p.id, { doc: toPageDoc(p.elements), undo: [] }]));
  }
  const store = storeRef.current;
  /** 맡겨 둔 페이지가 바뀌었을 때(사진 도착) 이웃 미리보기를 다시 그리게. */
  const [, setStoreRev] = useState(0);

  const markDirty = useCallback(() => setDirty(true), []);
  const editor = useNoteEditor(pageDocOf(initial, 0), { onChange: markDirty });
  // 편집기 객체는 렌더마다 새로 만들어지지만 아래 함수·ref 는 안정적이다 — 콜백 deps 는 이것들로.
  const { snapshot, load, apply, docRef } = editor;

  const idsRef = useRef(pageIds);
  idsRef.current = pageIds;
  const indexRef = useRef(pageIndex);
  indexRef.current = pageIndex;

  const currentId = pageIds[pageIndex] ?? pageIds[0];

  /** 지금 페이지 상태를 맡긴다. */
  const stash = useCallback(() => {
    const id = idsRef.current[indexRef.current];
    if (id) store.set(id, snapshot());
  }, [store, snapshot]);

  const switchTo = useCallback((ids: string[], index: number) => {
    const id = ids[index];
    const state = id ? store.get(id) : undefined;
    load(state ?? { doc: toPageDoc([]), undo: [] });
    indexRef.current = index;
    setPageIndex(index);
  }, [store, load, toPageDoc]);

  const goTo = useCallback((index: number) => {
    const ids = idsRef.current;
    if (index < 0 || index >= ids.length || index === indexRef.current) return;
    stash();
    switchTo(ids, index);
  }, [stash, switchTo]);

  const addPage = useCallback(() => {
    const ids = idsRef.current;
    if (ids.length >= NOTE_PAGE_MAX) return false;
    stash();
    const page = emptyNotePage();
    store.set(page.id, { doc: toPageDoc([]), undo: [] });
    const at = indexRef.current + 1;
    const next = [...ids.slice(0, at), page.id, ...ids.slice(at)];
    idsRef.current = next;
    setPageIds(next);
    switchTo(next, at);
    setDirty(true);
    return true;
  }, [stash, store, toPageDoc, switchTo]);

  const deletePage = useCallback((index?: number) => {
    const ids = idsRef.current;
    const at = index ?? indexRef.current;
    if (ids.length <= 1 || at < 0 || at >= ids.length) return false;
    const cur = indexRef.current;
    if (at !== cur) stash();
    store.delete(ids[at]);
    const next = ids.filter((_, i) => i !== at);
    idsRef.current = next;
    setPageIds(next);
    if (at === cur) {
      // 지운 자리의 다음 페이지(이제 같은 번호), 마지막이었으면 앞 페이지.
      switchTo(next, Math.min(at, next.length - 1));
    } else if (at < cur) {
      // 앞 페이지를 지웠으면 지금 페이지 번호만 하나 당긴다(편집 상태는 그대로).
      indexRef.current = cur - 1;
      setPageIndex(cur - 1);
    }
    setDirty(true);
    return true;
  }, [stash, store, switchTo]);

  const applyToPage = useCallback((pageId: string, mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => {
    if (pageId === idsRef.current[indexRef.current]) {
      apply(mutate, opts);
      return;
    }
    const state = store.get(pageId);
    if (!state) return; // 지운 페이지
    const after = mutate(state.doc);
    if (after === state.doc) return;
    const undo = [...state.undo, state.doc];
    if (undo.length > UNDO_LIMIT) undo.shift();
    store.set(pageId, { doc: after, undo });
    setStoreRev((r) => r + 1);
    setDirty(true);
  }, [apply, store]);

  const pageDoc = useCallback((index: number): NoteDoc => {
    if (index === indexRef.current) return docRef.current;
    const id = idsRef.current[index];
    return (id ? store.get(id)?.doc : undefined) ?? toPageDoc([]);
  }, [docRef, store, toPageDoc]);

  const toDoc = useCallback((): PostNoteDoc => ({
    v: DOC_VERSION,
    kind,
    pages: idsRef.current.map((id, i) => ({
      id,
      elements: i === indexRef.current ? docRef.current.elements : (store.get(id)?.doc.elements ?? []),
    })),
  }), [kind, docRef, store]);

  const markClean = useCallback(() => setDirty(false), []);

  return {
    kind,
    canvas,
    editor,
    pageIndex,
    pageCount: pageIds.length,
    pageIds,
    pageId: currentId,
    pageDoc,
    goTo,
    canAddPage: pageIds.length < NOTE_PAGE_MAX,
    addPage,
    canDeletePage: pageIds.length > 1,
    deletePage,
    applyToPage,
    dirty,
    markClean,
    toDoc,
  };
}
