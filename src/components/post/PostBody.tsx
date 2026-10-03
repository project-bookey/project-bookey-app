import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MemoScrap } from '@/components/collage';
import { PostMarkdown } from '@/components/post/PostMarkdown';
import { PostPhoto, type PhotoSource } from '@/components/post/PostPhoto';
import type { PhotoRef } from '@/components/post/postPhotos';
import { splitBodyBlocks } from '@/components/post/postQuotes';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 독후감 본문 — 글 사이에 사진과 옮겨 적은 문장 조각이 쓴 자리 그대로 끼어든다.
 *
 * 조각(`>` 묶음)과 사진 줄은 마크다운 파서에 태우지 않고 그 앞에서 쪼갠다(postQuotes·postPhotos). 글은 PostMarkdown 이,
 * 사진은 본문 폭을 채운 PostPhoto 가, 조각은 괘선 한 겹의 반듯한 메모(MemoScrap ruled)가 그린다.
 * 사진 줄이 무엇을 가리키는지는 부르는 쪽이 `photoOf` 로 풀어 준다 — 상세는 글의 사진, 작성 미리보기는 올리는 중인 타일.
 * 풀리지 않는 사진 줄(지워진 사진)은 그리지 않는다. 옛 글의 밑줄 표시는 부르는 쪽이 `postBodyOf` 로 미리 조각 글로 바꿔 넘긴다.
 */
export function PostBody({ md, photoOf }: { md: string; photoOf?: (ref: PhotoRef) => PhotoSource | null }) {
  const segments = useMemo(() => splitBodyBlocks(md), [md]);
  let photoNumber = 0;
  return (
    <View style={styles.root}>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') {
          return <PostMarkdown key={`t${i}`} md={segment.text} />;
        }
        if (segment.kind === 'photo') {
          const source = photoOf?.(segment.ref);
          if (!source) return null;
          photoNumber += 1;
          return <PostPhoto key={`p${i}`} source={source} label={`사진 ${photoNumber}`} />;
        }
        return <QuoteBlock key={`q${i}`} text={segment.text} source={segment.source} />;
      })}
    </View>
  );
}

/** 문장 조각 하나 — 괘선 한 겹의 반듯한 메모 안 명조 문장 + 모노 출처 한 줄. 기울이지 않는다. */
function QuoteBlock({ text, source }: { text: string; source?: string }) {
  const { colors } = useTheme();
  return (
    <MemoScrap variant="ruled">
      <Text selectable style={[styles.text, { color: colors.text }]}>{text}</Text>
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
  // 인용 본문 — quote 토큰을 15/25 로 줄여 쓴다(문장 넣기 시트의 문장 칸과 같은 활자).
  text: { ...typeScale.quote, fontSize: 15, lineHeight: 25 },
  // 출처 줄 — 10px 모노(앱의 메타 줄 최소 크기), 위 여백 sm.
  source: { fontSize: 10, letterSpacing: 0.4, marginTop: spacing.sm },
});
