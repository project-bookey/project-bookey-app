/**
 * 모임 노트북 페이지 문서 — 앱이 소유한 스키마.
 *
 * 서버(`ClubNotePageView.document`)는 이 JSON 을 해석하지 않고 jsonb 로 그대로 저장·반환한다(요소 수·크기만 검사).
 * 그래서 CLAUDE.md 의 "서버 응답 필드를 손으로 쓰지 않는다" 규칙에서 이 파일만 예외다 — 생성 타입은
 * `{ [key: string]: unknown }` 이고, 경계(`parseDoc`)에서 여기 타입으로 좁힌다. 모르는 요소는 버리되 절대 throw 하지 않는다.
 *
 * 좌표는 논리 단위(CANVAS.w = 1000, 3:4)다. 화면엔 scale 을 곱해 그린다. x·y 는 회전 전 박스의 좌상단, rot 는 도(deg).
 * 높이는 저장하지 않는다 — 텍스트·말풍선은 레이아웃이 정하고 사진만 h 를 가진다.
 * 색은 토큰 이름(PenColor)으로 저장한다 — 다크·라이트 어느 쪽에서 봐도 보이게 렌더 시점에 `penColorOf` 로 푼다.
 */
import type { ColorTokens } from '@/theme';

export const DOC_VERSION = 1 as const;
/** 논리 캔버스 크기. 페이지 비율 3:4 — PNG 는 1080×1440 으로 뽑는다. */
export const CANVAS = { w: 1000, h: 1333 } as const;

export type PenColor = 'ink' | 'accent' | 'red' | 'blue' | 'yellow' | 'muted';
export const PEN_COLORS: readonly PenColor[] = ['ink', 'accent', 'red', 'blue', 'yellow', 'muted'];
export const PEN_WIDTHS = [4, 8, 14] as const;
export type PenWidth = (typeof PEN_WIDTHS)[number];

export type NoteFont = 'sans' | 'serif' | 'mono';
export type NoteSize = 's' | 'm' | 'l';
/** 텍스트 논리 크기 — 330px 페이지에서 약 10/14/19px, 1080px 내보내기에서 35/45/63px. */
export const TEXT_SIZE: Record<NoteSize, number> = { s: 32, m: 42, l: 58 };
export type NotePaper = 'plain' | 'grid' | 'lined';
export const NOTE_PAPERS: readonly NotePaper[] = ['plain', 'grid', 'lined'];

/** 삽입 기본 폭(논리 단위). */
export const DEFAULT_TEXT_W = 500;
export const DEFAULT_SPEECH_W = 520;
export const DEFAULT_PHOTO_W = 480;
export const STICKER_W = { emoji: 140, pack: 180 } as const;
/** 사진 종이 프레임(논리 단위) — 요소의 w·h 는 프레임 바깥 크기다. 사진 자체는 inset 만큼 안쪽, 아래는 폴라로이드 여백(lip). */
export const PHOTO_FRAME = { inset: 6, lip: 18 } as const;
/** 프레임 폭 w 에 사진 비율(imgW:imgH)을 맞춘 프레임 높이. 비율을 모르면 정사각형. */
export function photoHeightFor(w: number, imgW?: number | null, imgH?: number | null): number {
  const inner = w - PHOTO_FRAME.inset * 2;
  const ratio = imgW && imgH && imgW > 0 && imgH > 0 ? imgH / imgW : 1;
  return Math.round(inner * ratio + PHOTO_FRAME.inset + PHOTO_FRAME.lip);
}
/** 요소 크기 클램프(논리 단위). */
export const MIN_ELEMENT_W = 40;
export const MAX_ELEMENT_W = 1000;
/** 잉크 상한 — 서버 요소 상한(300)과 별개로 렌더 비용을 막는 값. */
export const MAX_STROKE_POINTS = 800;
export const MAX_STROKES = 400;

type Placed = { id: string; z: number; x: number; y: number; rot: number };

export type TextElement = Placed & {
  type: 'text';
  w: number;
  text: string;
  font: NoteFont;
  size: NoteSize;
  color: PenColor;
  align: 'left' | 'center';
};
export type StickerElement = Placed & { type: 'sticker'; w: number; kind: 'emoji' | 'pack'; value: string };
export type PhotoElement = Placed & { type: 'photo'; w: number; h: number; imageId: number; url: string };
export type SpeechElement = Placed & {
  type: 'speech';
  w: number;
  userId: number;
  nickname: string;
  avatarUrl?: string;
  text: string;
  tail: 'left' | 'right';
  font: 'sans' | 'serif';
  size: NoteSize;
};
/** 획 하나. 점은 논리 좌표, width 는 논리 굵기. */
export type InkElement = { id: string; z: number; type: 'ink'; color: PenColor; width: number; points: [number, number][] };

export type NoteElement = TextElement | StickerElement | PhotoElement | SpeechElement | InkElement;
/** 캔버스에 박스로 놓이는 요소(잉크 제외). */
export type PlacedElement = Exclude<NoteElement, InkElement>;

/** type 별칭이어야 한다(인터페이스 X) — 생성 타입 `{ [key: string]: unknown }` 에 그대로 대입되게. */
export type NoteDoc = { v: typeof DOC_VERSION; paper: NotePaper; elements: NoteElement[] };

export function emptyDoc(): NoteDoc {
  return { v: DOC_VERSION, paper: 'plain', elements: [] };
}

/** 요소 id — 서버가 부여하지 않으므로 앱이 만든다. 병합은 이 id 로 하므로 같은 페이지 안에서만 유일하면 된다. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function nextZ(doc: NoteDoc): number {
  let max = 0;
  for (const e of doc.elements) if (e.z > max) max = e.z;
  return max + 1;
}

export const isInk = (e: NoteElement): e is InkElement => e.type === 'ink';
export const isPlaced = (e: NoteElement): e is PlacedElement => e.type !== 'ink';

/** 펜 색 토큰 → 실제 색. 테마가 바뀌면 같은 문서가 다른 색으로 풀린다(그게 의도). */
export function penColorOf(colors: ColorTokens): Record<PenColor, string> {
  return {
    ink: colors.text,
    accent: colors.accent,
    red: colors.danger,
    blue: colors.penBlue,
    yellow: colors.warn,
    muted: colors.textFaint,
  };
}

// ────────────────────────────── 파싱 ──────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => str(v) && (list as readonly string[]).includes(v);

const FONTS: readonly NoteFont[] = ['sans', 'serif', 'mono'];
const SIZES: readonly NoteSize[] = ['s', 'm', 'l'];

function placed(r: Record<string, unknown>): Placed | null {
  if (!str(r.id) || !num(r.x) || !num(r.y)) return null;
  return { id: r.id, z: num(r.z) ? r.z : 0, x: r.x, y: r.y, rot: num(r.rot) ? r.rot : 0 };
}

function parseElement(raw: unknown): NoteElement | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'text': {
      const p = placed(raw);
      if (!p || !num(raw.w) || !str(raw.text)) return null;
      return {
        ...p,
        type: 'text',
        w: raw.w,
        text: raw.text,
        font: oneOf(raw.font, FONTS) ? raw.font : 'sans',
        size: oneOf(raw.size, SIZES) ? raw.size : 'm',
        color: oneOf(raw.color, PEN_COLORS) ? raw.color : 'ink',
        align: raw.align === 'center' ? 'center' : 'left',
      };
    }
    case 'sticker': {
      const p = placed(raw);
      if (!p || !num(raw.w) || !str(raw.value)) return null;
      return { ...p, type: 'sticker', w: raw.w, kind: raw.kind === 'pack' ? 'pack' : 'emoji', value: raw.value };
    }
    case 'photo': {
      const p = placed(raw);
      if (!p || !num(raw.w) || !num(raw.h) || !num(raw.imageId) || !str(raw.url)) return null;
      return { ...p, type: 'photo', w: raw.w, h: raw.h, imageId: raw.imageId, url: raw.url };
    }
    case 'speech': {
      const p = placed(raw);
      if (!p || !num(raw.w) || !num(raw.userId) || !str(raw.nickname) || !str(raw.text)) return null;
      return {
        ...p,
        type: 'speech',
        w: raw.w,
        userId: raw.userId,
        nickname: raw.nickname,
        avatarUrl: str(raw.avatarUrl) ? raw.avatarUrl : undefined,
        text: raw.text,
        tail: raw.tail === 'right' ? 'right' : 'left',
        font: raw.font === 'serif' ? 'serif' : 'sans',
        size: oneOf(raw.size, SIZES) ? raw.size : 'm',
      };
    }
    case 'ink': {
      if (!str(raw.id) || !Array.isArray(raw.points)) return null;
      const points: [number, number][] = [];
      for (const pt of raw.points) {
        if (Array.isArray(pt) && num(pt[0]) && num(pt[1])) points.push([pt[0], pt[1]]);
      }
      if (points.length === 0) return null;
      return {
        id: raw.id,
        z: num(raw.z) ? raw.z : 0,
        type: 'ink',
        color: oneOf(raw.color, PEN_COLORS) ? raw.color : 'ink',
        width: num(raw.width) ? raw.width : PEN_WIDTHS[1],
        points,
      };
    }
    default:
      return null;
  }
}

/**
 * 서버에서 온 불투명 JSON 을 문서로 좁힌다. 모르는 요소·깨진 요소는 버리고, 같은 id 가 겹치면 뒤의 것이 남는다.
 * 어떤 입력에도 throw 하지 않는다 — 다른 버전의 앱이 저장한 문서도 열려야 한다.
 */
export function parseDoc(raw: unknown): NoteDoc {
  if (!isRecord(raw)) return emptyDoc();
  const elements: NoteElement[] = [];
  const seen = new Map<string, number>();
  if (Array.isArray(raw.elements)) {
    for (const item of raw.elements) {
      const e = parseElement(item);
      if (!e) continue;
      const at = seen.get(e.id);
      if (at !== undefined) elements[at] = e;
      else {
        seen.set(e.id, elements.length);
        elements.push(e);
      }
    }
  }
  return { v: DOC_VERSION, paper: oneOf(raw.paper, NOTE_PAPERS) ? raw.paper : 'plain', elements };
}

// ────────────────────────────── 변경 헬퍼 ──────────────────────────────

/** 요소 하나를 갈아 끼운 새 문서. 없으면 그대로. */
export function patchElement<T extends NoteElement>(doc: NoteDoc, id: string, patch: Partial<T>): NoteDoc {
  let changed = false;
  const elements = doc.elements.map((e) => {
    if (e.id !== id) return e;
    changed = true;
    return { ...e, ...patch } as NoteElement;
  });
  return changed ? { ...doc, elements } : doc;
}

/** 같은 id 의 요소를 통째로 바꾼 새 문서. 없으면 그대로. */
export function replaceElement(doc: NoteDoc, element: NoteElement): NoteDoc {
  let changed = false;
  const elements = doc.elements.map((e) => {
    if (e.id !== element.id) return e;
    changed = true;
    return element;
  });
  return changed ? { ...doc, elements } : doc;
}

export function addElement(doc: NoteDoc, element: NoteElement): NoteDoc {
  return { ...doc, elements: [...doc.elements, element] };
}

export function removeElements(doc: NoteDoc, ids: ReadonlySet<string>): NoteDoc {
  if (ids.size === 0) return doc;
  const elements = doc.elements.filter((e) => !ids.has(e.id));
  return elements.length === doc.elements.length ? doc : { ...doc, elements };
}

/** 맨 앞으로 — z 를 최댓값+1 로. */
export function bringToFront(doc: NoteDoc, id: string): NoteDoc {
  return patchElement(doc, id, { z: nextZ(doc) });
}

/** 렌더 순서 — z 오름차순, 같으면 id 로 안정 정렬. */
export function sortByZ<T extends NoteElement>(elements: readonly T[]): T[] {
  return [...elements].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
