import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextStyle,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { plazaApi, quoteApi } from '@/api/endpoints';
import {
  bookQuotesPickerKey, invalidateQuoteLists, myQuotesKey, plazaQuotesKey, prependMyQuote,
} from '@/api/quoteCache';
import type { BookQuote, Page } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import type { PickedBook } from '@/components/book/BookPicker';
import { Chip, PaperScreen, SubHeader } from '@/components/collage';
import { plazaItemToQuote } from '@/components/post/quoteScope';
import type { QuoteScope } from '@/components/post/quoteScope';
import { QuoteDraftFields, useQuoteDraft } from '@/components/quote/QuoteDraftFields';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { Card, Eyebrow } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { sans } from '@/theme/tokens';

/** 한 번에 받아오는 밑줄 수 — 세 범위가 같다. */
const PAGE_SIZE = 20;
/** 접근성 라벨에 싣는 문장 길이 — 버튼 이름이 문장 자체가 되게 하되 너무 길지 않게. */
const LABEL_CHARS = 60;
/** 문장 찾기 디바운스 — 탐색 화면·책 고르기와 같은 값(한 글자마다 서버를 두드리지 않는다). */
const SEARCH_DEBOUNCE_MS = 400;

// 웹 전용: 브라우저 기본 포커스 링 제거 — 포커스는 pill 테두리로 그린다(탐색 화면과 같은 관례).
// RN 타입에 'none' 이 없어 캐스팅하지만 RNW 는 CSS outline-style 로 그대로 전달한다.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** 다음 쪽 번호 — 서버가 hasNext 를 주고, page 가 비면 지금까지 받은 쪽 수로 센다. 세 범위가 같다. */
function nextPage<T>(last: Page<T>, all: Page<T>[]): number | undefined {
  return last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined;
}

/**
 * 밑줄 고르기 시트 — 독후감에 넣을 밑줄을 하나 고르고, 없으면 그 자리에서 새로 오려 둔다.
 *
 * 고르기는 한 번에 하나다 — 조각을 누르면 곧바로 `onPick` 으로 넘기고, 부모가 커서 자리에 넣은 뒤 시트를 닫는다.
 * 닫기를 부모가 맡는 까닭은 열림 상태를 부모가 쥐고 있기 때문이다 — 넣기와 닫기가 한 흐름이라 한자리에서 끝내는 게 읽기 쉽고,
 * 시트는 '무엇을 골랐는지'만 알리는 순수한 고르개로 남는다.
 * 범위 칩으로 어디서 찾을지 고른다 — 내 밑줄(기본) · 이 책(글에 책을 골랐을 때만) · 광장(모두의 문장).
 * 문장 찾기는 서버가 맡는다 — 받아온 쪽만 훑는 게 아니라 그 범위 전체에서 문장 내용·책 제목을 부분 일치로 찾는다.
 * 남의 문장도 고를 수 있고, 조각에는 `showAuthor` 로 작성자를 밝힌다.
 * 열림은 부모가 정한다(이 컴포넌트는 열린 상태만 그린다) — 닫을 때 부모가 언마운트하면 검색어·초안도 함께 사라진다.
 * id 가 아니라 BookQuote 객체를 넘긴다 — 부모가 시트 밖에서 조각을 그리려면 실체가 있어야 한다.
 * 조각의 누르기는 QuoteScrap 자체 Pressable 에 준다(밖에서 또 감싸면 웹에서 버튼이 겹친다).
 */
export function QuoteAttachSheet({ book, selectedIds, onPick, onClose, max }: {
  /** 글에 고른 책 — 있으면 '이 책' 범위 칩이 생기고 새로 오려두기의 기본 책이 된다. */
  book?: PickedBook | null;
  /** 이미 본문에 들어 있는 밑줄 — 흐리게 두고 다시 넣지 못하게 한다. */
  selectedIds: number[];
  /** 고른 밑줄 하나 — 부모가 본문에 넣고 시트를 닫는다. */
  onPick: (quote: BookQuote) => void;
  onClose: () => void;
  max: number;
}) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const bookId = book?.bookId;

  // ── 어디서 찾을지 — 내 밑줄이 기본, 글에 책을 골랐으면 '이 책', 그리고 광장 전체 ──
  const [scope, setScope] = useState<QuoteScope>('MINE');
  const myId = useAuth((s) => s.user?.id);
  // 책을 뺐는데 '이 책'을 보고 있었다면 내 밑줄로 되돌린다.
  const activeScope: QuoteScope = scope === 'BOOK' && bookId == null ? 'MINE' : scope;

  // ── 문장 찾기 — 서버가 그 범위 전체에서 문장 내용·책 제목을 훑는다(대소문자 무시 부분 일치) ──
  const [keyword, setKeyword] = useState('');
  // 입력이 멎으면 검색어를 확정한다 — 확정된 것만 질의에 들어간다. 범위를 바꿔도 검색어는 그대로 따라간다.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);
  // 포커스 표시는 웹 기본 outline 대신 pill 테두리로 그린다.
  const [focused, setFocused] = useState(false);

  // ── 범위별 목록 — 응답 모양이 갈려(광장은 PlazaItem) 질의를 셋으로 나누고 보고 있는 범위만 켠다 ──
  // 검색어는 키에 들어간다(캐시가 검색어마다 갈린다) 그리고 그대로 서버에 넘어간다 — 빈 문자열은 api() 의
  // 쿼리 빌더가 건너뛰므로 검색어가 없으면 q 없이 나가고, 전체 목록이 온다.
  // placeholderData 로 앞 검색어의 결과를 붙들어 둔다 — 새 검색이 오는 동안 목록이 사라졌다 돌아오지 않는다.
  const mineList = useInfiniteQuery({
    queryKey: myQuotesKey(debounced),
    queryFn: ({ pageParam }) => quoteApi.mine(pageParam, PAGE_SIZE, undefined, debounced),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled: activeScope === 'MINE',
    placeholderData: keepPreviousData,
  });
  const bookList = useInfiniteQuery({
    // bookId 가 없으면 질의가 꺼져 있어 이 키로는 아무것도 받지 않는다.
    queryKey: bookQuotesPickerKey(bookId ?? 0, debounced),
    queryFn: ({ pageParam }) => quoteApi.byBook(bookId ?? 0, pageParam, PAGE_SIZE, debounced),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled: activeScope === 'BOOK' && bookId != null,
    placeholderData: keepPreviousData,
  });
  const plazaList = useInfiniteQuery({
    queryKey: plazaQuotesKey(debounced),
    queryFn: ({ pageParam }) => plazaApi.feed('QUOTE', pageParam, PAGE_SIZE, debounced),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    enabled: activeScope === 'PLAZA',
    placeholderData: keepPreviousData,
  });
  // 로딩·오류·'더 보기'는 지금 보고 있는 범위의 질의를 따른다.
  const list = activeScope === 'PLAZA' ? plazaList : activeScope === 'BOOK' ? bookList : mineList;

  // 광장은 완독 자랑이 섞여 오므로 밑줄만 골라 같은 모양으로 옮긴다 — 아래 코드는 범위를 가리지 않는다.
  const items = useMemo<BookQuote[]>(() => {
    if (activeScope === 'PLAZA') {
      return (plazaList.data?.pages ?? [])
        .flatMap((p) => p.content ?? [])
        .flatMap((item) => { const quote = plazaItemToQuote(item, myId); return quote ? [quote] : []; });
    }
    const pages = (activeScope === 'BOOK' ? bookList.data : mineList.data)?.pages ?? [];
    return pages.flatMap((p) => p.content ?? []);
  }, [activeScope, plazaList.data, bookList.data, mineList.data, myId]);

  // 상한을 다 채웠으면 더 넣을 수 없다 — 목록도 새로 오려두기도 여기서 막힌다.
  const full = selectedIds.length >= max;

  // ── 새로 오려두기 — 어느 책이든(독서 기록 없어도) 고를 수 있고, 오리면 곧바로 본문에 들어간다 ──
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
      draft.setContent('');
      draft.setPageText('');
      if (full) {
        // 상한이 차 있으면 오려두기만 하고 넣지는 않는다 — 내 밑줄 목록에는 남으니 자리를 비우고 다시 고르면 된다.
        setNotice(`${max}개가 꽉 차 붙이지 않았어요`);
        return;
      }
      setNotice(null);
      // 목록에서 고른 것과 같게 — 오리자마자 본문에 넣고 시트가 닫힌다(부모가 닫는다).
      onPick(quote);
    },
  });
  const createError = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '오려두지 못했어요 · 다시 시도'
    : null;

  // 고르면 그 자리에서 닫히므로 여기서 확정할 것이 없다 — 아무것도 고르지 않고 나가는 길일 뿐이다.
  const close = (
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="밑줄 고르기 닫기" style={styles.close}>
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>닫기</Text>
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
          <SubHeader category="밑줄 고르기" onBack={onClose} right={close} />
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

            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder="문장·책 제목으로 찾기"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel="밑줄 검색"
              style={[styles.search, webNoOutline, {
                backgroundColor: colors.surfaceRaised,
                borderColor: focused ? colors.accent : 'transparent',
                color: colors.text,
              }]}
            />

            <View style={styles.chips}>
              <Chip label="내 밑줄" active={activeScope === 'MINE'} onPress={() => setScope('MINE')} />
              {bookId != null ? (
                <Chip label="이 책" active={activeScope === 'BOOK'} onPress={() => setScope('BOOK')} />
              ) : null}
              <Chip label="광장" active={activeScope === 'PLAZA'} onPress={() => setScope('PLAZA')} />
            </View>

            {/* isLoading 이 아니라 isPending 을 본다 — 범위를 막 바꾼 한 프레임은 아직 받아오기 전(idle)이라
                isLoading 이 false 여서 '아직 없어요'가 깜빡인다. 보고 있는 범위의 질의는 항상 켜져 있다.
                isFetching 은 쓰지 않는다 — 검색어를 한 자 고칠 때마다, 배경에서 다시 받아올 때마다 참이 되어
                이미 보여 주던 목록이 통째로 스피너로 바뀐다. isPending 은 정말 보여 줄 게 없을 때만 참이고,
                검색어가 바뀌는 사이는 placeholderData 가 앞 결과를 붙들어 주므로 여기까지 오지 않는다. */}
            {list.isPending ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : list.isError && items.length === 0 ? (
              <Pressable onPress={() => list.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도" style={styles.center}>
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>밑줄을 불러오지 못했어요 · 다시 시도</Text>
              </Pressable>
            ) : items.length === 0 ? (
              // 서버가 걸러 주므로 빈 목록의 뜻은 검색어가 있느냐로 갈린다 — 찾다 못 찾은 것과 애초에 없는 것은 다른 이야기다.
              <Text style={[typeScale.caption, styles.centerText, { color: colors.textFaint }]}>
                {debounced !== ''
                  ? '찾는 문장이 없어요 · 다른 말로 찾아보세요'
                  : activeScope === 'MINE'
                    ? '아직 오려둔 문장이 없어요. 위에서 바로 오려 두세요.'
                    : activeScope === 'BOOK'
                      ? '이 책에 오려진 문장이 아직 없어요.'
                      : '광장에 올라온 문장이 아직 없어요.'}
              </Text>
            ) : (
              items.map((quote, i) => {
                const inBody = selectedIds.includes(quote.id);
                // 이미 넣은 것은 다시 넣을 수 없다(빼기는 본문에서 그 줄을 지운다). 다 채웠으면 나머지도 막힌다.
                const disabled = inBody || full;
                return (
                  <View key={quote.id} style={disabled ? styles.dim : undefined}>
                    <QuoteScrap
                      quote={quote}
                      rotate={i % 2 === 0 ? -1 : 1}
                      disabled={disabled}
                      showAuthor
                      onPress={() => onPick(quote)}
                      accessibilityRole="button"
                      accessibilityLabel={quote.content.slice(0, LABEL_CHARS)}
                      trailing={inBody ? (
                        <Text style={[typeScale.monoLabel, styles.mark, { color: colors.textFaint }]}>넣음</Text>
                      ) : null}
                    />
                  </View>
                );
              })
            )}

            {/* 새 검색어의 결과를 기다리는 동안(isPlaceholderData)에는 앞 결과를 그대로 두고 여기 스피너만 둔다 —
                '더 보기'는 아직 오지 않은 목록의 쪽 수라 눌러 봐야 어긋난다. */}
            {list.isFetchingNextPage || list.isPlaceholderData ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : list.isError && items.length > 0 ? (
              // 다음 쪽을 못 받아도 이미 펼쳐 둔 조각은 그대로 둔다 — '더 보기' 자리에 다시 시도만 놓는다.
              <Pressable
                onPress={() => (list.hasNextPage ? list.fetchNextPage() : list.refetch())}
                accessibilityRole="button"
                accessibilityLabel="밑줄 다시 불러오기"
                style={styles.center}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>불러오지 못했어요 · 다시 시도</Text>
              </Pressable>
            ) : list.hasNextPage ? (
              <Pressable
                onPress={() => list.fetchNextPage()}
                accessibilityRole="button"
                accessibilityLabel="밑줄 더 보기"
                style={styles.center}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>더 보기 →</Text>
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
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  composer: { gap: spacing.md },
  submit: {
    marginLeft: 'auto',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  // 문장 찾기 입력 — 탐색 화면 검색바와 같은 pill(포커스는 테두리로).
  search: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: sans.regular,
    fontSize: 14,
  },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  // 상자(View·Pressable)용과 글자용을 가른다 — textAlign 은 Text 에만 뜻이 있다.
  center: { paddingVertical: spacing.md, alignItems: 'center' },
  centerText: { paddingVertical: spacing.md, textAlign: 'center' },
  dim: { opacity: 0.35 },
  // 이미 넣었다는 표식 — 조각 오른쪽에 모노 한 마디. 여백으로 조각과 떨어뜨린다.
  mark: { paddingHorizontal: spacing.xs },
});
