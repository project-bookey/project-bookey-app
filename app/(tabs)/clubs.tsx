import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { ClubCard } from '@/components/club';
import { NAV_CLEARANCE, PaperScreen } from '@/components/collage';
import { Button, EmptyState, Loading, linkLabel } from '@/components/ui';
import { layout, spacing } from '@/theme';

/**
 * 구역 4. 클럽 — 내 클럽 목록 (§F12). 광장 칩이 아니라 상단 구역 탭으로 들어온다.
 * 코드 참가·만들기는 목록 위 버튼 줄이 아니라 하단 바 옆 ＋ 단추의 메뉴가 연다(SectionNav, 사용자 결정 2026-10-05) —
 * 광장 쓰기 단추와 같은 자리. 가는 화면은 홈 클럽 줄의 '만들기'와 같다.
 */
export default function ClubsScreen() {
  const router = useRouter();
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: clubApi.myClubs });
  const { refetch } = clubs;
  const items = (clubs.data?.content ?? []).filter(Boolean);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <PaperScreen>
      {clubs.isLoading ? <Loading /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={clubs.isFetching}
        onRefresh={() => clubs.refetch()}
        ListEmptyComponent={
          clubs.isLoading ? null : clubs.isError ? (
            <EmptyState
              title="클럽을 불러오지 못했어요"
              description={clubs.error instanceof ApiError ? clubs.error.message : undefined}
              action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => clubs.refetch()} />}
            />
          ) : (
            <EmptyState
              illustration
              title="참가 중인 클럽이 없어요"
              description={'함께 읽으면 끝까지 읽기 쉬워져요.\n오른쪽 아래 버튼을 눌러 초대 코드로 참가하거나 클럽을 만들어 보세요.'}
            />
          )
        }
        renderItem={({ item }) => (
          <ClubCard
            club={item}
            onPress={() => router.push(`/club/${item.id}`)}
            // 관리는 클럽을 연 사람(호스트)만 — 서버도 CLUB_NOT_HOST 로 막는다.
            onManage={item.myRole === 'HOST' ? () => router.push(`/club/${item.id}/settings`) : undefined}
          />
        )}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // 카드 목록 — 구분선 대신 간격으로 띄운다. 위는 헤더 바로 밑이라 광장 피드와 같은 한 칸(md)을 띄우고,
  // 아래는 하단 SectionNav 높이만큼 비운다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: NAV_CLEARANCE, gap: spacing.md },
});
