import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ApiError } from '@/api/client';
import { clubNoteApi } from '@/api/endpoints';
import type { ClubNotePageSummary } from '@/api/types';
import { ClubTabs, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import { NoteFeedCard } from '@/components/clubNote/NoteFeedCard';
import { clubNoteKeys, useNotebook } from '@/components/clubNote/queries';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

/**
 * 모두의 노트 — 모임 멤버들이 만든 페이지를 피드로 본다(최근에 고친 것부터). 카드를 누르면 그 페이지를 열어 이어서 꾸민다.
 * 페이지는 만든 사람 이름을 달고 있지만 편집은 멤버 누구나 할 수 있다.
 */
export default function ClubNotebookFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const notebook = useNotebook(clubId);
  const readOnly = notebook.data?.readOnly ?? false;
  const pages = useMemo(
    () => [...(notebook.data?.pages ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : b.seq - a.seq)),
    [notebook.data],
  );
  const cardWidth = Math.min(windowWidth, layout.content.maxWidth) - spacing.lg * 2;

  const openPage = (pageId: number) =>
    router.push({ pathname: '/club/[id]/notebook/[pageId]', params: { id: String(clubId), pageId: String(pageId) } });

  const createPage = useMutation({
    mutationFn: () => clubNoteApi.createPage(clubId),
    onSuccess: async (page) => {
      qc.setQueryData(clubNoteKeys.page(clubId, page.id), page);
      await qc.invalidateQueries({ queryKey: clubNoteKeys.list(clubId) });
      openPage(page.id);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : '페이지를 만들지 못했어요'),
  });

  const renderItem = ({ item }: { item: ClubNotePageSummary }) => (
    <NoteFeedCard clubId={clubId} summary={item} width={cardWidth} onPress={() => openPage(item.id)} />
  );

  return (
    <PaperScreen>
      <SubHeader
        category="노트"
        right={readOnly ? undefined : (
          <Button label="새 페이지" size="sm" variant="ghost" onPress={() => createPage.mutate()} loading={createPage.isPending} />
        )}
      />
      <ClubTabs clubId={clubId} active="notebook" />
      {notebook.isLoading ? (
        <Loading />
      ) : notebook.isError ? (
        <EmptyState
          title="노트를 불러오지 못했어요"
          description={notebook.error instanceof ApiError ? notebook.error.message : undefined}
          action={<Button label="다시 시도" variant="outline" onPress={() => notebook.refetch()} />}
        />
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          ListHeaderComponent={
            pages.length > 0 ? (
              <Text style={[typeScale.monoLabel, styles.count, { color: colors.textFaint }]}>
                모두의 노트 · {pages.length}장
              </Text>
            ) : null
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
          initialNumToRender={2}
          showsVerticalScrollIndicator={false}
        />
      )}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, padding: spacing.lg, paddingBottom: spacing.xxl },
  gap: { height: spacing.xl },
  count: { marginBottom: spacing.md },
});
