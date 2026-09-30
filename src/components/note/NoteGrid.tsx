import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ApiError } from '@/api/client';
import { clubNoteApi } from '@/api/endpoints';
import type { ClubNotePageSummary } from '@/api/types';
import { notify } from '@/components/club';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { NoteCanvas, pageHeightFor } from './NoteCanvas';
import { parseDoc } from './noteDoc';
import { clubNoteKeys, useNotebook, useNotePageQuery } from './queries';

const COLUMNS = 3;
const GAP = spacing.xs;

/**
 * 모두의 노트 — 인스타 프로필처럼 3열 격자. 칸 하나가 페이지 하나(3:4 미리보기 + 만든 사람 아바타).
 * 칸을 누르면 크게 보는 화면으로, '새 페이지' 는 만들자마자 작성 화면으로 간다. 모임 홈의 노트 탭 안에 산다.
 */
export function NoteGrid({ clubId }: { clubId: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const notebook = useNotebook(clubId);
  const readOnly = notebook.data?.readOnly ?? false;
  const pages = useMemo(
    () => [...(notebook.data?.pages ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : b.seq - a.seq)),
    [notebook.data],
  );
  const contentWidth = Math.min(width, layout.content.maxWidth);
  const cell = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);
  const id = String(clubId);

  const open = (pageId: number, edit = false) =>
    router.push({ pathname: '/club/[id]/notebook/[pageId]', params: edit ? { id, pageId: String(pageId), edit: '1' } : { id, pageId: String(pageId) } });

  const createPage = useMutation({
    mutationFn: () => clubNoteApi.createPage(clubId),
    onSuccess: async (page) => {
      qc.setQueryData(clubNoteKeys.page(clubId, page.id), page);
      await qc.invalidateQueries({ queryKey: clubNoteKeys.list(clubId) });
      open(page.id, true);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '페이지를 만들지 못했어요'),
  });

  if (notebook.isLoading) return <Loading />;
  if (notebook.isError) {
    return (
      <EmptyState
        title="노트를 불러오지 못했어요"
        description={notebook.error instanceof ApiError ? notebook.error.message : undefined}
        action={<Button label="다시 시도" variant="outline" onPress={() => notebook.refetch()} />}
      />
    );
  }

  return (
    <FlatList
      data={pages}
      key={COLUMNS}
      numColumns={COLUMNS}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <NoteGridCell clubId={clubId} summary={item} width={cell} onPress={() => open(item.id)} />}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모두의 노트 · {pages.length}장</Text>
          {!readOnly ? (
            <Button label="새 페이지" size="sm" variant="ghost" onPress={() => createPage.mutate()} loading={createPage.isPending} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="아직 노트가 없어요"
          description={readOnly ? '끝난 모임이라 새 페이지를 만들 수 없어요.' : '첫 페이지를 만들고 그날의 사진과 대화를 붙여 보세요.'}
          action={readOnly ? undefined : (
            <Button label="첫 페이지 만들기" onPress={() => createPage.mutate()} loading={createPage.isPending} />
          )}
        />
      }
      windowSize={5}
      initialNumToRender={9}
      showsVerticalScrollIndicator={false}
    />
  );
}

/** 격자 한 칸 — 페이지 미리보기 위에 만든 사람 아바타. 문서는 칸마다 받아 그린다(캐시는 보기·작성 화면과 공유). */
function NoteGridCell({ clubId, summary, width, onPress }: {
  clubId: number;
  summary: ClubNotePageSummary;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const page = useNotePageQuery(clubId, summary.id);
  const doc = useMemo(() => (page.data ? parseDoc(page.data.document) : null), [page.data]);
  const author = page.data?.createdBy ?? summary.updatedBy ?? null;
  const title = summary.title && summary.title.length > 0 ? summary.title : `${summary.seq}쪽`;
  const height = pageHeightFor(width);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} 크게 보기`}
      style={({ pressed }) => [styles.cell, { width, height }, pressed ? pressedStyle : null]}
    >
      {doc ? (
        <NoteCanvas doc={doc} width={width} />
      ) : (
        <View style={[styles.placeholder, { width, height, backgroundColor: colors.surface, borderColor: colors.line }]} />
      )}
      {author ? (
        <View style={styles.author} pointerEvents="none">
          <QuoteAvatar uri={author.avatarUrl} nickname={author.nickname} size={20} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: GAP },
  row: { gap: GAP },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: GAP,
    borderBottomWidth: hairline,
  },
  cell: { overflow: 'hidden', borderRadius: radius.sm },
  placeholder: { borderWidth: hairline, borderRadius: radius.sm },
  author: { position: 'absolute', left: spacing.xs, top: spacing.xs },
});
