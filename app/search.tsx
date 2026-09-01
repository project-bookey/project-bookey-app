import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextStyle,
} from 'react-native';

import { bookApi, libraryApi } from '@/api/endpoints';
import type { BookSummary, ReadingStatus } from '@/api/types';
import { BookRow, RowBook } from '@/components/home/BookRow';
import type { ColorTokens } from '@/theme';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

// 웹 전용: 브라우저 기본 포커스 링 제거 — outline-style이 auto인 한 outline-width:0은 무시된다.
// RN 타입에 'none'이 없어 캐스팅하지만 RNW는 CSS outline-style로 그대로 전달한다.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** 도서 검색 — 디바운스 실시간 검색 + 초기 탐색 행 + 3상태 담기 (검색 리디자인 스펙) */
export default function SearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  /** 포커스 표시는 input 자체(웹 기본 outline) 대신 검색바 컨테이너 보더로 그린다. */
  const [focused, setFocused] = useState(false);
  /** 담기 칩이 열려 있는 행의 책 id — 한 번에 한 행만 연다. */
  const [openAddId, setOpenAddId] = useState<number | null>(null);
  /** 이 세션에서 담기 완료한 책 id — '담김 ✓' 표시용. */
  const [addedIds, setAddedIds] = useState<ReadonlySet<number>>(new Set());
  /** 담기 실패한 책 id — 실패 메시지 표시용. */
  const [failedId, setFailedId] = useState<number | null>(null);

  // 400ms 디바운스 — 입력이 멈추면 검색어 확정
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(input.trim());
      setOpenAddId(null);
      setFailedId(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [input]);

  const searching = keyword.length >= 2;
  const search = useQuery({
    queryKey: ['books', keyword],
    queryFn: () => bookApi.search(keyword),
    enabled: searching,
  });
  // 초기 탐색 행 — 홈과 같은 키라 캐시를 공유한다
  const popular = useQuery({ queryKey: ['home', 'popular'], queryFn: () => bookApi.popular() });
  const recommended = useQuery({ queryKey: ['home', 'recommended'], queryFn: () => bookApi.recommended() });

  const add = useMutation({
    mutationFn: ({ book, status }: { book: BookSummary; status: ReadingStatus }) =>
      libraryApi.add({ bookId: book.id, status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setAddedIds((prev) => new Set(prev).add(vars.book.id));
      setOpenAddId(null);
      setFailedId(null);
    },
    // 실패 시 실패 상태 저장 후 칩 종료 — 사용자에게 안내 표시
    onError: (_err, vars) => {
      setFailedId(vars.book.id);
      setOpenAddId(null);
    },
  });

  const openBook = (b: RowBook) => {
    if (b.bookId != null) {
      router.push(`/book/${b.bookId}`);
    }
  };

  const results = search.data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.searchBarWrap}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: focused ? colors.accent : 'transparent',
            },
          ]}
        >
          <Text style={[typeScale.body, { color: colors.textFaint }]}>⌕</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="제목 · 저자 · ISBN"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            autoFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, webNoOutline, { color: colors.text }]}
          />
        </View>
      </View>

      {!searching ? (
        <ScrollView contentContainerStyle={styles.explore}>
          <BookRow
            title="추천"
            loading={recommended.isLoading}
            books={(recommended.data ?? []).map((b): RowBook => ({
              key: `pick-${b.id}`, bookId: b.id, title: b.title, coverUrl: b.coverUrl,
            }))}
            onPressBook={openBook}
          />
          <BookRow
            title="인기"
            loading={popular.isLoading}
            books={(popular.data ?? []).map((p, i): RowBook => ({
              key: `popular-${p.book.id}`, bookId: p.book.id, title: p.book.title,
              coverUrl: p.book.coverUrl, rank: i + 1,
            }))}
            onPressBook={openBook}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={search.isLoading ? [] : results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            search.isLoading ? (
              <View>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.row}>
                    <View style={[styles.cover, { backgroundColor: colors.surface }]} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={[typeScale.bodyStrong, { color: colors.text }]}>결과가 없어요</Text>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                  다른 검색어로 시도해보세요.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <ResultRow
              book={item}
              colors={colors}
              choosing={openAddId === item.id}
              added={addedIds.has(item.id)}
              failed={failedId === item.id}
              pending={add.isPending && add.variables?.book.id === item.id}
              onPress={() => router.push(`/book/${item.id}`)}
              onOpenAdd={() => {
                setOpenAddId(item.id);
                setFailedId(null);
              }}
              onPick={(status) => add.mutate({ book: item, status })}
            />
          )}
        />
      )}
    </View>
  );
}

/** 결과 행 — 우측 담기 영역은 담기 → 상태 칩 2개 → 담김 ✓ 의 3상태. */
function ResultRow({ book, colors, choosing, added, failed, pending, onPress, onOpenAdd, onPick }: {
  book: BookSummary;
  colors: ColorTokens;
  choosing: boolean;
  added: boolean;
  failed: boolean;
  pending: boolean;
  onPress: () => void;
  onOpenAdd: () => void;
  onPick: (status: ReadingStatus) => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={book.title}
      >
        <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
          {book.coverUrl ? (
            <Image source={{ uri: book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text numberOfLines={3} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
              {book.title}
            </Text>
          )}
        </View>

        <View style={styles.rowBody}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: colors.text }]}>
            {book.title}
          </Text>
          <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
            {book.author ?? '저자 미상'}
            {book.publisher ? ` · ${book.publisher}` : ''}
          </Text>
          {book.totalPages ? (
            <View style={[styles.pageTag, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[typeScale.overline, { color: colors.textMuted }]}>{book.totalPages}쪽</Text>
            </View>
          ) : (
            <View style={[styles.pageTag, { backgroundColor: colors.warnSoft }]}>
              <Text style={[typeScale.overline, { color: colors.warn }]}>쪽수 없음</Text>
            </View>
          )}
          {failed ? <Text style={[typeScale.caption, { color: colors.warn }]}>담지 못했어요 · 다시 시도</Text> : null}
        </View>
      </Pressable>

      {added ? (
        <Text style={[typeScale.label, { color: colors.textFaint }]}>담김 ✓</Text>
      ) : choosing ? (
        <View style={styles.chips}>
          {(
            [
              { status: 'READING', label: '읽는 중' },
              { status: 'WANT_TO_READ', label: '읽고 싶은' },
            ] as const
          ).map((c) => (
            <Pressable
              key={c.status}
              disabled={pending}
              onPress={() => onPick(c.status)}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              style={[styles.chip, { backgroundColor: colors.accentSoft, opacity: pending ? 0.5 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.accent }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={onOpenAdd}
          accessibilityRole="button"
          accessibilityLabel="담기"
          style={[styles.addButton, { borderColor: colors.accent }]}
        >
          <Text style={[typeScale.label, { color: colors.accent }]}>담기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBarWrap: { ...layout.content, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing.md },
  explore: { ...layout.content, gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  cover: { width: 52, height: 78, borderRadius: radius.sm, overflow: 'hidden' },
  coverFallback: { padding: spacing.xs },
  rowBody: { flex: 1, gap: 3 },
  pageTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  chips: { gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
});
