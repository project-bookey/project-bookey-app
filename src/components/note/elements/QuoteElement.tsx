import { Text, View } from 'react-native';

import { radius, serif, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';
import type { QuoteElement as QuoteEl } from '../noteDoc';

/** 문장 조각 논리 치수 — 330px 격자 페이지에서 본문 약 12px, 메타 약 7px. */
const Q = { pad: 28, bar: 4, barGap: 22, text: 36, meta: 22, metaGap: 18 };

/** 메타 한 줄 — 쪽·책 제목·저자 중 있는 것만 ' · ' 로 잇는다. 하나도 없으면 null. */
export function quoteMetaOf(element: Pick<QuoteEl, 'page' | 'bookTitle' | 'author'>): string | null {
  const parts = [
    element.page != null ? `${element.page}쪽` : null,
    element.bookTitle ?? null,
    element.author ?? null,
  ].filter((v): v is string => !!v && v.length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * 문장 조각 — 독후감 본문의 문장 조각(PostBody)과 같은 말씨: 종이 조각 위 명조 문장, 왼쪽 악센트 선, 모노 메타 한 줄.
 * 기울기는 요소의 rot 이 맡으므로 조각 자체는 똑바로 그린다. 폭만 저장하고 높이는 문장 길이가 정한다.
 */
export function QuoteElement({ element, scale }: { element: QuoteEl; scale: number }) {
  const { colors } = useTheme();
  const fontSize = Q.text * scale;
  const metaSize = Q.meta * scale;
  const meta = quoteMetaOf(element);
  return (
    <View
      style={{
        width: element.w * scale,
        padding: Q.pad * scale,
        backgroundColor: colors.surfaceDeep,
        borderWidth: hairline,
        borderColor: colors.lineStrong,
        borderRadius: radius.sm,
      }}
    >
      <Text
        style={{
          fontFamily: serif.regular,
          fontSize,
          lineHeight: fontSize * 1.65,
          color: colors.text,
          borderLeftWidth: Math.max(Q.bar * scale, 1),
          borderLeftColor: colors.accent,
          paddingLeft: Q.barGap * scale,
        }}
      >
        {element.text.length > 0 ? element.text : ' '}
      </Text>
      {meta ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: mono.medium,
            fontSize: metaSize,
            letterSpacing: Math.min(0.4, metaSize * 0.04),
            color: colors.textMuted,
            marginTop: Q.metaGap * scale,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
