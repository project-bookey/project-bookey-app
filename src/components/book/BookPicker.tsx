import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { bookApi, libraryApi } from '@/api/endpoints';
import { TiltCover } from '@/components/collage';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { sans } from '@/theme/tokens';

/** 책 검색 — 탐색 화면과 같은 디바운스·최소 글자 수. */
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 2;

/** 고른 책 — 내 서재 기록에서 왔으면 recordId 도 함께 담는다. */
export type PickedBook = { bookId: number; title: string; coverUrl?: string; recordId?: number };

/**
 * 책 고르기 상태 — 읽는 중인 책 빠른 선택 + 검색 후보 + 선택.
 * 광장 오려두기와 독후감 작성이 같이 쓴다. 아직 안 골랐고 검색 중도 아니면 읽는 중인 첫 책이 기본 —
 * 한 권만 읽는 사람은 바로 쓰기 시작한다. `initial` 이 있으면(수정 화면) 그 책이 기본값보다 앞선다.
 * `initial` 은 마운트 시 1회만 읽는다 — 비동기로 늦게 도착하는 책은 `pick()` 으로 넣는다.
 * `pick(null)` 로 해제하면 다시 기본값으로 돌아간다.
 */
export function useBookPicker(opts?: { initial?: PickedBook | null }): {
  keyword: string;
  setKeyword: (v: string) => void;
  candidates: PickedBook[];
  selected: PickedBook | null;
  pick: (b: PickedBook | null) => void;
  searching: boolean;
  hint: string | null;
  searchError: boolean;
  readingError: boolean;
  retrySearch: () => void;
  retryReading: () => void;
} {
  // 읽는 중인 책은 바로 고를 수 있는 빠른 선택지 — 홈·나와 같은 캐시 키라 받아 둔 목록을 재사용한다.
  const reading = useQuery({
    queryKey: ['library', 'READING'],
    queryFn: () => libraryApi.list('READING'),
  });
  const quickPicks: PickedBook[] = (reading.data?.content ?? [])
    .filter((r) => r.book?.id != null)
    .map((r) => ({ bookId: r.book!.id, title: r.book!.title, coverUrl: r.book!.coverUrl, recordId: r.id }));

  // 어떤 책이든 검색해서 고를 수 있다 — 읽는 중이 아니어도 된다(서버는 bookId 만으로 받는다).
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);
  const searching = debounced.length >= SEARCH_MIN_CHARS;
  const search = useQuery({
    queryKey: ['books', 'search', debounced],
    queryFn: () => bookApi.search(debounced),
    enabled: searching,
  });
  const results: PickedBook[] = (search.data ?? []).map((b) => ({
    bookId: b.id,
    title: b.title,
    coverUrl: b.coverUrl,
    // 검색으로 골라도 내 서재에 읽는 중 기록이 있으면 그 기록에 매단다.
    recordId: quickPicks.find((q) => q.bookId === b.id)?.recordId,
  }));

  const [picked, setPicked] = useState<PickedBook | null>(opts?.initial ?? null);
  // 아직 안 골랐고 검색 중도 아니면 읽는 중인 첫 책이 기본 — 한 권만 읽는 사람은 바로 쓰기 시작한다.
  const selected = picked ?? (searching ? null : quickPicks[0] ?? null);
  const candidates = searching ? results : quickPicks;

  // 후보 행 아래 한 줄 안내 — 상태마다 다른 말을 한다.
  const hint = searching
    ? search.isLoading ? '찾는 중…' : search.isError ? null : candidates.length === 0 ? '검색 결과가 없어요.' : null
    : reading.isLoading ? '읽는 중인 책을 찾는 중입니다.'
      : reading.isError ? null
        : candidates.length === 0 ? '읽는 중인 책이 없어요 — 위에서 책을 검색해 고르세요.' : null;

  return {
    keyword,
    setKeyword,
    candidates,
    selected,
    pick: setPicked,
    searching,
    hint,
    searchError: searching && search.isError,
    readingError: !searching && reading.isError,
    retrySearch: () => { search.refetch(); },
    retryReading: () => { reading.refetch(); },
  };
}

/**
 * 책 고르기 — 검색 입력(pill) + 후보 표지 가로 스크롤(선택 테두리) + 안내/재시도 + 고른 책 한 줄.
 * 바깥 카드는 화면마다 달라서 여기서 그리지 않고, 조각 사이 간격도 감싸는 Card 의 gap 에 맡긴다
 * (그래서 QuoteDraftFields 처럼 조각들을 Fragment 로 그대로 내보낸다).
 */
export function BookPicker({ picker, autoFocus }: {
  picker: ReturnType<typeof useBookPicker>;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const {
    keyword, setKeyword, candidates, selected, pick, hint, searchError, readingError, retrySearch, retryReading,
  } = picker;

  return (
    <>
      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder="책 제목·저자로 찾기"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel="책 검색"
        style={[styles.searchInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }]}
      />

      {candidates.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
          {candidates.map((candidate) => {
            const isPicked = selected?.bookId === candidate.bookId;
            return (
              <Pressable
                key={candidate.bookId}
                onPress={() => pick(candidate)}
                accessibilityRole="button"
                accessibilityState={{ selected: isPicked }}
                accessibilityLabel={candidate.title}
                style={[styles.pick, { borderColor: isPicked ? colors.accent : 'transparent' }]}
              >
                <TiltCover uri={candidate.coverUrl} title={candidate.title} width={52} tilt={0} entering={false} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {hint ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>{hint}</Text> : null}
      {/* 못 불러온 것과 정말 없는 것은 다른 이야기다 — 실패는 실패라고 말하고 다시 시도를 준다. */}
      {searchError ? (
        <Pressable onPress={retrySearch} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>검색에 실패했어요 · 다시 시도 →</Text>
        </Pressable>
      ) : null}
      {readingError ? (
        <Pressable onPress={retryReading} hitSlop={8} accessibilityRole="button">
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>읽는 중인 책을 불러오지 못했어요 · 다시 시도 →</Text>
        </Pressable>
      ) : null}

      {selected ? (
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.pickedLine, { color: colors.textMuted }]}>
          {selected.title}{selected.recordId != null ? ' · 내 서재' : ''}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pickRow: { gap: spacing.sm, paddingVertical: 2 },
  pick: { borderWidth: 2, borderRadius: radius.sm, padding: 2 },
  // 책 검색 입력 — 쪽수 입력과 같은 재질, pill.
  searchInput: {
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: sans.regular,
    fontSize: 14,
  },
  pickedLine: { marginTop: -spacing.xs },
});
