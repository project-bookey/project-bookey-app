import { useCallback, useState } from 'react';

import type { MemberProgress } from '@/api/types';
import { tiltFor } from '@/theme/tokens';
import type { InsertKind, NoteTool } from './NoteToolbar';
import type { EditorPatch } from './TextEditorSheet';
import {
  CANVAS, DEFAULT_SPEECH_W, DEFAULT_TEXT_W, STICKER_W, addElement, newId, nextZ, patchElement, removeElements,
  type NoteElement, type SpeechElement, type TextElement,
} from './noteDoc';
import type { NoteEditor } from './useNoteEditor';

const editBatch = (id: string) => `edit:${id}`;

/**
 * 삽입 동작과 편집 시트 상태 — 텍스트·말풍선은 빈 요소를 넣고 바로 시트를 연다(넣기+타이핑이 되돌리기 한 건).
 * 스티커는 시트에서 고르면 가운데에 붙인다. 사진은 useNotePhotos 가 맡는다.
 */
export function useNoteInserts({ editor, me, setTool, select, pickPhoto }: {
  editor: NoteEditor;
  me: MemberProgress | undefined;
  setTool: (tool: NoteTool) => void;
  select: (id: string | null) => void;
  pickPhoto: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);

  const openEditor = useCallback((id: string) => {
    setTool('select');
    select(id);
    setEditingId(id);
  }, [setTool, select]);

  const insert = useCallback((kind: InsertKind) => {
    if (kind === 'photo') {
      pickPhoto();
      return;
    }
    if (kind === 'sticker') {
      setStickerOpen(true);
      return;
    }
    const id = newId();
    editor.apply((d) => {
      const base = { id, z: nextZ(d), rot: 0 };
      const element: NoteElement = kind === 'text'
        ? { ...base, type: 'text', x: (CANVAS.w - DEFAULT_TEXT_W) / 2, y: 560, w: DEFAULT_TEXT_W, text: '', font: 'sans', size: 'm', color: 'ink', align: 'left' }
        : {
            ...base, type: 'speech', x: (CANVAS.w - DEFAULT_SPEECH_W) / 2, y: 520, w: DEFAULT_SPEECH_W, text: '',
            userId: me?.userId ?? 0, nickname: me?.nickname ?? '나', avatarUrl: me?.avatarUrl ?? undefined,
            tail: 'left', font: 'sans', size: 'm',
          };
      return addElement(d, element);
    }, { batch: editBatch(id) });
    openEditor(id);
  }, [editor, me, pickPhoto, openEditor]);

  const pickSticker = useCallback((kind: 'emoji' | 'pack', value: string) => {
    const id = newId();
    const w = STICKER_W[kind];
    editor.apply((d) => addElement(d, {
      id, z: nextZ(d), type: 'sticker', x: (CANVAS.w - w) / 2, y: (CANVAS.h - w) / 2, rot: tiltFor(d.elements.length), w, kind, value,
    }));
    setStickerOpen(false);
    setTool('select');
    select(id);
  }, [editor, setTool, select]);

  const editing = editingId
    ? (editor.doc.elements.find((e): e is TextElement | SpeechElement =>
        e.id === editingId && (e.type === 'text' || e.type === 'speech')) ?? null)
    : null;

  const patchEditing = useCallback((patch: EditorPatch) => {
    if (!editingId) return;
    editor.apply((d) => patchElement(d, editingId, patch as Partial<NoteElement>), { batch: editBatch(editingId) });
  }, [editor, editingId]);

  /** 닫을 때 빈 글이면 요소를 거둔다 — 넣었다가 아무것도 안 쓴 자리를 남기지 않는다. */
  const closeEditor = useCallback(() => {
    const id = editingId;
    if (id) {
      const el = editor.docRef.current.elements.find((e) => e.id === id);
      if (el && (el.type === 'text' || el.type === 'speech') && el.text.trim() === '') {
        editor.apply((d) => removeElements(d, new Set([id])), { batch: editBatch(id) });
        select(null);
      }
    }
    editor.endBatch();
    setEditingId(null);
  }, [editor, editingId, select]);

  return {
    insert, openEditor, editing, patchEditing, closeEditor,
    stickerOpen, closeSticker: () => setStickerOpen(false), pickSticker,
  };
}
