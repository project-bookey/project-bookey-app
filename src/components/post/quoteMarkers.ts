/**
 * 독후감 본문 안의 '오려둔 문장' 표시.
 *
 * 본문은 마크다운 문자열 하나이고, 밑줄이 들어갈 자리는 `〖오려둔 문장 123〗` 한 줄로 남는다.
 * 첨부 목록(quoteIds)은 이 표시에서 파생하므로, 본문에서 표시를 지우면 첨부도 풀린다.
 */

/** 표시를 찾는 정규식 — 쓸 때마다 lastIndex 가 남지 않게 매번 새로 만든다. */
const MARKER = () => /〖오려둔 문장 (\d+)〗/g;

export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'quote'; quoteId: number };

/** 본문에 넣을 표시 문자열. */
export function quoteMarker(quoteId: number): string {
  return `〖오려둔 문장 ${quoteId}〗`;
}

/** 본문에 나온 순서대로 밑줄 id 를 모은다(같은 밑줄이 여러 번이면 첫 자리만). */
export function parseQuoteIds(md: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of md.matchAll(MARKER())) {
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 본문을 글 조각과 표시로 쪼갠다. 빈 글 조각은 버린다. */
export function splitByQuoteMarkers(md: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of md.matchAll(MARKER())) {
    const start = match.index ?? 0;
    const text = md.slice(last, start);
    if (text.trim()) segments.push({ kind: 'text', text });
    segments.push({ kind: 'quote', quoteId: Number(match[1]) });
    last = start + match[0].length;
  }
  const tail = md.slice(last);
  if (tail.trim()) segments.push({ kind: 'text', text: tail });
  return segments;
}

/**
 * `at` 자리에 표시를 넣는다. 앞뒤로 빈 줄을 보장해 표시가 제 문단이 되게 하고,
 * 새 커서 자리(표시 뒤)를 함께 돌려준다.
 */
export function insertQuoteMarkers(
  md: string,
  at: number,
  quoteIds: number[],
): { text: string; cursor: number } {
  if (quoteIds.length === 0) return { text: md, cursor: at };
  const pos = Math.max(0, Math.min(at, md.length));
  const before = md.slice(0, pos);
  const after = md.slice(pos);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const block = quoteIds.map(quoteMarker).join('\n\n');
  const text = `${before}${lead}${block}${trail}${after}`;
  return { text, cursor: before.length + lead.length + block.length };
}
