import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { bookQuotesKey, invalidateQuoteLists } from '@/api/quoteCache';
import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { Button, Card } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 한 번에 받는 밑줄 수 — 섹션 안에 붙는 조각이라 적게. */
const PAGE_SIZE = 5;
/** 문장 길이 상한 — 서버 계약과 같은 값. */
const CONTENT_MAX = 500;

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
      ) : quotes.isError ? (
        <Card>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>밑줄을 불러오지 못했습니다.</Text>
          <Pressable onPress={() => quotes.refetch()} hitSlop={8} accessibilityRole="button">
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
  const [content, setContent] = useState('');
  const [pageText, setPageText] = useState('');

  const trimmedPage = pageText.trim();
  const pageValue = trimmedPage === '' ? undefined : Number(trimmedPage);
  const pageValid = pageValue === undefined || (Number.isInteger(pageValue) && pageValue >= 1);
  const body = content.trim();
  const canSubmit = body.length > 0 && body.length <= CONTENT_MAX && pageValid;

  const create = useMutation({
    mutationFn: () => quoteApi.create({ bookId, readingRecordId: rid, content: body, page: pageValue }),
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
      </View>
      {!pageValid ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>쪽수는 1 이상의 숫자로 적어 주세요.</Text>
      ) : null}
      {errorMessage ? <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text> : null}
      <View style={styles.composerActions}>
        <Button
          label={create.isPending ? '오리는 중…' : '오려두기'}
          onPress={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
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
  // 인용 본문 — 명조 14/1.7, 왼쪽에 악센트 선.
  scrapText: { fontFamily: serif.regular, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 10 },
  scrapMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  scrapMetaText: { fontSize: 9, letterSpacing: 0.4 },
  scrapWho: { flex: 1 },

  composer: { gap: spacing.md },
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
  composerActions: { flexDirection: 'row', gap: spacing.sm },
  composerButton: { flex: 1 },
});
