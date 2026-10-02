import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MemoScrap } from '@/components/collage';
import { PostMarkdown } from '@/components/post/PostMarkdown';
import { splitQuoteBlocks } from '@/components/post/postQuotes';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 독후감 본문 — 글 사이에 옮겨 적은 문장 조각이 끼어든다.
 *
 * 조각(`>` 묶음)은 마크다운 파서에 태우지 않고 그 앞에서 쪼갠다(postQuotes 참고). 글은 PostMarkdown 이,
 * 조각은 점선 메모(MemoScrap)가 그린다 — 번갈아 살짝 기울여 붙인 티를 낸다.
 * 옛 글의 밑줄 표시는 부르는 쪽이 `postBodyOf` 로 미리 조각 글로 바꿔 넘긴다.
 */
export function PostBody({ md }: { md: string }) {
  const segments = useMemo(() => splitQuoteBlocks(md), [md]);
  let scrapIndex = 0;
  return (
    <View style={styles.root}>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') {
          return <PostMarkdown key={`t${i}`} md={segment.text} />;
        }
        const rotate = scrapIndex++ % 2 === 0 ? -1 : 1;
        return <QuoteBlock key={`q${i}`} text={segment.text} source={segment.source} rotate={rotate} />;
      })}
    </View>
  );
}

/** 문장 조각 하나 — 점선 메모 안 명조 문장 + 왼쪽 악센트 선 + 모노 출처 한 줄. */
function QuoteBlock({ text, source, rotate }: { text: string; source?: string; rotate: number }) {
  const { colors } = useTheme();
  return (
    <MemoScrap rotate={rotate}>
      <Text selectable style={[styles.text, { color: colors.text, borderLeftColor: colors.accent }]}>
        {text}
      </Text>
      {source ? (
        <Text numberOfLines={2} style={[typeScale.monoLabel, styles.source, { color: colors.textMuted }]}>
          {source}
        </Text>
      ) : null}
    </MemoScrap>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  // 인용 본문 — quote 토큰을 14/1.7 로 줄이고 왼쪽에 악센트 선을 세운다.
  text: { ...typeScale.quote, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 11 },
  // 출처 줄 — 9px 모노, 위 여백 sm.
  source: { fontSize: 9, letterSpacing: 0.4, marginTop: spacing.sm },
});
