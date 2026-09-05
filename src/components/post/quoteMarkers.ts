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
 * 본문에서 그 밑줄의 표시를 지운다. 표시가 홀로 있던 문단이면 남은 빈 줄도 함께 정리한다.
 *
 * 글 사이에서는 지운 자리에 줄바꿈이 셋 이상 맞붙으면 빈 줄 하나(`\n\n`)로 접는다 — 그 자리만
 * 손대고 글 전체를 `trim` 하지는 않는다(사용자가 쓰던 여백을 건드리지 않게).
 * 다만 글의 맨 앞·맨 뒤에서는 이을 글이 한쪽뿐이라 문단 사이 빈 줄 자체가 필요 없다.
 * 거기서는 줄바꿈이 둘만 맞붙어도 통째로 접는다 — 안 그러면 맨 앞 표시를 뗀 자리에 빈 줄이 남는다.
 * 같은 밑줄이 여러 번 있으면 전부 지운다.
 */
export function removeQuoteMarker(md: string, quoteId: number): string {
  // 닫는 괄호까지 붙여 찾으므로 12 를 지우다 123 을 건드릴 일은 없다.
  const marker = quoteMarker(quoteId);
  let head = '';
  let rest = md;
  for (;;) {
    const at = rest.indexOf(marker);
    if (at < 0) break;
    head += rest.slice(0, at);
    rest = rest.slice(at + marker.length);
    // 표시가 제 문단으로 홀로 있었다면 앞뒤 빈 줄이 맞붙는다 — 그 자리만 빈 줄 하나로 접는다.
    const before = /\n+$/.exec(head)?.[0].length ?? 0;
    const after = /^\n+/.exec(rest)?.[0].length ?? 0;
    const left = head.slice(0, head.length - before);
    const right = rest.slice(after);
    // 한쪽이 비면 글의 경계다 — 이을 글이 없으니 빈 줄을 남기지 않고, 접는 문턱도 한 칸 낮다.
    const edge = left.length === 0 || right.length === 0;
    if (before + after >= (edge ? 2 : 3)) {
      head = edge ? left : `${left}\n\n`;
      rest = right;
    }
  }
  return head + rest;
}

/**
 * 표시 한가운데는 자를 수 없다 — 그 자리에 끼우면 표시가 글자로 부서진다. 표시 끝으로 민다.
 *
 * 커서가 표시 안에 놓이는 건 사용자가 그리로 옮겼을 때만이 아니다. 본문이 바뀌는 사이
 * 예전 좌표가 남아 있으면 그 좌표가 표시 한가운데를 가리킬 수 있다.
 */
function safeInsertPos(md: string, at: number): number {
  const pos = Math.max(0, Math.min(at, md.length));
  for (const match of md.matchAll(MARKER())) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (pos > start && pos < end) return end;
  }
  return pos;
}

/**
 * `at` 자리에 표시를 넣는다. 앞뒤로 빈 줄을 보장해 표시가 제 문단이 되게 하고,
 * 새 커서 자리(표시 뒤)를 함께 돌려준다. `at` 이 다른 표시 한가운데면 그 표시 뒤로 민다.
 */
export function insertQuoteMarkers(
  md: string,
  at: number,
  quoteIds: number[],
): { text: string; cursor: number } {
  if (quoteIds.length === 0) return { text: md, cursor: at };
  const pos = safeInsertPos(md, at);
  const before = md.slice(0, pos);
  const after = md.slice(pos);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const block = quoteIds.map(quoteMarker).join('\n\n');
  const text = `${before}${lead}${block}${trail}${after}`;
  return { text, cursor: before.length + lead.length + block.length };
}
