import type { BookQuote, Post } from '@/api/types';

/**
 * 독후감 본문 안의 문장 조각.
 *
 * 문장은 쓰는 사람이 독후감 안에서 바로 옮겨 적는다 — 밑줄(BookQuote)과 엮이지 않고 본문 마크다운에 글로 남는다.
 * 줄머리가 `>` 인 줄이 이어진 묶음 하나가 조각 하나이고, 그 끝줄이 줄표(`— `)로 시작하면 출처 한 줄(쪽수 등)이다.
 *
 *   > 마음에 걸린 문장
 *   > — 12쪽
 *
 * 옛 글은 밑줄을 `〖오려둔 문장 123〗` 표시로 가리켰고, 서버가 그 밑줄을 `post.quotes` 로 함께 내려준다.
 * `inlineLegacyQuotes` 가 그 표시를 같은 꼴의 조각 글로 바꾼다 — 상세는 바꾼 글을 그리고, 고치기는 바꾼 글로
 * 시작해 저장하면 밑줄 연결이 풀리고 글만 남는다.
 */

export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'quote'; text: string; source?: string };

/**
 * 조각 줄 — 줄 맨 앞의 `>` 만. 들여 쓴 `>`(목록 항목 안의 인용 등)는 조각으로 떼어 내지 않고 마크다운에 맡긴다 —
 * 떼어 내면 그 목록이 조각 앞뒤로 두 동강 난다. 넣기는 늘 맨 앞에 쓴다.
 */
const QUOTE_LINE = /^>/;
/** 조각 줄에서 벗겨 낼 머리 — `>` 와 뒤따르는 빈칸 하나. */
const QUOTE_PREFIX = /^> ?/;
/** 출처 줄 — 줄표(—·–·―) 뒤에 빈칸, 그리고 내용. 넣을 때는 늘 `— ` 로 쓴다. */
const SOURCE_LINE = /^[—–―]\s+(\S.*)$/;
/** 코드 펜스 — 펜스 안의 `>` 는 조각이 아니다. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
/** 옛 표시 — 쓸 때마다 lastIndex 가 남지 않게 매번 새로 만든다. */
const LEGACY_MARKER = () => /〖오려둔 문장 (\d+)〗/g;

/** 쪽수 출처 — 없으면 출처 줄을 두지 않는다. */
export function pageSource(page?: number | null): string | undefined {
  return page != null ? `${page}쪽` : undefined;
}

/**
 * 조각 하나를 본문에 넣을 글로 — 줄마다 `> ` 를 달고, 출처가 있으면 끝줄에 `> — 출처`.
 * 줄 앞뒤 빈칸은 버린다(앞 빈칸 넷이면 조각 안에서 코드 블록이 된다). 문장 사이 빈 줄은 `>` 한 줄로 남겨
 * 조각이 끊기지 않게 한다.
 */
export function quoteBlock(text: string, source?: string | null): string {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n')
    .map((line) => line.trim())
    .map((line) => (line ? `> ${line}` : '>'));
  const tail = source?.trim();
  if (tail) lines.push(`> — ${tail}`);
  return lines.join('\n');
}

/**
 * 조각 한가운데는 가를 수 없다 — 커서가 조각 줄 위에 있으면 그 조각이 끝나는 줄 끝으로 민다.
 * 조각 첫 줄 맨 앞이면 그 앞에 넣는 것이라 그대로 둔다.
 */
function safeInsertPos(md: string, at: number): number {
  const pos = Math.max(0, Math.min(at, md.length));
  const lines = md.split('\n');
  let row = 0;
  let offset = 0;
  while (row < lines.length - 1 && offset + lines[row].length < pos) {
    offset += lines[row].length + 1;
    row++;
  }
  const isQuote = (i: number) => i >= 0 && i < lines.length && QUOTE_LINE.test(lines[i]);
  if (!isQuote(row) || (pos === offset && !isQuote(row - 1))) return pos;
  let end = offset + lines[row].length;
  while (isQuote(row + 1)) {
    row++;
    end += 1 + lines[row].length;
  }
  return end;
}

/**
 * `at` 자리에 조각 글을 넣는다. 앞뒤로 빈 줄을 보장해 조각이 제 문단이 되게 하고, 새 커서 자리를 함께 돌려준다.
 * 커서는 조각 뒤 빈 줄 다음이다 — 넣고 바로 이어 쓰는 글이 조각 끝줄(출처)에 붙어 조각의 일부가 되지 않게.
 */
export function insertBlock(md: string, at: number, block: string): { text: string; cursor: number } {
  const pos = safeInsertPos(md, at);
  const before = md.slice(0, pos);
  const after = md.slice(pos);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  return {
    text: `${before}${lead}${block}${trail}${after}`,
    cursor: before.length + lead.length + block.length + 2,
  };
}

/** `>` 를 벗긴 조각 줄들 → 조각. 끝줄이 출처 꼴이면 떼어 낸다(출처만 있는 조각은 그 줄이 곧 문장이다). */
function toQuote(lines: string[]): BodySegment | null {
  const inner = [...lines];
  const trimEdges = () => {
    while (inner.length > 0 && !inner[0].trim()) inner.shift();
    while (inner.length > 0 && !inner[inner.length - 1].trim()) inner.pop();
  };
  trimEdges();
  if (inner.length === 0) return null;
  const source = inner.length > 1 ? SOURCE_LINE.exec(inner[inner.length - 1].trim())?.[1].trim() : undefined;
  if (source) {
    inner.pop();
    trimEdges();
  }
  return { kind: 'quote', text: inner.join('\n'), source };
}

/**
 * 본문을 글 조각과 문장 조각으로 쪼갠다. 빈 글 조각과 빈 문장 조각은 버린다.
 *
 * 마크다운 파서에 태우기 전에 쪼갠다 — 문장은 책에서 옮겨 적은 글자 그대로 보여야 해서(`*`·`1.` 같은 글자가
 * 강조·목록으로 바뀌면 안 된다) 조각 안은 마크다운으로 읽지 않는다. 코드 펜스 안의 `>` 는 조각이 아니다.
 * 마크다운의 '게으른 이어짐'(`>` 없이 이어지는 줄)은 조각에 넣지 않는다 — 그 줄부터는 다시 글이다.
 */
export function splitQuoteBlocks(md: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let text: string[] = [];
  let quote: string[] | null = null;
  let fence: string | null = null;
  const flushText = () => {
    const joined = text.join('\n');
    if (joined.trim()) segments.push({ kind: 'text', text: joined });
    text = [];
  };
  const flushQuote = () => {
    const segment = quote ? toQuote(quote) : null;
    if (segment) segments.push(segment);
    quote = null;
  };
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (fence) {
      text.push(line);
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }
    if (QUOTE_LINE.test(line)) {
      if (!quote) {
        flushText();
        quote = [];
      }
      quote.push(line.replace(QUOTE_PREFIX, ''));
      continue;
    }
    flushQuote();
    fence = FENCE_OPEN.exec(line)?.[1] ?? null;
    text.push(line);
  }
  flushQuote();
  flushText();
  return segments;
}

/**
 * 옛 밑줄 하나 → 조각 글. 출처는 옛 조각의 메타 줄과 같다(남의 밑줄이면 작성자 · 책 제목 · 쪽수).
 * 작성자는 글쓴이와 견준다 — 보는 사람 기준(`mine`)이면 남이 볼 때 글쓴이 이름이 붙는다.
 */
function legacyBlock(quote: BookQuote, authorId: number): string {
  const source = [
    quote.authorId !== authorId ? `${quote.authorNickname}님` : null,
    quote.bookTitle || null,
    pageSource(quote.page) ?? null,
  ].filter(Boolean).join(' · ');
  return quoteBlock(quote.content, source);
}

/**
 * 옛 글의 밑줄을 조각 글로 바꿔 넣는다 — 표시 자리에는 그 밑줄을, 표시 없이 엮여만 있던 밑줄은 글 끝에 차례로.
 * 표시가 가리키는 밑줄이 없으면(지워진 밑줄) 표시만 지운다 — 예전에도 그 자리는 비어 보였다.
 * 끝에 옮긴 수(`moved`)를 함께 돌려줘 고치기 화면이 한 줄로 알린다. 새 방식 글은 그대로 지나간다.
 */
export function inlineLegacyQuotes(
  md: string,
  quotes: readonly BookQuote[],
  authorId: number,
): { text: string; moved: number } {
  if (quotes.length === 0 && !LEGACY_MARKER().test(md)) return { text: md, moved: 0 };
  const byId = new Map(quotes.map((quote) => [quote.id, quote] as const));
  const placed = new Set<number>();
  const out: string[] = [];
  // 조각 바로 다음 줄이 글이면 빈 줄 하나로 뗀다.
  let gap = false;
  // 표시만 있던 줄을 지웠다면 뒤따르는 빈 줄 하나를 함께 걷는다 — 빈 줄이 겹쳐 남지 않게.
  let dropBlank = false;
  const push = (line: string) => {
    const blank = line.trim() === '';
    if (dropBlank && blank) {
      dropBlank = false;
      return;
    }
    dropBlank = false;
    if (gap && !blank) out.push('');
    gap = false;
    out.push(line);
  };
  const pushQuote = (quote: BookQuote) => {
    placed.add(quote.id);
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
    out.push(...legacyBlock(quote, authorId).split('\n'));
    gap = true;
    dropBlank = false;
  };

  for (const line of md.split('\n')) {
    const matches = [...line.matchAll(LEGACY_MARKER())];
    if (matches.length === 0) {
      push(line);
      continue;
    }
    let last = 0;
    let wrote = false;
    for (const match of matches) {
      const start = match.index ?? 0;
      const head = line.slice(last, start).trim();
      if (head) {
        push(head);
        wrote = true;
      }
      const quote = byId.get(Number(match[1]));
      if (quote) {
        pushQuote(quote);
        wrote = true;
      }
      last = start + match[0].length;
    }
    const tail = line.slice(last).trim();
    if (tail) {
      push(tail);
      wrote = true;
    }
    if (!wrote) dropBlank = out.length === 0 || out[out.length - 1].trim() === '';
  }

  const leftovers = quotes.filter((quote) => !placed.has(quote.id));
  for (const quote of leftovers) pushQuote(quote);
  return { text: out.join('\n'), moved: leftovers.length };
}

/** 상세·고치기가 쓰는 본문 — 옛 밑줄은 조각 글로 바꿔 둔다(`inlineLegacyQuotes`). */
export function postBodyOf(post: Pick<Post, 'bodyMd' | 'quotes' | 'authorId'>): { text: string; moved: number } {
  return inlineLegacyQuotes(post.bodyMd, post.quotes, post.authorId);
}
