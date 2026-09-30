import { useCallback, useRef, useState } from 'react';

import type { NoteDoc } from './noteDoc';

/** 되돌리기 깊이 — 문서는 구조를 공유하는 불변 객체라 스냅샷 30장이 가볍다. */
const UNDO_LIMIT = 30;

/** 같은 batch 키로 연달아 apply 하면 되돌리기 한 건으로 묶인다(타이핑 한 세션, 지우개 드래그 한 번). */
export type ApplyOptions = { batch?: string };

/** 페이지 하나의 편집 상태 — 여러 페이지 노트가 페이지를 넘길 때 되돌리기 스택째 맡겨 두고 되찾는다. */
export type NoteEditorState = { doc: NoteDoc; undo: NoteDoc[] };

/**
 * 페이지 문서 편집 상태 — 서버와 무관한 순수 편집기. 문서와 되돌리기 스택을 든다.
 * onChange 는 사용자 편집(apply·undo)마다 불린다 — load(페이지 넘김)에는 불리지 않는다.
 */
export function useNoteEditor(initial: NoteDoc, options?: { onChange?: () => void }) {
  const onChangeRef = useRef(options?.onChange);
  onChangeRef.current = options?.onChange;
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const undoRef = useRef<NoteDoc[]>([]);
  const batchRef = useRef<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const commit = useCallback((next: NoteDoc) => {
    docRef.current = next;
    setDoc(next);
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

  /** 지금 페이지의 문서와 되돌리기 스택 — 다른 페이지로 넘기기 전에 맡겨 둔다. */
  const snapshot = useCallback((): NoteEditorState => ({ doc: docRef.current, undo: [...undoRef.current] }), []);

  /** 맡겨 둔 페이지 상태를 되찾는다 — 되돌리기 스택까지 그대로. */
  const load = useCallback((state: NoteEditorState) => {
    batchRef.current = null;
    undoRef.current = [...state.undo];
    setCanUndo(state.undo.length > 0);
    docRef.current = state.doc;
    setDoc(state.doc);
  }, []);

  return { doc, docRef, apply, endBatch, undo, canUndo, snapshot, load };
}

export type NoteEditor = ReturnType<typeof useNoteEditor>;
