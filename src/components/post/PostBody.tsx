import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import type { BookQuote } from '@/api/types';
import { PostMarkdown } from '@/components/post/PostMarkdown';
import { parseQuoteIds, splitByQuoteMarkers } from '@/components/post/quoteMarkers';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { spacing } from '@/theme';

/** 표시가 가리키는 밑줄 중 실제로 그릴 수 있는 것 — 지워졌거나 화면이 실체를 모르는 밑줄이면 빠진다. */
export function usedQuoteIds(md: string, quotes: BookQuote[]): Set<number> {
  const have = new Set(quotes.map((quote) => quote.id));
  return new Set(parseQuoteIds(md).filter((id) => have.has(id)));
}

/**
 * 독후감 본문 — 글 사이에 오려둔 문장이 끼어든다.
 *
 * 표시를 마크다운 파서에 태우지 않고 그 앞에서 쪼갠다. 라이브러리의 토큰 규칙에 얽히지 않고,
 * 표시가 가리키는 밑줄이 없으면 그 자리를 그냥 비울 수 있다.
 */
export function PostBody({ md, quotes, onPressQuote }: {
  md: string;
  quotes: BookQuote[];
  onPressQuote?: (quoteId: number) => void;
}) {
  const byId = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote] as const)), [quotes]);
  const segments = useMemo(() => splitByQuoteMarkers(md), [md]);
  let scrapIndex = 0;
  return (
    <View style={styles.root}>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') {
          return <PostMarkdown key={`t${i}`} md={segment.text} />;
        }
        const quote = byId.get(segment.quoteId);
        if (!quote) return null;
        const rotate = scrapIndex++ % 2 === 0 ? -1 : 1;
        return (
          <QuoteScrap
            key={`q${i}`}
            quote={quote}
            rotate={rotate}
            // 남의 문장도 인용할 수 있어 글쓴이 것이 아니면 누가 오려뒀는지 밝힌다.
            showAuthor
            onPress={onPressQuote ? () => onPressQuote(quote.id) : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
});
