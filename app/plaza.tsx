import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { libraryApi, plazaApi, quoteApi } from '@/api/endpoints';
import type { Page, PlazaItem, PlazaItemType } from '@/api/types';
import { Chip, PaperScreen, SectionNav, TiltCover } from '@/components/collage';
import { Card, EmptyState, formatRelative } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 한 번에 받아오는 피드 건수 — 카드가 커서 한 화면에 서너 장만 들어온다. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
const CARD_TILT = [-1.1, 0.8];
/** 삭제 재확인이 살아 있는 시간(ms). 지나면 조용히 원래 라벨로 돌아간다. */
const DELETE_CONFIRM_MS = 3000;
/** 문장 길이 상한 — 서버 계약과 같은 값. */
const CONTENT_MAX = 500;
/**
 * 푸터 액션 확장 터치 영역(네이티브 전용).
 *
 * 웹은 hitSlop 을 무시하므로 실제 여백(styles.footAction)으로 상자를 키우고,
 * 네이티브는 그 위에 hitSlop 을 더 얹어 넉넉하게 잡는다.
 */
const FOOT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/** 광장 피드 무한 쿼리 키. 홈 상위 3건은 ['plaza','QUOTE','top3'] 로 갈라 둔다(QuoteScrapRow). */
const feedKey = (type: PlazaItemType) => ['plaza', type] as const;
/** 홈 '오려둔 문장' 캐시 — '나도 그럼'을 누르면 여기도 같이 손봐야 한다. */
const TOP3_KEY = ['plaza', 'QUOTE', 'top3'] as const;

type FeedCache = InfiniteData<Page<PlazaItem>>;

/**
 * 구역 3. 광장 — 다른 독자들이 오려 둔 문장과 완독 자랑이 모이는 곳 (시안 2d).
 *
 * 필터 칩은 세 개지만 성격이 다르다. '밑줄'·'완독 자랑'은 같은 피드의 type 이고,
 * '토론'은 피드가 아니라 모임 화면으로 나가는 링크다 — 눌러도 활성으로 남지 않는다.
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
  /**
   * 토글이 날아가 있는 문장 id.
   *
   * 응답을 기다리는 사이 같은 문장을 또 누르면 두 뮤테이션이 서로의 스냅샷을 엇갈리게
   * 되돌려 서버와 다른 카운트가 화면에 눌러앉는다(staleTime 15초 + 포커스 재조회 꺼짐이라
   * 저절로 낫지 않는다). 그래서 문장 단위로 한 번에 하나씩만 보낸다.
   */
  const agreeing = useRef(new Set<number>());

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const feed = useInfiniteQuery({
    queryKey: feedKey(type),
    queryFn: ({ pageParam }) => plazaApi.feed(type, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  const items = feed.data?.pages.flatMap((p) => p.content ?? []) ?? [];

  /**
   * '나도 그럼' 토글 — 무한 피드와 홈 상위 3건 캐시를 함께 뒤집고, 실패하면 둘 다 되돌린다.
   * 토글 결과는 서버가 알려주므로 성공 시 그 값으로 다시 맞춘다.
   */
  const agree = useMutation({
    mutationFn: (quoteId: number) => quoteApi.agree(quoteId),
    onMutate: async (quoteId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKey('QUOTE') }),
        queryClient.cancelQueries({ queryKey: TOP3_KEY }),
      ]);
      const snapshot = {
        feed: queryClient.getQueryData<FeedCache>(feedKey('QUOTE')),
        top3: queryClient.getQueryData<Page<PlazaItem>>(TOP3_KEY),
      };
      patchQuote(queryClient, quoteId, toggleAgree);
      return snapshot;
    },
    onError: (_error, _quoteId, snapshot) => {
      if (!snapshot) return;
      queryClient.setQueryData(feedKey('QUOTE'), snapshot.feed);
      queryClient.setQueryData(TOP3_KEY, snapshot.top3);
    },
    onSuccess: (result, quoteId) => {
      patchQuote(queryClient, quoteId, (item) => ({
        ...item,
        agreedByMe: result.agreed,
        agreeCount: result.agreeCount,
      }));
    },
    // 성공이든 실패든 잠금을 풀어 준다. 여기서 무효화하지 않는다 —
    // 무한 피드 전 페이지를 다시 받아 오는 값이 토글 하나에 비해 너무 비싸다.
    onSettled: (_result, _error, quoteId) => {
      agreeing.current.delete(quoteId);
    },
  });

  /** 응답을 기다리는 동안의 재탭은 삼킨다 — 낙관 갱신이 서로 어긋나지 않게. */
  const pressAgree = (quoteId: number) => {
    if (agreeing.current.has(quoteId)) return;
    agreeing.current.add(quoteId);
    agree.mutate(quoteId);
  };

  const remove = useMutation({
    mutationFn: (quoteId: number) => quoteApi.remove(quoteId),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
    setType(next);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.chipRow}>
        <Chip label="밑줄" active={type === 'QUOTE'} onPress={() => switchType('QUOTE')} />
        {/* 토론은 피드가 아니라 모임으로 나가는 문이다 — 활성 상태로 남지 않는다. */}
        <Chip label="토론" onPress={() => router.push('/clubs')} />
        <Chip label="완독 자랑" active={type === 'FINISH'} onPress={() => switchType('FINISH')} />
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
      </View>

      {composing ? <QuoteComposer onDone={() => setComposing(false)} /> : null}
    </View>
  );

  return (
    <PaperScreen>
      <SectionNav active="plaza" />
      <FlatList
        data={items}
        keyExtractor={itemKey}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        renderItem={({ item, index }) => (
          <FeedCard
            item={item}
            index={index}
            mine={myId != null && item.authorId === myId}
            confirming={item.quoteId != null && confirmId === item.quoteId}
            error={item.quoteId != null && removeError?.id === item.quoteId ? removeError.message : null}
            onAgree={() => {
              if (item.quoteId != null) pressAgree(item.quoteId);
            }}
            onDelete={() => {
              if (item.quoteId != null) pressDelete(item.quoteId);
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

/** 항목 스스로의 현재 상태를 뒤집는다 — 캐시마다 값이 달라도 각자 일관되게 움직인다. */
function toggleAgree(item: PlazaItem): PlazaItem {
  const agreed = !(item.agreedByMe ?? false);
  return {
    ...item,
    agreedByMe: agreed,
    agreeCount: Math.max(0, (item.agreeCount ?? 0) + (agreed ? 1 : -1)),
  };
}

/** 같은 문장이 무한 피드와 홈 상위 3건 양쪽에 있으므로 두 캐시를 한 번에 손본다. */
function patchQuote(
  queryClient: QueryClient,
  quoteId: number,
  map: (item: PlazaItem) => PlazaItem,
) {
  const apply = (list: PlazaItem[]) =>
    list.map((item) => (item.quoteId === quoteId ? map(item) : item));

  queryClient.setQueryData<FeedCache>(feedKey('QUOTE'), (old) =>
    old
      ? { ...old, pages: old.pages.map((p) => ({ ...p, content: apply(p.content ?? []) })) }
      : old,
  );
  queryClient.setQueryData<Page<PlazaItem>>(TOP3_KEY, (old) =>
    old ? { ...old, content: apply(old.content ?? []) } : old,
  );
}

/** 피드 카드 한 장 — 밑줄과 완독 자랑이 같은 카드 가족을 쓴다. */
function FeedCard({ item, index, mine, confirming, error, onAgree, onDelete, onOpenBook }: {
  item: PlazaItem;
  index: number;
  mine: boolean;
  confirming: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  onAgree: () => void;
  onDelete: () => void;
  onOpenBook: () => void;
}) {
  const { colors } = useTheme();
  const tilt = CARD_TILT[index % CARD_TILT.length];
  const quote = item.type === 'QUOTE';

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
          {item.authorAvatarUrl ? (
            <Image source={{ uri: item.authorAvatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              {item.authorNickname.slice(0, 1)}
            </Text>
          )}
        </View>
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {item.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {item.bookTitle}
            {quote && item.page != null ? ` · ${item.page}쪽` : ''}
          </Text>
        </View>
      </View>

      {quote ? (
        <Text style={[styles.quote, { color: colors.text, borderLeftColor: colors.accent }]}>
          {item.content}
        </Text>
      ) : (
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
      )}

      {quote ? (
        <>
          <View style={styles.footRow}>
            {/* 10px 활자라 글자 상자(16px)만으로는 손가락이 닿지 않는다 — 여백으로 36px 까지 넓힌다. */}
            <Pressable onPress={onAgree} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
              accessibilityRole="button"
              accessibilityState={{ selected: item.agreedByMe ?? false }}
              accessibilityLabel={`나도 그럼 ${item.agreeCount ?? 0}`}>
              <Text style={[typeScale.monoLabel, styles.footLabel, {
                color: item.agreedByMe ? colors.accent : colors.textMuted,
              }]}>
                나도 그럼 {item.agreeCount ?? 0}
              </Text>
            </Pressable>
            {mine ? (
              <Pressable onPress={onDelete} hitSlop={FOOT_HIT_SLOP} accessibilityRole="button"
                accessibilityLabel={confirming ? '삭제 확인' : '삭제'}
                style={[styles.footAction, styles.deleteButton]}>
                <Text style={[typeScale.monoLabel, styles.footLabel, {
                  color: confirming ? colors.danger : colors.textFaint,
                }]}>
                  {confirming ? '한 번 더' : '삭제'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {error ? (
            <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * 문장 오려두기 패널 — 모달 대신 칩 행 아래로 펼쳐지는 카드(도서 상세 리뷰 폼과 같은 방식).
 * 읽는 중인 책이 있어야 문장을 오릴 수 있으므로, 없으면 탐색으로 안내만 한다.
 */
function QuoteComposer({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  // 홈·나와 같은 캐시 키를 쓴다 — 이미 받아 둔 목록이 있으면 그대로 재사용된다.
  const reading = useQuery({
    queryKey: ['library', 'READING'],
    queryFn: () => libraryApi.list('READING'),
  });
  const records = (reading.data?.content ?? []).filter((r) => r.book?.id != null);

  const [recordId, setRecordId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [pageText, setPageText] = useState('');

  // 아직 안 골랐으면 첫 책을 기본으로 둔다 — 한 권만 읽는 사람은 바로 쓰기 시작할 수 있다.
  const selected = records.find((r) => r.id === recordId) ?? records[0] ?? null;

  const trimmedPage = pageText.trim();
  const pageValue = trimmedPage === '' ? undefined : Number(trimmedPage);
  const pageValid = pageValue === undefined
    || (Number.isInteger(pageValue) && pageValue >= 1);

  const body = content.trim();
  const canSubmit = selected != null && body.length > 0 && body.length <= CONTENT_MAX && pageValid;

  const create = useMutation({
    mutationFn: () =>
      quoteApi.create({
        bookId: selected!.book!.id,
        readingRecordId: selected!.id,
        content: body,
        page: pageValue,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onDone();
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError
      ? create.error.message
      : '오려두지 못했어요 · 다시 시도'
    : null;

  if (reading.isLoading) {
    return (
      <Card style={styles.composer}>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>읽는 중인 책을 찾는 중입니다.</Text>
      </Card>
    );
  }

  // 못 불러온 것과 정말 없는 것은 다른 이야기다 — 실패를 '읽는 중인 책이 없다'로 말하지 않는다.
  if (reading.isError) {
    return (
      <Card style={styles.composer}>
        <Text style={[typeScale.body, { color: colors.textMuted }]}>
          읽는 중인 책을 불러오지 못했습니다.
        </Text>
        <Pressable onPress={() => reading.refetch()} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
        </Pressable>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card style={styles.composer}>
        <Text style={[typeScale.body, { color: colors.textMuted }]}>
          읽는 중인 책이 있어야 문장을 오릴 수 있습니다.
        </Text>
        <Pressable onPress={() => router.push('/search')} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>책 찾으러 가기 →</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={styles.composer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
        {records.map((record) => {
          const picked = selected?.id === record.id;
          return (
            <Pressable
              key={record.id}
              onPress={() => setRecordId(record.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={record.book?.title ?? '제목 없음'}
              style={[styles.pick, { borderColor: picked ? colors.accent : 'transparent' }]}
            >
              <TiltCover
                uri={record.book?.coverUrl}
                title={record.book?.title}
                width={52}
                tilt={0}
                entering={false}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="마음에 걸린 문장을 옮겨 적어 보세요."
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={CONTENT_MAX}
        accessibilityLabel="문장"
        style={[styles.contentInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }]}
      />

      <View style={styles.composerMeta}>
        <TextInput
          value={pageText}
          onChangeText={setPageText}
          placeholder="쪽(선택)"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          accessibilityLabel="쪽수"
          style={[styles.pageInput, {
            backgroundColor: colors.surfaceDeep,
            borderColor: pageValid ? colors.line : colors.danger,
            color: colors.text,
          }]}
        />
        <Text style={[typeScale.monoLabel, { color: content.length >= CONTENT_MAX ? colors.warn : colors.textFaint }]}>
          {content.length}/{CONTENT_MAX}
        </Text>
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
      </View>

      {!pageValid ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>쪽수는 1 이상의 숫자로 적어 주세요.</Text>
      ) : null}
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  authorText: { flex: 1 },
  nickname: { fontSize: 12 },
  where: { fontSize: 9, letterSpacing: 0.4, marginTop: 2 },
  // 시안 2d 의 인용 본문 — quote 토큰을 15/1.65 로 줄이고 왼쪽에 악센트 선을 세운다.
  quote: { ...typeScale.quote, fontSize: 15, lineHeight: 25, borderLeftWidth: 2, paddingLeft: 11 },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  finishText: { flex: 1, gap: spacing.xs },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footLabel: { fontSize: 10, letterSpacing: 0.4 },
  // 여백으로 손가락 상자를 키우되, 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다.
  footAction: { paddingVertical: 10, paddingHorizontal: 6, marginVertical: -6, marginHorizontal: -6 },
  deleteButton: { marginLeft: 'auto' },

  composer: { marginHorizontal: spacing.lg, gap: spacing.md },
  pickRow: { gap: spacing.sm, paddingVertical: 2 },
  pick: { borderWidth: 2, borderRadius: radius.sm, padding: 2 },
  contentInput: {
    minHeight: 92,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  composerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageInput: {
    width: 84,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.monoNumeral,
  },
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
