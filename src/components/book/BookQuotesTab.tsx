import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { bookQuotesKey, invalidateQuoteLists } from '@/api/quoteCache';
import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { Button, Card } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받는 밑줄 수 — 섹션 안에 붙는 조각이라 적게. */
const PAGE_SIZE = 5;

/**
 * 도서 상세 리뷰 섹션의 '밑줄' 탭 — 이 책에 달린 밑줄을 점선 메모 조각으로 늘어놓는다.
 * 조각을 누르면 밑줄 상세로 간다. `open` 이면 위에 인라인 오려두기 폼이 펼쳐진다(rid 필요).
 */
export function BookQuotesTab({ bookId, rid, open, onClose }: {
  bookId: number;
  /** 이 책의 읽기 기록 id — 없으면 오려두기 폼을 열 수 없다(호출 쪽에서 액션을 숨긴다). */
  rid: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const quotes = useInfiniteQuery({
    queryKey: bookQuotesKey(bookId),
    queryFn: ({ pageParam }) => quoteApi.byBook(bookId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(bookId),
  });
  const items = quotes.data?.pages.flatMap((p) => p.content ?? []) ?? [];

  return (
    <View style={styles.wrap}>
      {open && rid != null ? (
        <QuoteComposer bookId={bookId} rid={rid} onDone={onClose} />
      ) : null}

      {quotes.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : quotes.isError && items.length === 0 ? (
        <Card>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>밑줄을 불러오지 못했습니다.</Text>
          <Pressable onPress={() => quotes.refetch()} hitSlop={8} accessibilityRole="button"
            accessibilityLabel="밑줄 다시 불러오기">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
          </Pressable>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            아직 이 책에 밑줄이 없어요. 읽다가 걸린 문장을 오려두세요.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((quote, index) => (
            <QuoteScrap key={quote.id} quote={quote} rotate={index % 2 === 0 ? -1 : 1}
              onPress={() => router.push(`/quote/${quote.id}`)} />
          ))}
          {quotes.isFetchingNextPage ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : quotes.isError ? (
            // 다음 쪽을 못 받아도 이미 펼쳐 둔 조각은 그대로 둔다 — '더 보기' 자리에 다시 시도만 놓는다.
            <Pressable
              onPress={() => (quotes.hasNextPage ? quotes.fetchNextPage() : quotes.refetch())}
              accessibilityRole="button" accessibilityLabel="밑줄 다시 불러오기" hitSlop={8}
              style={styles.center}>
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>불러오지 못했어요 · 다시 시도</Text>
            </Pressable>
          ) : quotes.hasNextPage ? (
            <Pressable onPress={() => quotes.fetchNextPage()} accessibilityRole="button" hitSlop={8}
              style={styles.center}>
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>밑줄 더 보기 →</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** 밑줄 조각 — 문장 + 모노 메타(작성자 · 쪽 · 나도 그럼 · 댓글). 통째로 눌러 상세로. */
function QuoteScrap({ quote, rotate, onPress }: { quote: BookQuote; rotate: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="밑줄 상세">
      <MemoScrap rotate={rotate}>
        <Text style={[styles.scrapText, { color: colors.text, borderLeftColor: colors.accent }]}>
          {quote.content}
        </Text>
        <View style={styles.scrapMeta}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.scrapMetaText, styles.scrapWho, { color: colors.textMuted }]}>
            {quote.authorNickname}
            {quote.page != null ? ` · ${quote.page}쪽` : ''}
          </Text>
          <Text style={[typeScale.monoLabel, styles.scrapMetaText, {
            color: quote.agreedByMe ? colors.accent : colors.textFaint,
          }]}>
            나도 그럼 {quote.agreeCount}
          </Text>
          <Text style={[typeScale.monoLabel, styles.scrapMetaText, { color: colors.accent }]}>
            댓글 {quote.commentCount}
          </Text>
        </View>
      </MemoScrap>
    </Pressable>
  );
}

/** 인라인 오려두기 — 책이 정해져 있어 고르기 없이 문장·쪽만 받는다(리뷰 폼과 같은 카드 펼침). */
function QuoteComposer({ bookId, rid, onDone }: { bookId: number; rid: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  // 문장·쪽수 칸과 그 검증은 광장 오려두기와 같은 것을 쓴다.
  const draft = useQuoteDraft();

  const create = useMutation({
    mutationFn: () =>
      quoteApi.create({ bookId, readingRecordId: rid, content: draft.body, page: draft.pageValue }),
    onSuccess: () => {
      invalidateQuoteLists(queryClient);
      onDone();
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '오려두지 못했어요 · 다시 시도'
    : null;

  return (
    <Card style={styles.composer}>
      <QuoteDraftFields draft={draft} />
      {errorMessage ? <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text> : null}
      <View style={styles.composerActions}>
        <Button
          label={create.isPending ? '오리는 중…' : '오려두기'}
          onPress={() => create.mutate()}
          disabled={!draft.canSubmit || create.isPending}
          style={styles.composerButton}
        />
        <Button label="취소" variant="outline" onPress={onDone} disabled={create.isPending} style={styles.composerButton} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.md },
  center: { paddingVertical: spacing.md, alignItems: 'center' },
  // 인용 본문 — 밑줄 카드와 같은 만듦새로, quote 토큰을 14/1.7 로 줄이고 왼쪽에 악센트 선을 세운다.
  scrapText: { ...typeScale.quote, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 11 },
  scrapMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  scrapMetaText: { fontSize: 9, letterSpacing: 0.4 },
  scrapWho: { flex: 1 },

  composer: { gap: spacing.md },
  composerActions: { flexDirection: 'row', gap: spacing.sm },
  composerButton: { flex: 1 },
});
