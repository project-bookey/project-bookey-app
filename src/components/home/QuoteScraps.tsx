import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { plazaApi } from '@/api/endpoints';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 홈에 걸어 두는 밑줄 수 — 서가를 다 내려온 사람에게 광장을 살짝 보여 주는 정도. */
const TOP_N = 3;

/**
 * 홈 마지막 섹션 '오려둔 문장' — 광장 밑줄 피드 상위 3건 (시안 2a).
 *
 * 광장 화면의 무한 쿼리와 캐시를 나눠 쓴다(['plaza','QUOTE'] vs 여기 ['plaza','QUOTE','top3']).
 * 서로 다른 항목을 담지만 같은 문장이 겹칠 수 있어, '나도 그럼' 낙관 업데이트는
 * 광장 화면에서 두 캐시를 함께 손본다.
 *
 * 0건이면 섹션을 통째로 감춘다 — 홈 마지막에 빈 상자를 남기지 않는다.
 *
 * 광장으로 가는 이동은 push 가 아니라 navigate 다 — 구역(서가·탐색·광장·나) 사이는
 * push 하면 오갈 때마다 스택에 같은 구역이 쌓인다.
 */
export function QuoteScraps() {
  const router = useRouter();
  const { colors } = useTheme();

  const quotes = useQuery({
    queryKey: ['plaza', 'QUOTE', 'top3'],
    queryFn: () => plazaApi.feed('QUOTE', 0, TOP_N),
  });

  const items = quotes.data?.content ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>오려둔 문장</Text>
        <Pressable
          onPress={() => router.navigate('/plaza')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="광장으로"
        >
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>광장 →</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {items.map((item, index) => (
          <Pressable
            key={item.quoteId ?? `${item.authorId}-${item.occurredAt}`}
            onPress={() => router.navigate('/plaza')}
            accessibilityRole="button"
            accessibilityLabel={`${item.authorNickname}가 오려둔 ${item.bookTitle}의 문장`}
          >
            <MemoScrap rotate={index % 2 === 0 ? -1.2 : 1}>
              <Text numberOfLines={3} style={[styles.quote, { color: colors.text }]}>
                {item.content}
              </Text>
              <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
                {item.authorNickname} · {item.bookTitle}
              </Text>
            </MemoScrap>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  title: { fontSize: 18, lineHeight: 26 },
  // 기울어진 조각끼리 모서리가 겹치지 않게 세로 간격을 넉넉히 준다.
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  quote: { fontFamily: serif.regular, fontSize: 13, lineHeight: 21 },
  meta: { fontSize: 9, letterSpacing: 0.4, marginTop: spacing.sm },
});
