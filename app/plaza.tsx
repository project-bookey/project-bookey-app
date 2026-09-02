import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { libraryApi, plazaApi, quoteApi } from '@/api/endpoints';
import { invalidateQuoteLists, plazaFeedKey, quoteKey } from '@/api/quoteCache';
import type { PlazaItem, PlazaItemType } from '@/api/types';
import { Chip, PaperScreen, SectionNav, TiltCover } from '@/components/collage';
import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { Card, EmptyState, formatRelative } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 피드 건수 — 카드가 커서 한 화면에 서너 장만 들어온다. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
const CARD_TILT = [-1.1, 0.8];
/** 삭제 재확인이 살아 있는 시간(ms). 지나면 조용히 원래 라벨로 돌아간다. */
const DELETE_CONFIRM_MS = 3000;

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

  const items = feed.data?.pages.flatMap((p) => p.content ?? []) ?? [];

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
function FeedCard({ item, index, mine, confirming, error, onAgree, onDelete, onOpen, onOpenBook }: {
  item: PlazaItem;
  index: number;
  mine: boolean;
  confirming: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  onAgree: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onOpenBook: () => void;
}) {
  const { colors } = useTheme();
  const tilt = CARD_TILT[index % CARD_TILT.length];

  if (item.type === 'QUOTE') {
    return (
      <View style={styles.cardWrap}>
        <QuoteCard
          tilt={tilt}
          authorNickname={item.authorNickname}
          authorAvatarUrl={item.authorAvatarUrl}
          bookTitle={item.bookTitle}
          page={item.page}
          content={item.content ?? ''}
          agreeCount={item.agreeCount ?? 0}
          agreedByMe={item.agreedByMe ?? false}
          commentCount={item.commentCount ?? 0}
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
  // 문장·쪽수 칸과 그 검증은 도서 상세 밑줄 탭과 같은 것을 쓴다.
  const draft = useQuoteDraft();

  // 아직 안 골랐으면 첫 책을 기본으로 둔다 — 한 권만 읽는 사람은 바로 쓰기 시작할 수 있다.
  const selected = records.find((r) => r.id === recordId) ?? records[0] ?? null;

  // 광장은 책을 골라야 오릴 수 있다 — 공용 검증에 그 조건만 덧붙인다.
  const canSubmit = selected != null && draft.canSubmit;

  const create = useMutation({
    mutationFn: () =>
      quoteApi.create({
        bookId: selected!.book!.id,
        readingRecordId: selected!.id,
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
        <Pressable onPress={() => router.navigate('/search')} hitSlop={8} accessibilityRole="button">
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
