import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { MY_QUOTES_KEY, invalidateQuoteLists, myBookQuotesKey, prependMyQuote } from '@/api/quoteCache';
import type { BookQuote } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import type { PickedBook } from '@/components/book/BookPicker';
import { Chip, PaperScreen, SubHeader } from '@/components/collage';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { Card, Eyebrow } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 내 밑줄 수. */
const PAGE_SIZE = 20;
/** 접근성 라벨에 싣는 문장 길이 — 체크박스 이름이 문장 자체가 되게 하되 너무 길지 않게. */
const LABEL_CHARS = 60;

/**
 * 밑줄 고르기 시트 — 독후감에 엮을 내 밑줄을 고르고, 없으면 그 자리에서 새로 오려 둔다.
 *
 * 열림은 부모가 정한다(이 컴포넌트는 열린 상태만 그린다) — 닫을 때 부모가 언마운트하면 검색어·초안도 함께 사라진다.
 * 고른 밑줄의 id 만이 아니라 BookQuote 객체도 `onChange` 에 실어 보낸다 — 부모가 시트 밖에서 조각을 그리기 위해서다.
 * 조각의 누르기는 QuoteScrap 자체 Pressable 에 준다(밖에서 또 감싸면 웹에서 버튼이 겹친다).
 */
export function QuoteAttachSheet({ book, selectedIds, onChange, onClose, max }: {
  /** 글에 고른 책 — 있으면 '이 책만' 칩이 생기고 새로 오려두기의 기본 책이 된다. */
  book?: PickedBook | null;
  selectedIds: number[];
  onChange: (next: number[], quotes: BookQuote[]) => void;
  onClose: () => void;
  max: number;
}) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const bookId = book?.bookId;

  // ── 내 밑줄 목록 — 전체 최신순, 책이 있으면 '이 책만'으로 좁힐 수 있다 ──
  const [onlyThisBook, setOnlyThisBook] = useState(false);
  const scoped = onlyThisBook && bookId != null;
  const list = useInfiniteQuery({
    queryKey: scoped ? myBookQuotesKey(bookId) : MY_QUOTES_KEY,
    queryFn: ({ pageParam }) => quoteApi.mine(pageParam, PAGE_SIZE, scoped ? bookId : undefined),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.content ?? []) ?? [], [list.data]);

  // 방금 오린 문장 — 목록이 다시 오기 전에도 onChange 에 객체를 실어 보내려고 들고 있는다.
  const [created, setCreated] = useState<BookQuote[]>([]);
  const byId = useMemo(
    () => new Map([...created, ...items].map((quote) => [quote.id, quote] as const)),
    [created, items],
  );
  const quotesFor = (ids: number[]) => ids.flatMap((id) => { const q = byId.get(id); return q ? [q] : []; });

  const full = selectedIds.length >= max;
  const toggle = (quote: BookQuote) => {
    const has = selectedIds.includes(quote.id);
    if (!has && full) return;
    const next = has ? selectedIds.filter((id) => id !== quote.id) : [...selectedIds, quote.id];
    onChange(next, quotesFor(next));
  };

  // ── 새로 오려두기 — 어느 책이든(독서 기록 없어도) 고를 수 있고, 오리면 바로 고른 상태가 된다 ──
  const picker = useBookPicker({ initial: book ?? undefined });
  const draft = useQuoteDraft();
  const target = picker.selected;
  const canCreate = target != null && draft.canSubmit;
  const [notice, setNotice] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      quoteApi.create({
        bookId: target!.bookId,
        readingRecordId: target!.recordId,
        content: draft.body,
        page: draft.pageValue,
      }),
    onSuccess: (quote) => {
      prependMyQuote(queryClient, quote);
      invalidateQuoteLists(queryClient);
      setCreated((prev) => [quote, ...prev]);
      draft.setContent('');
      draft.setPageText('');
      if (selectedIds.length < max) {
        setNotice(null);
        onChange([...selectedIds, quote.id], [...quotesFor(selectedIds), quote]);
      } else {
        setNotice(`${max}개가 꽉 차 붙이지 않았어요`);
      }
    },
  });
  const createError = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '오려두지 못했어요 · 다시 시도'
    : null;

  const done = (
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="밑줄 고르기 완료" style={styles.done}>
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>완료</Text>
    </Pressable>
  );

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}
    >
      {/* 모달은 제 창을 가진다 — 바깥 provider 의 인셋을 그대로 쓰면 iOS 시트 위에 상태바 높이가 또 들어간다. */}
      <SafeAreaProvider>
        <PaperScreen>
          <SubHeader category="밑줄 고르기" onBack={onClose} right={done} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {selectedIds.length}/{max} · 최대 {max}개까지 붙일 수 있어요
            </Text>

            <Card style={styles.composer}>
              <Eyebrow>새로 오려두기</Eyebrow>
              <BookPicker picker={picker} />
              <QuoteDraftFields
                draft={draft}
                trailing={(
                  <Pressable
                    onPress={() => create.mutate()}
                    disabled={!canCreate || create.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="오려두기"
                    accessibilityState={{ disabled: !canCreate || create.isPending }}
                    style={[styles.submit, {
                      backgroundColor: colors.accent,
                      opacity: !canCreate || create.isPending ? 0.35 : 1,
                    }]}
                  >
                    <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
                      {create.isPending ? '오리는 중…' : '오려두기'}
                    </Text>
                  </Pressable>
                )}
              />
              {createError ? <Text style={[typeScale.caption, { color: colors.warn }]}>{createError}</Text> : null}
              {notice ? <Text style={[typeScale.caption, { color: colors.warn }]}>{notice}</Text> : null}
            </Card>

            {bookId != null ? (
              <View style={styles.chips}>
                <Chip label="이 책만" active={onlyThisBook} onPress={() => setOnlyThisBook((on) => !on)} />
              </View>
            ) : null}

            {list.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : list.isError ? (
              <Pressable onPress={() => list.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도" style={styles.center}>
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>밑줄을 불러오지 못했어요 · 다시 시도</Text>
              </Pressable>
            ) : items.length === 0 ? (
              <Text style={[typeScale.caption, styles.center, { color: colors.textFaint }]}>
                아직 오려둔 문장이 없어요. 위에서 바로 오려 두세요.
              </Text>
            ) : (
              items.map((quote, i) => {
                const selected = selectedIds.includes(quote.id);
                // 다 골랐으면 안 고른 조각은 흐리게 두고 누르지 못하게 한다.
                const disabled = !selected && full;
                return (
                  <View key={quote.id} style={disabled ? styles.dim : undefined}>
                    <QuoteScrap
                      quote={quote}
                      rotate={i % 2 === 0 ? -1 : 1}
                      selected={selected}
                      disabled={disabled}
                      onPress={() => toggle(quote)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={quote.content.slice(0, LABEL_CHARS)}
                      trailing={(
                        <Text style={[typeScale.monoLabel, styles.mark, { color: selected ? colors.accent : colors.textFaint }]}>
                          {selected ? '✓' : '○'}
                        </Text>
                      )}
                    />
                  </View>
                );
              })
            )}

            {list.hasNextPage ? (
              <Pressable
                onPress={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                accessibilityRole="button"
                accessibilityLabel="밑줄 더 보기"
                style={styles.center}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
                  {list.isFetchingNextPage ? '불러오는 중…' : '더 보기 →'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </PaperScreen>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  // 헤더 우측 슬롯 — 웹은 hitSlop 을 무시하므로 여백으로 44px 상자를 만든다.
  done: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  composer: { gap: spacing.md },
  submit: {
    marginLeft: 'auto',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  chips: { flexDirection: 'row', paddingTop: spacing.xs },
  center: { paddingVertical: spacing.md, alignItems: 'center', textAlign: 'center' },
  dim: { opacity: 0.35 },
  // 체크 표식 — 조각 오른쪽에 한 글자. 여백으로 조각과 떨어뜨린다.
  mark: { fontSize: 14, paddingHorizontal: spacing.xs },
});
