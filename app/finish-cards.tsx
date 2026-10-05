import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { libraryApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardRevealProvider } from '@/components/keyboard';
import { FinishCardFace } from '@/components/remark/FinishCardFace';
import { MyFinishCard } from '@/components/remark/MyFinishCard';
import { useMyRemark } from '@/components/remark/queries';
import { Button, EmptyState, FootAction, formatRelative } from '@/components/ui';
import { layout, radius, spacing, useTheme } from '@/theme';

/** 한 번에 받는 장 수 — 카드마다 한 줄평을 따로 받으므로 한 쪽을 작게 잡아 처음 요청이 몰리지 않게. */
const PAGE_SIZE = 20;
/** ['library'] 아래라 완독·한 줄평이 바뀌어 서재를 다시 받을 때 함께 새로 받는다. */
const FINISH_CARDS_KEY = ['library', 'FINISHED', 'cards'] as const;

/**
 * 내 완독 카드 — '나' 화면의 '완독 카드' 줄로 들어온다. 다 읽은 회차마다 한 장씩, 최근에 읽은 순으로 모은다.
 *
 * 카드는 도서 상세 '내 진도'의 것과 같은 MyFinishCard 다 — 한 줄평을 여기서도 카드 안에서 바로 남기고 고친다
 * (사용자 결정 2026-10-05). 한 번에 한 장만 열어 둔다 — 다른 카드의 '고치기'를 누르면 열려 있던 카드는 닫힌다.
 * 카드 본문·표지를 누르면 그 회차의 도서 상세로 간다(고치는 동안은 빼고). 고치기·삭제는 메모 안 오른쪽 아래다.
 * 한 줄평은 카드마다 따로 받는다 — 서버에 '내 한 줄평 목록'이 없어서다. 목록이 그리는 카드만 받으니 처음 요청은 한 쪽 남짓이다.
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
  /** 한 줄평을 적고 있는 카드(회차 id) — 한 번에 한 장. */
  const [editingId, setEditingId] = useState<number | null>(null);

  // 카드 안 입력칸을 누르면 그 밑 버튼 줄까지 키보드 위로 올린다. FlatList 의 getScrollResponder() 는 실제로는
  // 안쪽 ScrollView 를 돌려준다(타입 선언만 어긋나 있다) — 엽서 목록과 같다.
  const listRef = useRef<FlatList<ReadingRecord>>(null);
  const getScroll = useCallback(() => listRef.current?.getScrollResponder() as unknown as ScrollView | null, []);

  return (
    <PaperScreen>
      <SubHeader category="완독 카드" />

      <KeyboardArea>
        <KeyboardRevealProvider getScroll={getScroll}>
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(record) => String(record.id)}
            // 어느 카드가 열렸는지가 바뀌면 카드를 다시 그린다 — data 만 보면 FlatList 는 다시 그리지 않는다.
            extraData={editingId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl }]}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (cards.hasNextPage && !cards.isFetchingNextPage) cards.fetchNextPage();
            }}
            refreshing={cards.isRefetching && !cards.isFetchingNextPage}
            // 한 줄평도 함께 새로 받는다 — 둘 다 ['library'] 아래에 있다.
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['library'] })}
            renderItem={({ item }) => (
              <FinishCardItem
                record={item}
                editing={editingId === item.id}
                // 닫힘은 이 카드가 열려 있을 때만 받는다 — 다른 카드를 연 직후 닫히는 카드가 그 카드까지 닫지 않게.
                onEditingChange={(editing) => setEditingId((current) => (editing ? item.id : current === item.id ? null : current))}
              />
            )}
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
                  action={<Button label="다시 시도" variant="outline" onPress={() => cards.refetch()} />}
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
        </KeyboardRevealProvider>
      </KeyboardArea>
    </PaperScreen>
  );
}

/** 카드 한 장. 한 줄평을 받는 동안은 얼굴만 그리고 한 줄 자리를 비워 둔다 — 받은 뒤에 버튼 줄이 붙는다. */
function FinishCardItem({ record, editing, onEditingChange }: {
  record: ReadingRecord;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const router = useRouter();
  const remark = useMyRemark(record.id);
  const book = record.book;
  const title = book?.title ?? '';

  return (
    <View style={styles.item}>
      {remark.isSuccess && book?.id != null ? (
        <MyFinishCard
          rid={record.id}
          bookId={book.id}
          title={title}
          coverUrl={book.coverUrl}
          finishedAt={record.finishedAt}
          remark={remark.data ?? null}
          onOpen={() => router.push(`/book/${book.id}?recordId=${record.id}`)}
          editing={editing}
          onEditingChange={onEditingChange}
        />
      ) : (
        <FinishCardFace title={title} coverUrl={book?.coverUrl} when={record.finishedAt ? formatRelative(record.finishedAt) : ''}>
          <View style={styles.quoteSlot} />
        </FinishCardFace>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 카드 사이 — 고치기·삭제가 메모 안으로 들어가 카드 하나가 한 덩어리라, 시안 C 대로 20 이면 충분히 나뉜다.
  list: { ...layout.content, paddingTop: spacing.md, gap: spacing.lg + spacing.xs },
  item: { marginHorizontal: spacing.lg },
  // 한 줄평 한 줄(줄높이 24) 자리 — 받아 오면 글이 이 자리에 들어앉아 카드가 덜 들썩인다.
  quoteSlot: { height: 24 },
  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 132, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
