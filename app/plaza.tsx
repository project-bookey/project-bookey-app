import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, plazaApi, quoteApi } from '@/api/endpoints';
import { invalidateQuoteLists, plazaFeedKey, quoteKey } from '@/api/quoteCache';
import type { PlazaItem, PlazaItemType } from '@/api/types';
import { Chip, FocusRing, PaperScreen, SectionNav, TiltCover } from '@/components/collage';
import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { Card, EmptyState, formatRelative } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { sans } from '@/theme/tokens';

/** 한 번에 받아오는 피드 건수 — 카드가 커서 한 화면에 서너 장만 들어온다. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
const CARD_TILT = [-1.1, 0.8];
/** 삭제 재확인이 살아 있는 시간(ms). 지나면 조용히 원래 라벨로 돌아간다. */
const DELETE_CONFIRM_MS = 3000;
/** 컴포저 책 검색 — 탐색 화면과 같은 디바운스·최소 글자 수. */
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;
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
 * 구역 3. 광장 — 다른 독자들이 오려 둔 문장과 완독 자랑이 모이는 곳 (시안 2d).
 *
 * 필터 칩 '밑줄'·'완독 자랑'은 같은 피드의 type 이다. 모임은 상단 구역 탭으로 올라가 여기엔 없다.
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

  const [type, setType] = useState<PlazaItemType>('QUOTE');
  const [composing, setComposing] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState<{ id: number; message: string } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<PlazaItem>>(null);
  /** 강조가 걸린 문장 — 페이드가 끝나면 스스로 지운다. 한 번에 한 장뿐이다. */
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const clearFocus = useCallback(() => setFocusedId(null), []);
  /** '좋아요' 낙관 토글 — 인플라이트 가드까지 공용 훅이 맡는다(상세와 같은 규율). */
  const pressAgree = useAgreeQuote();

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const feed = useInfiniteQuery({
    queryKey: plazaFeedKey(type),
    queryFn: ({ pageParam }) => plazaApi.feed(type, pageParam, PAGE_SIZE),
    initialPageParam: 0,
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
    // 완독 자랑을 보던 중에 들어왔으면 밑줄로 되돌린다 — 전환 뒤 이 effect 가 다시 온다.
    if (type !== 'QUOTE') {
      setType('QUOTE');
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
  }, [focusQuoteId, type, feed.isSuccess, items, router]);

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
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmId === quoteId) {
      confirmTimer.current = null;
      setConfirmId(null);
      remove.mutate(quoteId);
      return;
    }
    setConfirmId(quoteId);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirmId(null);
    }, DELETE_CONFIRM_MS);
  };

  const switchType = (next: PlazaItemType) => {
    if (next === type) return;
    setConfirmId(null);
    // 완독 자랑에는 오려두기가 없다 — 열려 있던 컴포저를 접는다.
    setComposing(false);
    setType(next);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.chipRow}>
        <Chip label="밑줄" active={type === 'QUOTE'} onPress={() => switchType('QUOTE')} />
        <Chip label="완독 자랑" active={type === 'FINISH'} onPress={() => switchType('FINISH')} />
        {/* 오려두기는 밑줄 탭에서만 — 완독 자랑은 읽기 기록에서 자동으로 오른다. */}
        {type === 'QUOTE' ? (
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
      </View>

      {composing ? <QuoteComposer onDone={() => setComposing(false)} /> : null}
    </View>
  );

  return (
    <PaperScreen>
      <SectionNav active="plaza" />
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
          ) : type === 'QUOTE' ? (
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
 * 문장·쪽수 칸과 그 검증은 도서 상세와 같은 QuoteDraftFields 가 맡고, 책 고르기만 여기 몫이다.
 */
/** 컴포저가 고른 책 — 내 서재 기록에서 왔으면 recordId 도 함께 담는다. */
type PickedBook = { bookId: number; title: string; coverUrl?: string; recordId?: number };

function QuoteComposer({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  // 읽는 중인 책은 바로 고를 수 있는 빠른 선택지 — 홈·나와 같은 캐시 키라 받아 둔 목록을 재사용한다.
  const reading = useQuery({
    queryKey: ['library', 'READING'],
    queryFn: () => libraryApi.list('READING'),
  });
  const quickPicks: PickedBook[] = (reading.data?.content ?? [])
    .filter((r) => r.book?.id != null)
    .map((r) => ({ bookId: r.book!.id, title: r.book!.title, coverUrl: r.book!.coverUrl, recordId: r.id }));

  // 어떤 책이든 검색해서 고를 수 있다 — 읽는 중이 아니어도 된다(서버는 bookId 만으로 받는다).
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);
  const searching = debounced.length >= SEARCH_MIN_CHARS;
  const search = useQuery({
    queryKey: ['books', 'search', debounced],
    queryFn: () => bookApi.search(debounced),
    enabled: searching,
  });
  const results: PickedBook[] = (search.data ?? []).map((b) => ({
    bookId: b.id,
    title: b.title,
    coverUrl: b.coverUrl,
    // 검색으로 골라도 내 서재에 읽는 중 기록이 있으면 그 기록에 매단다.
    recordId: quickPicks.find((q) => q.bookId === b.id)?.recordId,
  }));

  const [picked, setPicked] = useState<PickedBook | null>(null);
  // 아직 안 골랐고 검색 중도 아니면 읽는 중인 첫 책이 기본 — 한 권만 읽는 사람은 바로 쓰기 시작한다.
  const selected = picked ?? (searching ? null : quickPicks[0] ?? null);
  const candidates = searching ? results : quickPicks;

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

  // 후보 행 아래 한 줄 안내 — 상태마다 다른 말을 한다.
  const hint = searching
    ? search.isLoading ? '찾는 중…' : search.isError ? null : candidates.length === 0 ? '검색 결과가 없어요.' : null
    : reading.isLoading ? '읽는 중인 책을 찾는 중입니다.'
      : reading.isError ? null
        : candidates.length === 0 ? '읽는 중인 책이 없어요 — 위에서 책을 검색해 고르세요.' : null;

  return (
    <Card style={styles.composer}>
      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder="책 제목·저자로 찾기"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="책 검색"
        style={[styles.searchInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }]}
      />

      {candidates.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
          {candidates.map((candidate) => {
            const isPicked = selected?.bookId === candidate.bookId;
            return (
              <Pressable
                key={candidate.bookId}
                onPress={() => setPicked(candidate)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPicked }}
                accessibilityLabel={candidate.title}
                style={[styles.pick, { borderColor: isPicked ? colors.accent : 'transparent' }]}
              >
                <TiltCover uri={candidate.coverUrl} title={candidate.title} width={52} tilt={0} entering={false} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {hint ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>{hint}</Text> : null}
      {/* 못 불러온 것과 정말 없는 것은 다른 이야기다 — 실패는 실패라고 말하고 다시 시도를 준다. */}
      {searching && search.isError ? (
        <Pressable onPress={() => search.refetch()} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>검색에 실패했어요 · 다시 시도 →</Text>
        </Pressable>
      ) : null}
      {!searching && reading.isError ? (
        <Pressable onPress={() => reading.refetch()} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>읽는 중인 책을 불러오지 못했어요 · 다시 시도 →</Text>
        </Pressable>
      ) : null}

      {selected ? (
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.pickedLine, { color: colors.textMuted }]}>
          {selected.title}{selected.recordId != null ? ' · 내 서재' : ''}
        </Text>
      ) : null}

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
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.lg },
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorText: { flex: 1 },
  nickname: { fontSize: 12 },
  where: { fontSize: 9, letterSpacing: 0.4, marginTop: 2 },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  finishText: { flex: 1, gap: spacing.xs },

  composer: { marginHorizontal: spacing.lg, gap: spacing.md },
  pickRow: { gap: spacing.sm, paddingVertical: 2 },
  pick: { borderWidth: 2, borderRadius: radius.sm, padding: 2 },
  // 책 검색 입력 — 쪽수 입력과 같은 재질, pill.
  searchInput: {
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: sans.regular,
    fontSize: 14,
  },
  pickedLine: { marginTop: -spacing.xs },
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
