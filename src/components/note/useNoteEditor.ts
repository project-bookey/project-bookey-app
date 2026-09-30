import { useCallback, useRef, useState } from 'react';

import type { NoteDoc } from './noteDoc';
import { PAPER_TOUCH_KEY, changedIds } from './noteMerge';

/** 되돌리기 깊이 — 문서는 구조를 공유하는 불변 객체라 스냅샷 30장이 가볍다. */
const UNDO_LIMIT = 30;

/** 같은 batch 키로 연달아 apply 하면 되돌리기 한 건으로 묶인다(타이핑 한 세션, 지우개 드래그 한 번). */
export type ApplyOptions = { batch?: string };

/** 페이지 하나의 편집 상태 — 여러 페이지 노트가 페이지를 넘길 때 되돌리기 스택째 맡겨 두고 되찾는다. */
export type NoteEditorState = { doc: NoteDoc; undo: NoteDoc[] };

/**
 * 페이지 문서 편집 상태 — 서버와 무관한 순수 편집기. 문서·되돌리기 스택·"내가 건드린 요소 id" 를 든다.
 * touched 는 409 병합 때 내 변경을 가려내는 근거라 서버와 맞출 때(clearTouched)만 비운다.
 * onChange 는 사용자 편집(apply·undo·undoable replace)마다 불린다 — reset·load(페이지 넘김)에는 불리지 않는다.
 */
export function useNoteEditor(initial: NoteDoc, options?: { onChange?: () => void }) {
  const onChangeRef = useRef(options?.onChange);
  onChangeRef.current = options?.onChange;
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const undoRef = useRef<NoteDoc[]>([]);
  const batchRef = useRef<string | null>(null);
  const touchedRef = useRef<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  /** 문서가 바뀔 때마다 오르는 카운터 — 자동 저장 훅이 이걸 보고 타이머를 건다. */
  const [rev, setRev] = useState(0);

  const commit = useCallback((next: NoteDoc) => {
    const before = docRef.current;
    for (const id of changedIds(before, next)) touchedRef.current.add(id);
    if (before.paper !== next.paper) touchedRef.current.add(PAPER_TOUCH_KEY);
    docRef.current = next;
    setDoc(next);
    setRev((r) => r + 1);
    onChangeRef.current?.();
  }, []);

  const pushUndo = (snapshot: NoteDoc) => {
    const stack = undoRef.current;
    stack.push(snapshot);
    if (stack.length > UNDO_LIMIT) stack.shift();
    setCanUndo(true);
  };

  const apply = useCallback((mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => {
    const before = docRef.current;
    const after = mutate(before);
    if (after === before) return;
    const batch = opts?.batch ?? null;
    if (batch === null || batchRef.current !== batch) pushUndo(before);
    batchRef.current = batch;
    commit(after);
  }, [commit]);

  /** 진행 중인 묶음을 닫는다 — 다음 apply 는 새 되돌리기 건이 된다. */
  const endBatch = useCallback(() => {
    batchRef.current = null;
  }, []);

  const undo = useCallback(() => {
    batchRef.current = null;
    const prev = undoRef.current.pop();
    if (!prev) {
      setCanUndo(false);
      return;
    }
    commit(prev);
    setCanUndo(undoRef.current.length > 0);
  }, [commit]);

  /**
   * 문서를 통째로 갈아 끼운다 — 서버에서 처음 받을 때(undoable 없음, touched 안 건드림)와
   * 409 병합 결과를 얹을 때(undoable: 잘못 섞였으면 한 번 되돌릴 수 있게).
   */
  const replace = useCallback((next: NoteDoc, opts?: { undoable?: boolean }) => {
    batchRef.current = null;
    if (opts?.undoable) pushUndo(docRef.current);
    docRef.current = next;
    setDoc(next);
    setRev((r) => r + 1);
    if (opts?.undoable) onChangeRef.current?.();
  }, []);

  const clearTouched = useCallback(() => {
    touchedRef.current.clear();
  }, []);

  /** 다른 페이지로 넘어갈 때 — 문서·되돌리기·touched 를 전부 새로 시작한다. */
  const reset = useCallback((next: NoteDoc) => {
    batchRef.current = null;
    undoRef.current = [];
    touchedRef.current.clear();
    setCanUndo(false);
    docRef.current = next;
    setDoc(next);
    setRev((r) => r + 1);
  }, []);

  /** 지금 페이지의 문서와 되돌리기 스택 — 다른 페이지로 넘기기 전에 맡겨 둔다. */
  const snapshot = useCallback((): NoteEditorState => ({ doc: docRef.current, undo: [...undoRef.current] }), []);

  /** 맡겨 둔 페이지 상태를 되찾는다 — 되돌리기 스택까지 그대로. touched 는 비운다(서버 병합과 무관한 흐름). */
  const load = useCallback((state: NoteEditorState) => {
    batchRef.current = null;
    undoRef.current = [...state.undo];
    touchedRef.current.clear();
    setCanUndo(state.undo.length > 0);
    docRef.current = state.doc;
    setDoc(state.doc);
    setRev((r) => r + 1);
  }, []);

  return { doc, docRef, rev, apply, endBatch, undo, canUndo, replace, reset, touchedRef, clearTouched, snapshot, load };
}

export type NoteEditor = ReturnType<typeof useNoteEditor>;
