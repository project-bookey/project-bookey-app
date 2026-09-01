# 검색 화면 OTT 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 화면을 스펙(`docs/superpowers/specs/2026-09-01-search-redesign-design.md`)대로 디바운스 실시간 검색 + 초기 인기·추천 행 + 3상태 담기(담기 → 상태 칩 → 담김 ✓)로 재작성한다.

**Architecture:** `app/search.tsx` 단일 파일 전면 재작성 — 검색 바·결과 행은 화면 전용 로컬 컴포넌트, 초기 탐색 행은 `@/components/home/BookRow` 재사용(쿼리 키까지 홈과 공유해 캐시 재사용). 디바운스는 `useEffect`+`setTimeout`, 담기는 한 번에 한 행만 칩 상태가 열리는 단일 `openAddId` 상태로 관리한다.

**Tech Stack:** Expo(RN) + TypeScript strict + react-query. 새 의존성 없음.

## Global Constraints

- **커밋 규칙 (CLAUDE.md + 커밋 스타일)**: AI 어트리뷰션 일절 금지. 메시지 첫 줄에 "신규:"/"수정:" 접두 + 한국어 요약.
- 재작성 파일에서 레거시 테마 export·레거시 UI 컴포넌트(`Screen`, `EmptyState`, `Loading`, `Button`, `Tag`, `BookCover`, `Segmented`) 사용 금지. 허용: 새 토큰 API + `@/components/home/BookRow`.
- 검색 쿼리 키 `['books', keyword]` 유지. 초기 행 쿼리 키는 홈과 동일하게 `['home', 'popular']` / `['home', 'recommended']` (캐시 공유 — 변경 금지).
- 담기 성공 후 `router.back()` 호출 금지 (연속 담기). `['library']` invalidate 필수.
- 검증 게이트: `npm run typecheck` exit 0 + 레거시 import grep 무매치.

---

### Task 1: search.tsx 전면 재작성

**Files:**
- Modify: `app/search.tsx` (전체 교체)

**Interfaces:**
- Consumes: `bookApi.search/popular/recommended`, `libraryApi.add({ bookId, status })`, `BookSummary`·`ReadingStatus`(`@/api/types`), `BookRow`/`RowBook`(`@/components/home/BookRow`), 새 토큰 API
- Produces: 최종 검색 화면 (외부 소비자 없음)

- [ ] **Step 1: search.tsx 전체 교체**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { bookApi, libraryApi } from '@/api/endpoints';
import type { BookSummary, ReadingStatus } from '@/api/types';
import { BookRow, RowBook } from '@/components/home/BookRow';
import type { ColorTokens } from '@/theme';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 도서 검색 — 디바운스 실시간 검색 + 초기 탐색 행 + 3상태 담기 (검색 리디자인 스펙) */
export default function SearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  /** 담기 칩이 열려 있는 행의 책 id — 한 번에 한 행만 연다. */
  const [openAddId, setOpenAddId] = useState<number | null>(null);
  /** 이 세션에서 담기 완료한 책 id — '담김 ✓' 표시용. */
  const [addedIds, setAddedIds] = useState<ReadonlySet<number>>(new Set());

  // 400ms 디바운스 — 입력이 멈추면 검색어 확정
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
    },
    // 실패 시 칩을 닫아 '담기' 버튼으로 복귀 — 다시 시도할 수 있다
    onError: () => setOpenAddId(null),
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
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={[typeScale.body, { color: colors.textFaint }]}>⌕</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="제목 · 저자 · ISBN"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            autoFocus
            style={[styles.input, { color: colors.text }]}
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
              pending={add.isPending && add.variables?.book.id === item.id}
              onPress={() => router.push(`/book/${item.id}`)}
              onOpenAdd={() => setOpenAddId(item.id)}
              onPick={(status) => add.mutate({ book: item, status })}
            />
          )}
        />
      )}
    </View>
  );
}

/** 결과 행 — 우측 담기 영역은 담기 → 상태 칩 2개 → 담김 ✓ 의 3상태. */
function ResultRow({ book, colors, choosing, added, pending, onPress, onOpenAdd, onPick }: {
  book: BookSummary;
  colors: ColorTokens;
  choosing: boolean;
  added: boolean;
  pending: boolean;
  onPress: () => void;
  onOpenAdd: () => void;
  onPick: (status: ReadingStatus) => void;
}) {
  return (
    <Pressable
      style={styles.row}
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
      </View>

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
    </Pressable>
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
```

- [ ] **Step 2: 타입 검사 + 레거시 import 검증**

Run: `npm run typecheck`
Expected: exit 0.

Run: `grep -nE "colors,|lagStyle|fonts|EmptyState|BookCover|Screen,|Button,|Tag" app/search.tsx`
Expected: 매치 없음.

- [ ] **Step 3: 커밋**

```bash
git add app/search.tsx
git commit -m "수정: 검색 화면을 OTT 문법으로 재작성

디바운스 실시간 검색(400ms·최소 2자), 초기 인기·추천 행,
행 탭=도서 상세, 담기는 상태 칩(읽는 중/읽고 싶은) 3상태로 분리"
```

---

### Task 2: 육안 검증 (컨트롤러 수행)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 웹 육안 검증**

웹(8083)에서:
1. 진입 시 인기·추천 행 노출, 표지 탭 → 도서 상세
2. 2자 이상 입력 후 400ms — 자동 검색, 1자는 무시
3. 행 탭 → 도서 상세 / "담기" → 칩 2개 → 선택 → "담김 ✓", 화면 유지
4. 서재 탭에서 담은 책 반영 확인
5. 결과 없음 문구, 다크/라이트
