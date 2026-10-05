import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { libraryApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { FinishCardFace, RemarkCardQuote } from '@/components/remark/FinishCardFace';
import { useMyRemark } from '@/components/remark/queries';
import { EmptyState, FootAction, formatRelative, linkLabel } from '@/components/ui';
import { layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받는 장 수 — 카드마다 한 줄평을 따로 받으므로 한 쪽을 작게 잡아 처음 요청이 몰리지 않게. */
const PAGE_SIZE = 20;
/** ['library'] 아래라 완독·한 줄평이 바뀌어 서재를 다시 받을 때 함께 새로 받는다. */
const FINISH_CARDS_KEY = ['library', 'FINISHED', 'cards'] as const;

/**
 * 내 완독 카드 — '나' 화면의 '완독 카드' 줄로 들어온다. 다 읽은 회차마다 한 장씩, 최근에 읽은 순으로 모은다.
 *
 * 카드는 완독할 때 본 것, 도서 상세 '내 진도'에 있는 것과 같은 얼굴(FinishCardFace)이다. 한 줄평은 카드마다
 * 따로 받는다 — 서버에 '내 한 줄평 목록'이 없어서다. 목록이 화면에 그리는 카드만 받으니 처음 요청은 한 쪽 남짓이다.
 * 카드를 누르면 그 회차의 도서 상세로 간다 — 한 줄평 고치기는 거기 '내 진도' 카드에서 한다.
 */
export default function FinishCardsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const cards = useInfiniteQuery({
    queryKey: FINISH_CARDS_KEY,
    queryFn: ({ pageParam }) => libraryApi.list('FINISHED', pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 쪽 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(() => cards.data?.pages.flatMap((page) => page.content) ?? [], [cards.data]);

  return (
    <PaperScreen>
      <SubHeader category="완독 카드" />

      <FlatList
        data={items}
        keyExtractor={(record) => String(record.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl }]}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cards.hasNextPage && !cards.isFetchingNextPage) cards.fetchNextPage();
        }}
        refreshing={cards.isRefetching && !cards.isFetchingNextPage}
        // 한 줄평도 함께 새로 받는다 — 둘 다 ['library'] 아래에 있다.
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['library'] })}
        renderItem={({ item }) => <FinishCardItem record={item} />}
        ListEmptyComponent={
          cards.isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : cards.isError ? (
            <EmptyState
              title="완독 카드를 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
              action={(
                <Pressable
                  onPress={() => cards.refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="다시 시도"
                  style={({ pressed }) => [styles.retry, pressed && pressedStyle]}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
                </Pressable>
              )}
            />
          ) : (
            <EmptyState title="아직 완독 카드가 없어요" description="책을 다 읽으면 여기에 완독 카드가 모여요." />
          )
        }
        ListFooterComponent={
          cards.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : cards.isError && items.length > 0 ? (
            // 다음 쪽을 못 받아도 이미 깔아 둔 카드는 그대로 둔다 — 발치에 다시 시도만 놓는다.
            <View style={styles.footer}>
              <FootAction
                label="더 불러오지 못했어요 · 다시 시도"
                onPress={() => (cards.hasNextPage ? cards.fetchNextPage() : cards.refetch())}
                tone="accent"
                accessibilityLabel="완독 카드 더 불러오기"
              />
            </View>
          ) : null
        }
      />
    </PaperScreen>
  );
}

/** 카드 한 장 — 통째로 눌러 그 회차의 도서 상세로 간다. 한 줄평은 받는 동안 한 줄 자리만 비워 둔다. */
function FinishCardItem({ record }: { record: ReadingRecord }) {
  const router = useRouter();
  const remark = useMyRemark(record.id);
  const book = record.book;
  const title = book?.title ?? '';

  return (
    <Pressable
      onPress={() => {
        if (book?.id != null) router.push(`/book/${book.id}?recordId=${record.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title} 완독 카드 · 도서 상세로`}
      style={({ pressed }) => [styles.item, pressed && pressedStyle]}
    >
      <FinishCardFace
        title={title}
        coverUrl={book?.coverUrl}
        when={record.finishedAt ? formatRelative(record.finishedAt) : ''}
      >
        {remark.isSuccess ? <RemarkCardQuote body={remark.data?.body} /> : <View style={styles.quoteSlot} />}
      </FinishCardFace>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingTop: spacing.md, gap: spacing.lg },
  item: { marginHorizontal: spacing.lg },
  // 한 줄평 한 줄(줄높이 24) 자리 — 받아 오면 글이 이 자리에 들어앉아 카드가 덜 들썩인다.
  quoteSlot: { height: 24 },
  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 132, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 44pt 상자를 만든다.
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
