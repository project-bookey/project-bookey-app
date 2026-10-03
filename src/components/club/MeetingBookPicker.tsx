import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { libraryApi } from '@/api/endpoints';
import type { BookSummary } from '@/api/types';
import { TiltCover } from '@/components/collage';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button, Loading, linkLabel } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';

/**
 * 모임 책 고르기 — 내 서재의 책 하나를 고르는 아래 시트. 고르면 바로 닫힌다.
 * 모임 책은 선택이라, 이미 고른 책이 있으면 '책 없이'로 비울 수 있다.
 */
export function MeetingBookPicker({ visible, selectedId, onSelect, onClose }: {
  visible: boolean;
  selectedId: number | null;
  onSelect: (book: BookSummary | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const library = useQuery({ queryKey: ['library', 'all'], queryFn: () => libraryApi.list(), enabled: visible });
  // 같은 책을 여러 번 읽었어도 한 줄만.
  const books = useMemo(() => {
    const byId = new Map<number, BookSummary>();
    for (const record of library.data?.content ?? []) {
      if (record.book && !byId.has(record.book.id)) byId.set(record.book.id, record.book);
    }
    return [...byId.values()];
  }, [library.data?.content]);

  const pick = (book: BookSummary | null) => {
    onSelect(book);
    onClose();
  };

  return (
    <NoteSheet visible={visible} title="모임 책" onClose={onClose}>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>내 서재의 책 중에서 고릅니다.</Text>
      <View style={[styles.list, { borderColor: colors.line }]}>
        <FlatList
          data={books}
          extraData={selectedId}
          keyExtractor={(book) => String(book.id)}
          renderItem={({ item: book }) => {
            const selected = book.id === selectedId;
            return (
              <Pressable
                onPress={() => pick(book)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={book.title}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderBottomColor: colors.line,
                    backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                  },
                  pressed ? pressedStyle : null,
                ]}
              >
                <TiltCover uri={book.coverUrl} title={book.title} width={38} tilt={0} entering={false} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typeScale.label, { color: colors.text }]}>{book.title}</Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>
                    {book.totalPages ? `${book.totalPages}쪽` : '페이지 수 미상'}
                    {book.author ? ` · ${book.author}` : ''}
                  </Text>
                </View>
                {/* 선택은 잉크로 반전(앱 공통 라디오) — 악센트는 CTA 몫. */}
                <View
                  style={[
                    styles.radio,
                    selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.textFaint },
                  ]}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            library.isLoading ? (
              <View style={styles.pending}>
                <Loading />
              </View>
            ) : library.isError ? (
              <View style={styles.emptyRow}>
                <Text style={[typeScale.caption, styles.emptyText, { color: colors.textMuted }]}>
                  서재를 불러오지 못했어요.
                </Text>
                <Button label={linkLabel('다시 시도', 'action')} variant="ghost" onPress={() => library.refetch()} />
              </View>
            ) : (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                서재가 비어 있어요. 먼저 책을 검색해 담아주세요.
              </Text>
            )
          }
        />
      </View>
      {selectedId != null ? <Button label="책 없이" variant="outline" onPress={() => pick(null)} /> : null}
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  // 시트 안에서 목록만 스크롤한다 — 서재가 길어도 시트가 화면을 넘지 않게.
  list: { maxHeight: 360, borderWidth: hairline, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: hairline,
  },
  meta: { ...typeScale.caption, marginTop: 2 },
  radio: { width: 16, height: 16, borderRadius: radius.round, borderWidth: hairline },
  empty: { ...typeScale.caption, padding: spacing.lg },
  pending: { padding: spacing.lg },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  emptyText: { flexShrink: 1 },
});
