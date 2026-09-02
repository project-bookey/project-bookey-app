import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextStyle,
} from 'react-native';

import { bookApi, libraryApi } from '@/api/endpoints';
import type { BookSummary, ReadingStatus } from '@/api/types';
import { Chip, MemoScrap, PaperScreen, SectionNav, TiltCover } from '@/components/collage';
import { BookRow, RowBook } from '@/components/home/BookRow';
import type { ColorTokens } from '@/theme';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

// 웹 전용: 브라우저 기본 포커스 링 제거 — outline-style이 auto인 한 outline-width:0은 무시된다.
// RN 타입에 'none'이 없어 캐스팅하지만 RNW는 CSS outline-style로 그대로 전달한다.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/**
 * '상황으로' 무드 칩 — 클라이언트 고정 매핑(서버 태그 연동 전 임시).
 * 탭하면 query 문자열을 입력창에 그대로 채워 기존 디바운스 검색 흐름을 그대로 탄다.
 */
const MOOD_QUERIES: ReadonlyArray<{ label: string; query: string }> = [
  { label: '잠들기 전', query: '에세이' },
  { label: '출퇴근 40분', query: '단편소설' },
  { label: '울고 싶을 때', query: '위로' },
  { label: '머리 식히기', query: '추리소설' },
  { label: '면접 전날', query: '자기계발' },
  { label: '비 오는 날', query: '고전' },
];

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

  // '오늘의 한 칸' — 추천 캐시에서 날짜 시드로 고정한 하루 한 권(자정마다 바뀐다).
  const recommendedList = recommended.data ?? [];
  const todaySeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const todayPick = recommendedList.length > 0 ? recommendedList[todaySeed % recommendedList.length] : null;

  return (
    <PaperScreen>
      <SectionNav active="explore" />
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
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>⌕</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder='제목, 저자, 혹은 "요즘 좀 지친다"'
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            autoFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, webNoOutline, { color: colors.text }]}
          />
        </View>
      </View>

      {/* autoFocus로 키보드가 열린 상태에서도 책 탭이 먹히도록 — 기본값 'never'는 첫 탭을 키보드 닫기로만 소모한다 */}
      {!searching ? (
        <ScrollView contentContainerStyle={styles.explore} keyboardShouldPersistTaps="handled">
          <View style={styles.moodSection}>
            <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>상황으로</Text>
            <View style={styles.moodChips}>
              {MOOD_QUERIES.map((mood) => (
                <Chip key={mood.label} label={mood.label} onPress={() => setInput(mood.query)} />
              ))}
            </View>
          </View>

          {todayPick ? (
            <TodayPick book={todayPick} onPress={() => router.push(`/book/${todayPick.id}`)} />
          ) : null}

          <BookRow
            title="서점 직원이 골랐습니다"
            staggered
            loading={recommended.isLoading}
            books={(recommended.data ?? []).map((b): RowBook => ({
              key: `pick-${b.id}`, bookId: b.id, title: b.title, author: b.author, coverUrl: b.coverUrl,
            }))}
            onPressBook={openBook}
          />
          <BookRow
            title="지금 붐비는 책"
            loading={popular.isLoading}
            books={(popular.data ?? []).map((p, i): RowBook => ({
              key: `popular-${p.book.id}`, bookId: p.book.id, title: p.book.title,
              author: p.book.author, coverUrl: p.book.coverUrl, rank: i + 1,
            }))}
            onPressBook={openBook}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={search.isLoading ? [] : results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            search.isLoading ? (
              <View>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.row}>
                    <View style={[styles.skeletonCover, { backgroundColor: colors.surface }]} />
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
    </PaperScreen>
  );
}

/**
 * '오늘의 한 칸' — 오려 붙인 메모 조각에 오늘의 추천 한 권을 얹는다.
 * 표지 탭만 상세로 이동한다(카드 전체는 눌리지 않는다 — 중첩 프레서블 방지).
 */
function TodayPick({ book, onPress }: { book: BookSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const timeLine = book.totalPages
    ? `약 ${Math.max(1, Math.round(book.totalPages / 150))}시간이면 끝납니다`
    : '가볍게 펼쳐보기 좋은 책';

  return (
    <View style={styles.todayWrap}>
      <MemoScrap rotate={-1.5} style={styles.todayCard}>
        <View style={styles.todayHeader}>
          <Text style={[styles.todayTitle, { color: colors.text }]}>오늘의 한 칸</Text>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>랜덤</Text>
        </View>
        <View style={styles.todayBody}>
          <TiltCover
            uri={book.coverUrl}
            title={book.title}
            width={66}
            stacked
            entering={false}
            onPress={onPress}
            accessibilityLabel={`${book.title} 상세`}
          />
          <View style={styles.todayInfo}>
            <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: colors.text }]}>
              {book.title}
            </Text>
            <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
              {book.author ?? '저자 미상'}
              {book.totalPages ? ` · ${book.totalPages}쪽` : ''}
            </Text>
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{timeLine}</Text>
          </View>
        </View>
      </MemoScrap>
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
        <TiltCover uri={book.coverUrl} title={book.title} width={52} tilt={0} entering={false} />

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
        <Chip label="담김 ✓" active />
      ) : choosing ? (
        <View style={styles.chipGroup}>
          {(
            [
              { status: 'READING', label: '읽는 중' },
              { status: 'WANT_TO_READ', label: '읽고 싶은' },
            ] as const
          ).map((c) => (
            <Chip key={c.status} label={c.label} disabled={pending} onPress={() => onPick(c.status)} />
          ))}
        </View>
      ) : (
        <Chip label="담기" onPress={onOpenAdd} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBarWrap: { ...layout.content, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing.md },
  explore: { ...layout.content, gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  moodSection: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  moodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  todayWrap: { paddingHorizontal: spacing.lg },
  todayCard: { gap: spacing.md },
  todayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  todayTitle: { fontFamily: serif.bold, fontSize: 17, lineHeight: 24 },
  todayBody: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  todayInfo: { flex: 1, gap: 4, paddingTop: spacing.xs },
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
  skeletonCover: { width: 52, height: 78, borderRadius: radius.sm },
  rowBody: { flex: 1, gap: 3 },
  pageTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  chipGroup: { gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
});
