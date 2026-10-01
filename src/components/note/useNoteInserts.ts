import { useCallback, useState } from 'react';

import type { ActivityCard } from '@/api/types';
import { tiltFor } from '@/theme/tokens';
import { snapshotOf } from './elements/ActivityCardFace';
import type { InsertKind, NoteTool } from './NoteToolbar';
import type { EditorPatch } from './TextEditorSheet';
import {
  DEFAULT_SPEECH_W, DEFAULT_TEXT_W, STICKER_W, addElement, canvasOf, makeQuoteElement, newId, nextZ, patchElement,
  removeElements, type NoteDoc, type NoteElement, type QuoteSnapshot, type SpeechElement, type TextElement,
} from './noteDoc';
import type { Point } from './noteGeometry';
import type { NoteEditor } from './useNoteEditor';

const editBatch = (id: string) => `edit:${id}`;

/** 말풍선에 박을 화자 — 클럽 멤버(MemberProgress)나 내 정보(Me) 어느 쪽이든 이 모양이면 된다. */
export type NoteSpeaker = { userId: number; nickname: string; avatarUrl?: string | null };

/** 삽입 기준점(논리 좌표) — 주면 그 자리를 가운데로 넣고, 없거나 null 이면 캔버스 가운데쯤. */
export type AnchorFn = () => Point | null;

/** 기준점 → 캔버스 안의 가운데 좌표. 화면은 줌 무대에서 지금 보이는 가운데를 넘긴다. */
export function anchorOf(doc: NoteDoc, getAnchor?: AnchorFn): Point {
  const canvas = canvasOf(doc);
  return getAnchor?.() ?? [canvas.w / 2, canvas.h / 2];
}

/**
 * 삽입 동작과 편집 시트 상태 — 텍스트·말풍선은 빈 요소를 넣고 바로 시트를 연다(넣기+타이핑이 되돌리기 한 건).
 * 스티커는 시트에서 고르면 가운데에 붙인다. 사진은 useNotePhotos 가, 문장 조각은 pickQuote 가 맡는다.
 * 넣는 자리는 문서의 캔버스(노트 종류) 가운데거나, getAnchor 가 준 자리(줌 무대에서 지금 보이는 가운데)다.
 */
export function useNoteInserts({ editor, me, setTool, select, pickPhoto, openQuotes, getAnchor }: {
  editor: NoteEditor;
  me: NoteSpeaker | undefined;
  setTool: (tool: NoteTool) => void;
  select: (id: string | null) => void;
  pickPhoto: () => void;
  /** '문장' 삽입 — 밑줄 고르기 시트를 연다(화면 몫). 고르면 pickQuote 로 붙인다. */
  openQuotes?: () => void;
  getAnchor?: AnchorFn;
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
    if (kind === 'quote') {
      openQuotes?.();
      return;
    }
    const id = newId();
    editor.apply((d) => {
      const [cx, cy] = anchorOf(d, getAnchor);
      const base = { id, z: nextZ(d), rot: 0 };
      // 예전 자리(가운데보다 조금 위)를 유지한다 — 논리 1333 높이에서 y 560 은 가운데보다 약 107 위.
      const element: NoteElement = kind === 'text'
        ? { ...base, type: 'text', x: cx - DEFAULT_TEXT_W / 2, y: cy - 107, w: DEFAULT_TEXT_W, text: '', font: 'sans', size: 'm', color: 'ink', align: 'left' }
        : {
            ...base, type: 'speech', x: cx - DEFAULT_SPEECH_W / 2, y: cy - 147, w: DEFAULT_SPEECH_W, text: '',
            userId: me?.userId ?? 0, nickname: me?.nickname ?? '나', avatarUrl: me?.avatarUrl ?? undefined,
            tail: 'left', font: 'sans', size: 'm',
          };
      return addElement(d, element);
    }, { batch: editBatch(id) });
    openEditor(id);
  }, [editor, me, pickPhoto, openQuotes, openEditor, getAnchor]);

  const pickSticker = useCallback((kind: 'emoji' | 'pack', value: string) => {
    const id = newId();
    const w = STICKER_W[kind];
    editor.apply((d) => {
      const [cx, cy] = anchorOf(d, getAnchor);
      return addElement(d, {
        id, z: nextZ(d), type: 'sticker', x: cx - w / 2, y: cy - w / 2, rot: tiltFor(d.elements.length), w, kind, value,
      });
    });
    setStickerOpen(false);
    setTool('select');
    select(id);
  }, [editor, setTool, select, getAnchor]);

  /** 함께 독서 기록 카드 붙이기 — 카드 값을 스냅숏으로 담아 둔다(보는 사람이 클럽 멤버가 아니어도 그려지게). */
  const pickCard = useCallback((card: ActivityCard) => {
    const id = newId();
    const w = STICKER_W.card;
    editor.apply((d) => {
      const [cx, cy] = anchorOf(d, getAnchor);
      return addElement(d, {
        id, z: nextZ(d), type: 'sticker', x: cx - w / 2, y: cy - w / 2, rot: tiltFor(d.elements.length), w,
        kind: 'card', value: String(card.id), card: snapshotOf(card),
      });
    });
    setStickerOpen(false);
    setTool('select');
    select(id);
  }, [editor, setTool, select, getAnchor]);

  /** 오려 둔 문장 조각 붙이기 — 밑줄 고르기 시트에서 고른 스냅숏을 기준점에 놓고 선택 상태로 둔다. 새 요소 id 를 돌려준다. */
  const pickQuote = useCallback((quote: QuoteSnapshot): string => {
    let id = '';
    editor.apply((d) => {
      const element = makeQuoteElement(d, quote, anchorOf(d, getAnchor));
      id = element.id;
      return addElement(d, element);
    });
    setTool('select');
    select(id);
    return id;
  }, [editor, setTool, select, getAnchor]);

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
    stickerOpen, closeSticker: () => setStickerOpen(false), pickSticker, pickCard, pickQuote,
  };
}
