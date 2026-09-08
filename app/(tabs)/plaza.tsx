import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { plazaApi, quoteApi } from '@/api/endpoints';
import { invalidateQuoteLists, plazaFeedKey, quoteKey } from '@/api/quoteCache';
import type { PlazaItem, PlazaItemType } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import { BrandHeader, Chip, FocusRing, PaperScreen, TiltCover } from '@/components/collage';
import { PostFeed } from '@/components/post/PostFeed';
import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { Card, EmptyState, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 피드 건수 — 카드가 커서 한 화면에 서너 장만 들어온다. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
const CARD_TILT = [-1.1, 0.8];
/** 찍고 온 카드를 어디에 세울지 — 0 은 화면 맨 위, 1 은 맨 아래. 위 여백을 조금 남긴다. */
const FOCUS_VIEW_POSITION = 0.2;
/**
 * `scrollToIndex` 실패 후 재시도까지의 대기(ms).
 *
 * 아직 측정되지 않은 카드로 뛰면 FlatList 가 실패를 던진다. 근사 위치로 먼저 옮겨
 * 그 구간을 렌더·측정하게 한 뒤 다시 정확히 맞춘다.
 */
const SCROLL_RETRY_MS = 320;

/**
 * 광장 탭 — '밑줄'·'완독 자랑'은 광장 피드의 type 이고, '독후감'만 다른 API·다른 캐시다.
 * 그래서 탭 상태(tab)와 광장 피드 type 을 갈라 둔다.
 */
type PlazaTab = PlazaItemType | 'POST';

/**
 * 구역 3. 광장 — 다른 독자들이 오려 둔 문장과 독후감, 완독 자랑이 모이는 곳 (시안 2d).
 *
 * 필터 칩 '밑줄'·'완독 자랑'은 같은 피드의 type 이고 '독후감'은 별도 피드(PostFeed)다.
 * 모임은 상단 구역 탭으로 올라가 여기엔 없다.
 *
 * 밑줄 카드는 밑줄 상세(app/quote/[id].tsx)와 같은 QuoteCard 를 쓰고, 캐시 키·패치는
 * src/api/quoteCache.ts 한 곳에서 가져다 쓴다 — 같은 문장이 네 캐시에 살기 때문이다.
 *
 * `focusQuoteId` 를 달고 들어오면 그 문장 카드로 스크롤한 뒤 한 번만 강조한다 —
 * 아래 '찍고 온 문장' 블록 참고.
 */
export default function PlazaScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);

  const [tab, setTab] = useState<PlazaTab>('QUOTE');
  /** 독후감 탭에서는 광장 피드를 멈춰 두지만 키·파라미터는 마지막으로 보던 밑줄 쪽에 그대로 둔다. */
  const type: PlazaItemType = tab === 'POST' ? 'QUOTE' : tab;
  const [composing, setComposing] = useState(false);
  /** 삭제 재확인 — 확인 상태인 문장 id. 3초 타이머·언마운트 정리는 공용 훅이 맡는다(상세와 같은 규율). */
  const { confirm: confirmId, arm, disarm } = useDeleteConfirm<number>();
  const [removeError, setRemoveError] = useState<{ id: number; message: string } | null>(null);
  const listRef = useRef<FlatList<PlazaItem>>(null);
  /** 강조가 걸린 문장 — 페이드가 끝나면 스스로 지운다. 한 번에 한 장뿐이다. */
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const clearFocus = useCallback(() => setFocusedId(null), []);
  /** '좋아요' 낙관 토글 — 인플라이트 가드까지 공용 훅이 맡는다(상세와 같은 규율). */
  const pressAgree = useAgreeQuote();

  const feed = useInfiniteQuery({
    queryKey: plazaFeedKey(type),
    queryFn: ({ pageParam }) => plazaApi.feed(type, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 독후감 탭은 PostFeed 가 제 피드를 받는다 — 여기서 광장 피드를 또 부르지 않는다.
    enabled: tab !== 'POST',
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.content ?? []) ?? [],
    [feed.data],
  );

  /* ── 찍고 온 문장 ───────────────────────────────────────────────────────────
     focusQuoteId 를 달고 들어오면 그 카드로 스크롤하고 한 번 강조한다.
     첫 페이지는 feed('QUOTE', 0, 10) 과 같은 정렬의 10건이라 대개 그 안에 있다 —
     못 찾으면 그 사이 지워졌거나 더 뒤의 문장이므로 조용히 넘어간다.          */
  const { focusQuoteId } = useLocalSearchParams<{ focusQuoteId?: string }>();
  /**
   * 이미 처리한 focusQuoteId.
   *
   * setParams 로 비우는 게 다음 렌더에 반영되므로, 그 사이 effect 가 다시 돌아도
   * 두 번 스크롤하지 않게 막는다. 파라미터가 비면 가드도 함께 풀어 —
   * 같은 문장을 다시 찍고 들어왔을 때는 또 움직여야 한다.
   */
  const focusHandled = useRef<string | null>(null);

  useEffect(() => {
    const raw = typeof focusQuoteId === 'string' ? focusQuoteId.trim() : '';
    if (raw === '') {
      focusHandled.current = null;
      return;
    }
    if (focusHandled.current === raw) return;
    // 독후감·완독 자랑을 보던 중에 들어왔으면 밑줄로 되돌린다 — 전환 뒤 이 effect 가 다시 온다.
    if (tab !== 'QUOTE') {
      setTab('QUOTE');
      return;
    }
    // 첫 페이지가 아직이면 기다린다. 도착하면 feed.isSuccess 가 바뀌어 다시 온다.
    if (!feed.isSuccess) return;

    focusHandled.current = raw;
    // 파라미터는 1회용이다 — 뒤로 갔다 돌아와도 다시 튀지 않게 즉시 비운다.
    router.setParams({ focusQuoteId: '' });

    const target = Number(raw);
    if (!Number.isInteger(target)) return;
    const at = items.findIndex((it) => it.quoteId === target);
    if (at < 0) return;

    setFocusedId(target);
    listRef.current?.scrollToIndex({ index: at, viewPosition: FOCUS_VIEW_POSITION, animated: true });
  }, [focusQuoteId, tab, feed.isSuccess, items, router]);

  /** scrollToIndex 재시도 타이머 — 화면을 떠날 때 남겨 두지 않는다. */
  const scrollRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (scrollRetry.current) clearTimeout(scrollRetry.current);
  }, []);

  const remove = useMutation({
    mutationFn: (quoteId: number) => quoteApi.remove(quoteId),
    onMutate: () => setRemoveError(null),
    onSuccess: (_result, quoteId) => {
      invalidateQuoteLists(queryClient);
      // 상세 캐시가 남아 있으면 지운 문장이 잠깐 보일 수 있다.
      queryClient.removeQueries({ queryKey: quoteKey(quoteId) });
    },
    onError: (error, quoteId) => {
      setRemoveError({
        id: quoteId,
        message: error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도',
      });
    },
  });

  /** 삭제는 두 번 눌러야 나간다 — 첫 탭은 확인 라벨로 바뀌고 3초 뒤 저절로 접힌다. */
  const pressDelete = (quoteId: number) => {
    if (confirmId === quoteId) {
      disarm();
      remove.mutate(quoteId);
      return;
    }
    arm(quoteId);
  };

  const switchTab = (next: PlazaTab) => {
    if (next === tab) return;
    disarm();
    // 독후감·완독 자랑에는 오려두기가 없다 — 열려 있던 컴포저를 접는다.
    setComposing(false);
    setTab(next);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.chipRow}>
        <Chip label="밑줄" active={tab === 'QUOTE'} onPress={() => switchTab('QUOTE')} />
        <Chip label="독후감" active={tab === 'POST'} onPress={() => switchTab('POST')} />
        <Chip label="완독 자랑" active={tab === 'FINISH'} onPress={() => switchTab('FINISH')} />
        {/* 쓰기는 밑줄·독후감 탭에만 — 완독 자랑은 읽기 기록에서 자동으로 오른다. */}
        {tab === 'QUOTE' ? (
          <Pressable
            onPress={() => setComposing((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: composing }}
            accessibilityLabel={composing ? '문장 오려두기 닫기' : '문장 오려두기'}
            style={[styles.composePill, { borderColor: colors.accent }]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
              {composing ? '닫기' : '+ 밑줄'}
            </Text>
          </Pressable>
        ) : null}
        {/* 독후감은 길게 쓰는 글이라 접히는 패널이 아니라 제 화면으로 보낸다. */}
        {tab === 'POST' ? (
          <Pressable
            onPress={() => router.push('/post/new')}
            accessibilityRole="button"
            accessibilityLabel="독후감 쓰기"
            style={[styles.composePill, { borderColor: colors.accent }]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 독후감</Text>
          </Pressable>
        ) : null}
      </View>

      {composing ? <QuoteComposer onDone={() => setComposing(false)} /> : null}
    </View>
  );

  return (
    <PaperScreen withTopInset>
      <BrandHeader />
      {tab === 'POST' ? (
        <PostFeed ListHeaderComponent={header} />
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={itemKey}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          // 카드 높이가 제각각이라 getItemLayout 을 줄 수 없다 — 아직 측정 안 된 카드로 뛰면 실패한다.
          // 평균 높이로 근사 위치까지 먼저 옮겨 그 구간을 렌더시킨 뒤 다시 정확히 맞춘다.
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true });
            if (scrollRetry.current) clearTimeout(scrollRetry.current);
            scrollRetry.current = setTimeout(() => {
              scrollRetry.current = null;
              listRef.current?.scrollToIndex({
                index,
                viewPosition: FOCUS_VIEW_POSITION,
                animated: true,
              });
            }, SCROLL_RETRY_MS);
          }}
          renderItem={({ item, index }) => (
            <FeedCard
              item={item}
              index={index}
              mine={myId != null && item.authorId === myId}
              confirming={item.quoteId != null && confirmId === item.quoteId}
              focused={item.quoteId != null && focusedId === item.quoteId}
              onFocusDone={clearFocus}
              error={item.quoteId != null && removeError?.id === item.quoteId ? removeError.message : null}
              onAgree={() => {
                if (item.quoteId != null) pressAgree(item.quoteId);
              }}
              onDelete={() => {
                if (item.quoteId != null) pressDelete(item.quoteId);
              }}
              onOpen={() => {
                if (item.quoteId != null) router.push(`/quote/${item.quoteId}`);
              }}
              onOpenBook={() => router.push(`/book/${item.bookId}`)}
            />
          )}
          ListEmptyComponent={
            feed.isLoading ? (
              <View style={styles.skeletonList}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
                ))}
              </View>
            ) : feed.isError ? (
              <EmptyState title="광장을 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />
            ) : tab === 'QUOTE' ? (
              <EmptyState title="아직 밑줄이 없습니다" description="첫 문장을 오려 붙여보세요." />
            ) : (
              <EmptyState title="아직 완독 자랑이 없습니다" description="한 권을 끝내면 여기에 걸립니다." />
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
        />
      )}
    </PaperScreen>
  );
}

/** FINISH 항목에는 id 가 없다 — 사람·책·시각 조합으로 가른다. */
function itemKey(item: PlazaItem): string {
  return item.quoteId != null
    ? `q${item.quoteId}`
    : `f${item.authorId}-${item.bookId}-${item.occurredAt}`;
}

/** 피드 카드 한 장 — 밑줄은 공용 QuoteCard, 완독 자랑은 표지 행. 같은 교차 회전을 쓴다. */
function FeedCard({
  item, index, mine, confirming, focused, error, onAgree, onDelete, onOpen, onOpenBook, onFocusDone,
}: {
  item: PlazaItem;
  index: number;
  mine: boolean;
  confirming: boolean;
  /** 찍고 온 카드인지 — 강조 테두리가 한 번 지나간다. */
  focused?: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  onAgree: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onOpenBook: () => void;
  /** 강조가 다 지워졌다 — 부모가 focusedId 를 푼다. */
  onFocusDone: () => void;
}) {
  const { colors } = useTheme();
  const tilt = CARD_TILT[index % CARD_TILT.length];

  if (item.type === 'QUOTE') {
    // 기울기를 QuoteCard 가 아니라 이 감싸개에 준다 — 강조 링이 카드와 같은 각도로 겹쳐야 한다.
    return (
      <View style={[styles.cardWrap, { transform: [{ rotate: `${tilt}deg` }] }]}>
        {focused ? <FocusRing onDone={onFocusDone} /> : null}
        <QuoteCard
          authorNickname={item.authorNickname}
          authorAvatarUrl={item.authorAvatarUrl}
          bookTitle={item.bookTitle}
          page={item.page}
          content={item.content ?? ''}
          agreeCount={item.agreeCount ?? 0}
          agreedByMe={item.agreedByMe ?? false}
          commentCount={item.commentCount ?? 0}
          authorFinished={item.authorFinished ?? false}
          mine={mine}
          confirming={confirming}
          error={error}
          onAgree={onAgree}
          onDelete={mine ? onDelete : undefined}
          onOpen={onOpen}
        />
      </View>
    );
  }

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        <QuoteAvatar uri={item.authorAvatarUrl} nickname={item.authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {item.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {item.bookTitle}
          </Text>
        </View>
      </View>
      <Pressable onPress={onOpenBook} accessibilityRole="button" accessibilityLabel={`${item.bookTitle} 상세`} style={styles.finishRow}>
        <TiltCover uri={item.bookCoverUrl} title={item.bookTitle} width={44} entering={false} />
        <View style={styles.finishText}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: colors.text }]}>
            {item.bookTitle}
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
            완독 · {formatRelative(item.occurredAt)}
          </Text>
        </View>
      </Pressable>
    </Card>
  );
}

/**
 * 문장 오려두기 패널 — 모달 대신 칩 행 아래로 펼쳐지는 카드(도서 상세 밑줄 탭과 같은 방식).
 * 책 고르기는 독후감 작성과 같은 BookPicker, 문장·쪽수 칸과 그 검증은 도서 상세와 같은 QuoteDraftFields 가 맡고,
 * 여기는 둘을 한 카드에 놓고 오려두기 호출만 한다.
 */
function QuoteComposer({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  // 읽는 중인 책 빠른 선택 + 검색 — 고른 책(기본값 포함)은 picker.selected 로 온다.
  const picker = useBookPicker();
  const { selected } = picker;

  // 문장·쪽수 칸과 그 검증은 도서 상세 밑줄 탭과 같은 것을 쓴다.
  const draft = useQuoteDraft();
  // 광장은 책을 골라야 오릴 수 있다 — 공용 검증에 그 조건만 덧붙인다.
  const canSubmit = selected != null && draft.canSubmit;

  const create = useMutation({
    mutationFn: () =>
      quoteApi.create({
        bookId: selected!.bookId,
        readingRecordId: selected!.recordId,
        content: draft.body,
        page: draft.pageValue,
      }),
    onSuccess: () => {
      invalidateQuoteLists(queryClient);
      onDone();
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError
      ? create.error.message
      : '오려두지 못했어요 · 다시 시도'
    : null;

  return (
    <Card style={styles.composer}>
      <BookPicker picker={picker} />

      <QuoteDraftFields
        draft={draft}
        trailing={(
          <Pressable
            onPress={() => create.mutate()}
            disabled={!canSubmit || create.isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || create.isPending }}
            style={[styles.submit, {
              backgroundColor: colors.accent,
              opacity: !canSubmit || create.isPending ? 0.35 : 1,
            }]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
              {create.isPending ? '오리는 중…' : '오려두기'}
            </Text>
          </Pressable>
        )}
      />

      {errorMessage ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: 104, gap: spacing.lg },
  header: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  composePill: {
    marginLeft: 'auto',
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  card: { marginHorizontal: spacing.lg, gap: spacing.md },
  cardWrap: { marginHorizontal: spacing.lg },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)·밑줄 카드와 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nickname: { lineHeight: 20 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: 2 },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  finishText: { flex: 1, gap: spacing.xs },

  composer: { marginHorizontal: spacing.lg, gap: spacing.md },
  submit: {
    marginLeft: 'auto',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },

  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 128, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
