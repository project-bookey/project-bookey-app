/**
 * 요소 id 기준 3-way 병합 — 저장이 409 로 튕겼을 때(다른 멤버가 먼저 저장) 내 변경을 최신 위에 다시 얹는다.
 *
 * base   = 내가 마지막으로 서버와 맞춘 문서
 * mine   = 지금 내 화면의 문서
 * theirs = 서버의 최신 문서
 * touched = base 이후 내가 만들거나 고치거나 지운 요소 id(그리고 'paper' 표식)
 *
 * 규칙: 내가 안 건드린 id 는 theirs 를 그대로 따른다(그쪽의 삭제 포함). 내가 건드린 id 는 theirs 가 base 와 같으면 mine,
 * 둘 다 바뀌었으면 mine 이 이긴다. 한쪽이 지우고 한쪽이 고쳤으면 고친 쪽을 남긴다 — 지운 건 되살릴 수 있지만 고친 건 잃으면 끝이라서.
 */
import type { NoteDoc, NoteElement } from './noteDoc';
import { sortByZ } from './noteDoc';

export const PAPER_TOUCH_KEY = 'paper';

const byId = (doc: NoteDoc) => {
  const m = new Map<string, NoteElement>();
  for (const e of doc.elements) m.set(e.id, e);
  return m;
};

const same = (a: NoteElement | undefined, b: NoteElement | undefined) =>
  a === b || (a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b));

export function mergeDocs(base: NoteDoc, mine: NoteDoc, theirs: NoteDoc, touched: ReadonlySet<string>): NoteDoc {
  const b = byId(base);
  const m = byId(mine);
  const t = byId(theirs);
  const ids = new Set<string>([...b.keys(), ...m.keys(), ...t.keys()]);
  const out: NoteElement[] = [];
  for (const id of ids) {
    const mineEl = m.get(id);
    const theirEl = t.get(id);
    let pick: NoteElement | undefined;
    if (!touched.has(id)) {
      pick = theirEl;
    } else if (same(theirEl, b.get(id))) {
      pick = mineEl;
    } else if (mineEl === undefined) {
      pick = theirEl; // 내가 지웠는데 그쪽이 고침 — 고친 것을 남긴다
    } else {
      pick = mineEl; // 그쪽이 지웠거나 둘 다 고침 — 내 것이 이긴다
    }
    if (pick) out.push(pick);
  }
  return {
    v: mine.v,
    paper: touched.has(PAPER_TOUCH_KEY) ? mine.paper : theirs.paper,
    elements: sortByZ(out),
  };
}

/** 두 문서 사이에서 바뀐 요소 id — apply 마다 touched 에 더한다(참조 비교라 싸다). */
export function changedIds(before: NoteDoc, after: NoteDoc): string[] {
  if (before === after) return [];
  const prev = byId(before);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const e of after.elements) {
    seen.add(e.id);
    if (prev.get(e.id) !== e) ids.push(e.id);
  }
  for (const id of prev.keys()) if (!seen.has(id)) ids.push(id);
  return ids;
}
