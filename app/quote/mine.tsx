import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { quoteApi } from '@/api/endpoints';
import { myQuotesKey } from '@/api/quoteCache';
import type { BookQuote } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { Button, EmptyState, FootAction } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 한 번에 받아오는 건수 — 독후감의 밑줄 고르기 시트와 같은 키(myQuotesKey)를 쓰므로 쪽 크기도 맞춘다.
 * 한 캐시에 크기가 다른 쪽이 섞이면 '더 보기'가 그 사이 문장을 건너뛴다.
 */
const PAGE_SIZE = 20;

/**
 * 내가 오려둔 문장 — 프로필 '내가 오려둔 문장' 링크로 들어온다.
 *
 * 도서 상세 밑줄 탭과 같은 점선 메모 조각(QuoteScrap)을 최신순으로 늘어놓는다.
 * 여러 책의 문장이 섞이므로 조각 메타에 책 제목을 켠다. 조각을 누르면 밑줄 상세로 가고,
 * 좋아요·댓글·삭제는 상세의 몫이라 여기엔 두지 않는다 — 이 목록에서 궁금한 것은 '내가 뭘 오려뒀나'다.
 */
export default function MyQuotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const mine = useInfiniteQuery({
    queryKey: myQuotesKey(),
    queryFn: ({ pageParam }) => quoteApi.mine(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  // 페이지 사이에 새 문장이 끼면 같은 문장이 두 페이지에 걸쳐 오므로 id 로 한 번 거른다.
  const items = useMemo(() => {
    const seen = new Set<number>();
    const list: BookQuote[] = [];
    for (const quote of mine.data?.pages.flatMap((p) => p.content ?? []) ?? []) {
      if (seen.has(quote.id)) continue;
      seen.add(quote.id);
      list.push(quote);
    }
    return list;
  }, [mine.data]);

  const total = mine.data?.pages[0]?.totalElements;

  return (
    <PaperScreen>
      <SubHeader category={total != null ? `내가 오려둔 문장 ${total}` : '내가 오려둔 문장'} />

      <FlatList
        data={items}
        keyExtractor={(quote) => String(quote.id)}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (mine.hasNextPage && !mine.isFetchingNextPage) mine.fetchNextPage();
        }}
        refreshing={mine.isRefetching && !mine.isFetchingNextPage}
        onRefresh={() => mine.refetch()}
        renderItem={({ item, index }) => (
          <View style={styles.scrapWrap}>
            <QuoteScrap
              quote={item}
              rotate={index % 2 === 0 ? -1 : 1}
              onPress={() => router.push(`/quote/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          mine.isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : mine.isError ? (
            <EmptyState
              title="오려둔 문장을 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
              action={(
                <Pressable
                  onPress={() => mine.refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="다시 시도"
                  style={styles.retry}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
                </Pressable>
              )}
            />
          ) : (
            <EmptyState
              title="아직 오려둔 문장이 없어요"
              description="읽다가 걸린 문장을 광장이나 책 상세에서 오려두세요."
              action={<Button label="광장으로 가기" onPress={() => router.navigate('/plaza')} />}
            />
          )
        }
        ListFooterComponent={
          mine.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : mine.isError && items.length > 0 ? (
            // 다음 쪽을 못 받아도 이미 깔아 둔 조각은 그대로 둔다 — 발치에 다시 시도만 놓는다.
            <View style={styles.footer}>
              <FootAction
                label="더 불러오지 못했어요 · 다시 시도"
                onPress={() => (mine.hasNextPage ? mine.fetchNextPage() : mine.refetch())}
                tone="accent"
                accessibilityLabel="오려둔 문장 더 불러오기"
              />
            </View>
          ) : null
        }
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // SubHeader 바로 밑이라 첫 조각이 붙어 보인다 — 한 칸 띄운다.
  list: { ...layout.content, paddingTop: spacing.md, paddingBottom: 104, gap: spacing.md },
  scrapWrap: { marginHorizontal: spacing.lg },
  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  skeleton: { height: 120, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
