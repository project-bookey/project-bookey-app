import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ElementHandlers } from './EditableElementView';
import type { NoteTool } from './NoteToolbar';
import { applyPreview, settle, type Delta, type Preview } from './editing';
import { bringToFront, canvasOf, removeElements, replaceElement, type PlacedElement } from './noteDoc';
import type { NoteEditor } from './useNoteEditor';

/**
 * 선택 도구 상태 — 선택된 요소, 진행 중 델타(preview), 측정 높이, 요소 제스처 핸들러.
 * 도구가 선택 모드를 벗어나거나 선택된 요소가 사라지면(되돌리기·지우기) 선택을 푼다.
 */
export function useNoteSelection({ editor, scaleRef, tool, onEdit }: {
  editor: NoteEditor;
  scaleRef: { current: number };
  tool: NoteTool;
  onEdit: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedHeight, setSelectedHeight] = useState(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  useEffect(() => {
    if (tool !== 'select') {
      setSelectedId(null);
      setPreview(null);
    }
  }, [tool]);

  useEffect(() => {
    if (selectedId && !editor.doc.elements.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [editor.doc, selectedId]);

  const commit = useCallback((id: string, delta: Delta) => {
    editor.apply((doc) => {
      const el = doc.elements.find((e) => e.id === id);
      if (!el || el.type === 'ink') return doc;
      // 노트 종류마다 캔버스 크기가 달라(대형노트) 클램프도 그 문서의 캔버스로 한다.
      const canvas = canvasOf(doc);
      return replaceElement(doc, settle(applyPreview(el, { id, ...delta }, scaleRef.current, canvas), canvas));
    });
    setPreview(null);
  }, [editor, scaleRef]);

  const handlers = useMemo<ElementHandlers>(() => ({
    onSelect: (id) => setSelectedId(id),
    onEdit: (id) => onEditRef.current(id),
    onPreview: (p) => setPreview(p),
    onCommit: commit,
    onMeasure: (id, height) => {
      if (id === selectedRef.current) setSelectedHeight(height);
    },
  }), [commit]);

  const selected = tool === 'select' && selectedId
    ? (editor.doc.elements.find((e): e is PlacedElement => e.id === selectedId && e.type !== 'ink') ?? null)
    : null;

  const remove = useCallback(() => {
    const id = selectedRef.current;
    if (!id) return;
    editor.apply((d) => removeElements(d, new Set([id])));
    setSelectedId(null);
  }, [editor]);

  const front = useCallback(() => {
    const id = selectedRef.current;
    if (id) editor.apply((d) => bringToFront(d, id));
  }, [editor]);

  return { selectedId, select: setSelectedId, selected, preview, selectedHeight, handlers, commit, remove, front };
}
