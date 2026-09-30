/**
 * 노트 문서 — 앱이 소유한 스키마.
 *
 * 두 겹이다.
 * - `PostNoteDoc`: 노트 모드 독후감 하나 = 노트 종류(kind) + 페이지 1~6장. 서버(`posts.document`)는 이 JSON 을
 *   해석하지 않고 그대로 저장·반환한다(pages 길이·직렬화 크기만 검사). 경계에서 `parsePostNoteDoc` 로 좁힌다.
 * - `NoteDoc`: 캔버스가 그리는 단위 — 페이지 한 장. 노트 문서의 페이지는 `pageDocOf` 로 이 모양이 된다(종이·크기는 kind 에서).
 *   옛 모임 노트북(`ClubNotePageView.document`)도 이 모양이라 `parseDoc` 는 그대로 남는다(그 화면을 걷어낼 때까지).
 * 그래서 CLAUDE.md 의 "서버 응답 필드를 손으로 쓰지 않는다" 규칙에서 이 파일만 예외다 — 서버 타입은 불투명 JSON 이고,
 * 경계에서 여기 타입으로 좁힌다. 모르는 요소는 버리되 절대 throw 하지 않는다.
 *
 * 좌표는 논리 단위다 — 격자·줄노트 1000×1333, 대형노트 2000×2666(같은 3:4, 넓이 4배). 화면엔 scale 을 곱해 그린다.
 * x·y 는 회전 전 박스의 좌상단, rot 는 도(deg). 높이는 저장하지 않는다 — 텍스트·말풍선·문장 조각은 레이아웃이 정하고 사진만 h 를 가진다.
 * 색은 토큰 이름(PenColor)으로 저장한다 — 다크·라이트 어느 쪽에서 봐도 보이게 렌더 시점에 `penColorOf` 로 푼다.
 */
import type { ColorTokens } from '@/theme';

export const DOC_VERSION = 1 as const;

// ────────────────────────────── 노트 종류·캔버스 ──────────────────────────────

/** 노트 종류 — 격자노트 · 줄노트 · 대형노트(큰 도트 종이, 줌으로 쓴다). */
export type NoteKind = 'grid' | 'lined' | 'large';
export const NOTE_KINDS: readonly NoteKind[] = ['grid', 'lined', 'large'];
/** 논리 캔버스 크기. */
export type CanvasSize = { readonly w: number; readonly h: number };

const CANVAS_BY_KIND: Record<NoteKind, CanvasSize> = {
  grid: { w: 1000, h: 1333 },
  lined: { w: 1000, h: 1333 },
  large: { w: 2000, h: 2666 },
};
/** 종류별 논리 캔버스 크기. */
export const canvasFor = (kind: NoteKind): CanvasSize => CANVAS_BY_KIND[kind];
/**
 * 기본(격자·줄노트) 캔버스 — 옛 모임 노트북 화면이 쓰는 값. 새 코드는 `canvasFor(kind)`·`canvasOf(doc)` 를 쓴다.
 * 페이지 비율 3:4 — PNG 는 1080×1440 으로 뽑는다.
 */
export const CANVAS = CANVAS_BY_KIND.grid;
/** 대형노트는 격자노트와 같은 도트 종이를 넓게 편 것이다. */
export const paperFor = (kind: NoteKind): NotePaper => (kind === 'lined' ? 'lined' : 'grid');

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
export const DEFAULT_QUOTE_W = 560;
export const STICKER_W = { emoji: 140, pack: 180 } as const;
/** 사진 종이 프레임(논리 단위) — 요소의 w·h 는 프레임 바깥 크기다. 사진 자체는 inset 만큼 안쪽, 아래는 폴라로이드 여백(lip). */
export const PHOTO_FRAME = { inset: 6, lip: 18 } as const;
/** 프레임 폭 w 에 사진 비율(imgW:imgH)을 맞춘 프레임 높이. 비율을 모르면 정사각형. */
export function photoHeightFor(w: number, imgW?: number | null, imgH?: number | null): number {
  const inner = w - PHOTO_FRAME.inset * 2;
  const ratio = imgW && imgH && imgW > 0 && imgH > 0 ? imgH / imgW : 1;
  return Math.round(inner * ratio + PHOTO_FRAME.inset + PHOTO_FRAME.lip);
}
/** 요소 크기 클램프(논리 단위). 최대 폭은 캔버스 폭 — `maxElementW(canvas)`. */
export const MIN_ELEMENT_W = 40;
/** 격자·줄노트 기준 최대 폭(옛 값). */
export const MAX_ELEMENT_W = 1000;
export const maxElementW = (canvas: CanvasSize) => canvas.w;
/** 잉크 상한 — 서버 요소 상한(300)과 별개로 렌더 비용을 막는 값. */
export const MAX_STROKE_POINTS = 800;
export const MAX_STROKES = 400;
/** 발췌 상한 — 노트 속 글을 이어 붙여 서버의 bodyMd 로 보낼 때. */
export const PLAIN_TEXT_MAX = 20000;

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
/**
 * 오려 둔 문장 조각 — 밑줄(quote) 하나를 노트에 붙인 것. 문장·쪽·책 제목은 붙일 때의 스냅숏이다
 * (원래 밑줄이 고쳐지거나 지워져도 노트는 그대로). quoteId 는 서버가 글에 밑줄을 붙이는 근거라 `quoteIdsOf` 로 뽑아 보낸다.
 */
export type QuoteElement = Placed & {
  type: 'quote';
  w: number;
  quoteId: number;
  text: string;
  page?: number;
  bookTitle?: string;
  author?: string;
};
/** 획 하나. 점은 논리 좌표, width 는 논리 굵기. */
export type InkElement = { id: string; z: number; type: 'ink'; color: PenColor; width: number; points: [number, number][] };

export type NoteElement = TextElement | StickerElement | PhotoElement | SpeechElement | QuoteElement | InkElement;
/** 캔버스에 박스로 놓이는 요소(잉크 제외). */
export type PlacedElement = Exclude<NoteElement, InkElement>;

/**
 * 캔버스가 그리는 페이지 한 장. kind 가 있으면 캔버스 크기를 정한다(없으면 격자 크기 — 옛 모임 노트북).
 * type 별칭이어야 한다(인터페이스 X) — 생성 타입 `{ [key: string]: unknown }` 에 그대로 대입되게.
 */
export type NoteDoc = { v: typeof DOC_VERSION; paper: NotePaper; elements: NoteElement[]; kind?: NoteKind };

export function emptyDoc(): NoteDoc {
  return { v: DOC_VERSION, paper: 'plain', elements: [] };
}

/** 페이지 문서의 논리 캔버스 크기. */
export const canvasOf = (doc: Pick<NoteDoc, 'kind'>): CanvasSize => canvasFor(doc.kind ?? 'grid');

/** 요소 id — 서버가 부여하지 않으므로 앱이 만든다. 같은 페이지 안에서만 유일하면 된다. 페이지 id 도 이걸로 만든다. */
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
/** 편집 시트(더블탭·'편집')로 글을 고칠 수 있는 요소. 문장 조각은 스냅숏이라 고치지 않는다. */
export const isTextual = (e: NoteElement): e is TextElement | SpeechElement => e.type === 'text' || e.type === 'speech';

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
    case 'quote': {
      const p = placed(raw);
      if (!p || !num(raw.w) || !num(raw.quoteId) || !str(raw.text)) return null;
      return {
        ...p,
        type: 'quote',
        w: raw.w,
        quoteId: raw.quoteId,
        text: raw.text,
        page: num(raw.page) ? raw.page : undefined,
        bookTitle: str(raw.bookTitle) ? raw.bookTitle : undefined,
        author: str(raw.author) ? raw.author : undefined,
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

/** 요소 배열을 좁힌다 — 모르는·깨진 요소는 버리고, 같은 id 가 겹치면 뒤의 것이 앞 자리에 남는다. */
function parseElements(raw: unknown): NoteElement[] {
  const elements: NoteElement[] = [];
  if (!Array.isArray(raw)) return elements;
  const seen = new Map<string, number>();
  for (const item of raw) {
    const e = parseElement(item);
    if (!e) continue;
    const at = seen.get(e.id);
    if (at !== undefined) elements[at] = e;
    else {
      seen.set(e.id, elements.length);
      elements.push(e);
    }
  }
  return elements;
}

/**
 * 서버에서 온 불투명 JSON 을 페이지 문서로 좁힌다(옛 모임 노트북).
 * 어떤 입력에도 throw 하지 않는다 — 다른 버전의 앱이 저장한 문서도 열려야 한다.
 */
export function parseDoc(raw: unknown): NoteDoc {
  if (!isRecord(raw)) return emptyDoc();
  return {
    v: DOC_VERSION,
    paper: oneOf(raw.paper, NOTE_PAPERS) ? raw.paper : 'plain',
    elements: parseElements(raw.elements),
  };
}

// ────────────────────────────── 노트 모드 독후감 문서 ──────────────────────────────

/** 노트 한 권의 페이지 상한 — 서버 검사(pages 1~6)와 같은 값. */
export const NOTE_PAGE_MAX = 6;
/** 서버가 받는 document 직렬화 상한(바이트). */
export const NOTE_DOC_MAX_BYTES = 1_000_000;

export type NotePageDoc = { id: string; elements: NoteElement[] };
/** 노트 모드 독후감 문서. pages 는 1..NOTE_PAGE_MAX 장. */
export type PostNoteDoc = { v: typeof DOC_VERSION; kind: NoteKind; pages: NotePageDoc[] };

export function emptyNotePage(): NotePageDoc {
  return { id: newId(), elements: [] };
}

export function emptyPostNoteDoc(kind: NoteKind): PostNoteDoc {
  return { v: DOC_VERSION, kind, pages: [emptyNotePage()] };
}

/**
 * 서버의 불투명 document 를 노트 문서로 좁힌다. 모르는 kind 는 격자, 깨진 페이지는 빈 페이지 취급,
 * 페이지 id 가 없거나 겹치면 새로 매긴다. 6장을 넘으면 자르고, 한 장도 없으면 빈 한 장. 절대 throw 하지 않는다.
 */
export function parsePostNoteDoc(raw: unknown): PostNoteDoc {
  if (!isRecord(raw)) return emptyPostNoteDoc('grid');
  const kind: NoteKind = oneOf(raw.kind, NOTE_KINDS) ? raw.kind : 'grid';
  const pages: NotePageDoc[] = [];
  const ids = new Set<string>();
  if (Array.isArray(raw.pages)) {
    for (const item of raw.pages) {
      if (pages.length >= NOTE_PAGE_MAX) break;
      const r = isRecord(item) ? item : {};
      let id = str(r.id) && r.id.length > 0 ? r.id : newId();
      while (ids.has(id)) id = newId();
      ids.add(id);
      pages.push({ id, elements: parseElements(r.elements) });
    }
  }
  if (pages.length === 0) pages.push(emptyNotePage());
  return { v: DOC_VERSION, kind, pages };
}

/**
 * 서버로 보낼 JSON 객체 — undefined 필드를 걷어낸 깊은 사본. 서버 타입이 불투명 JSON 이라 그대로 넘긴다.
 */
export function serializePostNoteDoc(doc: PostNoteDoc): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ v: doc.v, kind: doc.kind, pages: doc.pages })) as Record<string, unknown>;
}

/** 직렬화 크기(UTF-8 바이트) — 올리기 전에 NOTE_DOC_MAX_BYTES 와 견준다. */
export function postNoteDocBytes(doc: PostNoteDoc): number {
  const json = JSON.stringify({ v: doc.v, kind: doc.kind, pages: doc.pages });
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** 노트 문서의 index 번째 페이지 → 캔버스가 그리는 페이지 문서(종이·크기는 kind 에서). 범위 밖이면 빈 페이지. */
export function pageDocOf(doc: PostNoteDoc, index: number): NoteDoc {
  const page = doc.pages[index];
  return { v: DOC_VERSION, paper: paperFor(doc.kind), kind: doc.kind, elements: page ? page.elements : [] };
}

/** 모든 페이지의 요소를 문서 순서대로. */
function allElements(doc: PostNoteDoc): NoteElement[] {
  return doc.pages.flatMap((p) => p.elements);
}

/** 붙인 밑줄 id — 겹치지 않게, 문서 순서대로. 서버에 quoteIds 로 보낸다. */
export function quoteIdsOf(doc: PostNoteDoc): number[] {
  const out = new Set<number>();
  for (const e of allElements(doc)) if (e.type === 'quote') out.add(e.quoteId);
  return [...out];
}

/** 붙인 사진 id — 겹치지 않게, 문서 순서대로. 서버에 imageIds 로 보낸다. */
export function imageIdsOf(doc: PostNoteDoc): number[] {
  const out = new Set<number>();
  for (const e of allElements(doc)) if (e.type === 'photo') out.add(e.imageId);
  return [...out];
}

/**
 * 노트 속 글(텍스트·말풍선)을 줄바꿈으로 이은 것 — 서버의 발췌·검색용 bodyMd.
 * 페이지 순서대로, 한 페이지 안에서는 위에서 아래(같으면 왼쪽부터)로 읽는다. PLAIN_TEXT_MAX 자에서 자른다.
 */
export function plainTextOf(doc: PostNoteDoc): string {
  const parts: string[] = [];
  for (const page of doc.pages) {
    const texts = page.elements
      .filter((e): e is TextElement | SpeechElement => isTextual(e) && e.text.trim().length > 0)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (const e of texts) parts.push(e.text.trim());
  }
  const joined = parts.join('\n');
  return joined.length > PLAIN_TEXT_MAX ? joined.slice(0, PLAIN_TEXT_MAX) : joined;
}

/** 붙일 밑줄의 스냅숏 — 서버 응답(BookQuote 등)에서 화면이 골라 채운다. */
export type QuoteSnapshot = {
  quoteId: number;
  text: string;
  page?: number | null;
  bookTitle?: string | null;
  author?: string | null;
};

/** 오려 둔 문장 조각 요소를 만든다 — center(논리 좌표)를 주면 그 둘레에, 없으면 캔버스 가운데에 놓는다. */
export function makeQuoteElement(doc: NoteDoc, quote: QuoteSnapshot, center?: readonly [number, number] | null): QuoteElement {
  const canvas = canvasOf(doc);
  const w = Math.min(DEFAULT_QUOTE_W, canvas.w);
  const [cx, cy] = center ?? [canvas.w / 2, canvas.h / 2];
  return {
    id: newId(),
    z: nextZ(doc),
    type: 'quote',
    x: cx - w / 2,
    y: cy - 120,
    rot: 0,
    w,
    quoteId: quote.quoteId,
    text: quote.text,
    page: quote.page ?? undefined,
    bookTitle: quote.bookTitle ?? undefined,
    author: quote.author ?? undefined,
  };
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
