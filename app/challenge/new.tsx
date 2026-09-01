import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, challengeApi, libraryApi } from '@/api/endpoints';
import type { BookSummary } from '@/api/types';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 책 선택 상태 — "읽는 중" 목록에서 고르거나(record) 검색으로 아무 책이나 고른다(book). */
type Pick =
  | { kind: 'record'; recordId: number; title: string }
  | { kind: 'book'; bookId: number; title: string }
  | null;

/** 새 챌린지 — 읽는 중 책 선택 또는 검색으로 책 선택 + 예산(시간·분) 입력. 재도전 프리필 지원. */
export default function NewChallengeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ recordId?: string; budgetSec?: string }>();

  const [pick, setPick] = useState<Pick>(
    params.recordId ? { kind: 'record', recordId: Number(params.recordId), title: '' } : null,
  );
  const preBudget = params.budgetSec ? Number(params.budgetSec) : 0;
  const [hours, setHours] = useState(preBudget ? String(Math.floor(preBudget / 3600)) : '');
  const [minutes, setMinutes] = useState(preBudget ? String(Math.floor((preBudget % 3600) / 60)) : '');

  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);

  // 400ms 디바운스 — 입력이 멈추면 검색어 확정 (검색 화면과 같은 문법)
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(input.trim()), 400);
    return () => clearTimeout(timer);
  }, [input]);

  const searching = keyword.length >= 2;
  const search = useQuery({
    queryKey: ['books', keyword],
    queryFn: () => bookApi.search(keyword),
    enabled: searching,
  });
  const searchResults = search.data ?? [];

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const records = reading.data?.content ?? [];

  // 재도전 프리필은 recordId만 넘어오므로 목록이 로드되면 표시용 제목을 채워넣는다.
  useEffect(() => {
    if (pick?.kind === 'record' && !pick.title) {
      const match = records.find((r) => r.id === pick.recordId);
      if (match?.book?.title) {
        setPick({ kind: 'record', recordId: pick.recordId, title: match.book.title });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  const budgetSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
  const valid = pick != null && budgetSec >= 600;

  const create = useMutation({
    mutationFn: () =>
      challengeApi.create(
        pick!.kind === 'record'
          ? { readingRecordId: pick!.recordId, budgetSec }
          : { bookId: pick!.bookId, budgetSec },
      ),
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      router.replace(`/challenge/${challenge.id}`);
    },
  });
  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError ? create.error.message : '만들지 못했어요 · 다시 시도'
      : null;

  const footer = (
    <View style={styles.footer}>
      {pick ? (
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>선택: {pick.title}</Text>
      ) : null}
      <Text style={[typeScale.section, { color: colors.text }]}>예산 시간</Text>
      <View style={styles.budgetRow}>
        <TextInput
          value={hours}
          onChangeText={(t) => setHours(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
        />
        <Text style={[typeScale.body, { color: colors.textMuted }]}>시간</Text>
        <TextInput
          value={minutes}
          onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={[styles.budgetInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
        />
        <Text style={[typeScale.body, { color: colors.textMuted }]}>분</Text>
      </View>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>최소 10분부터 시작할 수 있어요.</Text>
      {errorMessage ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
      ) : null}
      <Pressable
        disabled={!valid || create.isPending}
        onPress={() => create.mutate()}
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: colors.accent, opacity: !valid || create.isPending ? 0.5 : 1 }]}
      >
        <Text style={[typeScale.label, { color: colors.onAccent }]}>
          {create.isPending ? '만드는 중…' : '⏱ 챌린지 시작'}
        </Text>
      </Pressable>
    </View>
  );

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
            placeholder="제목 · 저자 · ISBN으로 검색"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      {searching ? (
        <FlatList
          data={search.isLoading ? [] : searchResults}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            search.isLoading ? null : (
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>검색 결과가 없어요.</Text>
            )
          }
          renderItem={({ item }) => (
            <SearchResultRow
              book={item}
              selected={pick?.kind === 'book' && pick.bookId === item.id}
              onPress={() => setPick({ kind: 'book', bookId: item.id, title: item.title })}
            />
          )}
          ListFooterComponent={footer}
        />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[typeScale.section, { color: colors.text, marginBottom: spacing.sm }]}>
              어떤 책으로 도전할까요?
            </Text>
          }
          ListEmptyComponent={
            reading.isLoading ? null : (
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                읽는 중인 책이 없어요. 위에서 검색해 책을 골라도 돼요.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const selected = pick?.kind === 'record' && pick.recordId === item.id;
            return (
              <Pressable
                onPress={() =>
                  setPick({ kind: 'record', recordId: item.id, title: item.book?.title ?? '' })
                }
                accessibilityRole="button"
                accessibilityLabel={item.book?.title ?? '책'}
                style={[
                  styles.row,
                  { backgroundColor: colors.surface },
                  selected && { borderWidth: 1, borderColor: colors.accent },
                ]}
              >
                <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
                  {item.book?.coverUrl ? (
                    <Image source={{ uri: item.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
                    {item.book?.title}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                    {item.progress.currentPage}/{item.progress.totalPages}쪽
                  </Text>
                </View>
                {selected ? <Text style={[typeScale.label, { color: colors.accent }]}>✓</Text> : null}
              </Pressable>
            );
          }}
          ListFooterComponent={footer}
        />
      )}
    </View>
  );
}

/** 검색 결과 행 — 총쪽수가 없으면 완독 판정이 불가하므로 선택을 막는다(서버도 동일하게 거부). */
function SearchResultRow({
  book,
  selected,
  onPress,
}: {
  book: BookSummary;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const disabled = book.totalPages == null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={book.title}
      style={[
        styles.row,
        { backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 },
        selected && { borderWidth: 1, borderColor: colors.accent },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
        {book.coverUrl ? (
          <Image source={{ uri: book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
          {book.title}
        </Text>
        <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
          {book.author ?? '저자 미상'}
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
      </View>
      {selected ? <Text style={[typeScale.label, { color: colors.accent }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBarWrap: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: spacing.md },
  list: { ...layout.content, padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cover: { width: 40, height: 60, borderRadius: radius.sm, overflow: 'hidden' },
  pageTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetInput: {
    width: 72,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 18,
    textAlign: 'center',
  },
  cta: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
});
