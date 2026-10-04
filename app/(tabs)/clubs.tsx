import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { ClubCard } from '@/components/club';
import { NAV_CLEARANCE, PaperScreen } from '@/components/collage';
import { Button, EmptyState, Loading, linkLabel } from '@/components/ui';
import { TourTarget } from '@/components/tour/TourTarget';
import { layout, spacing } from '@/theme';

/**
 * 구역 4. 클럽 — 내 클럽 목록 (§F12). 광장 칩이 아니라 상단 구역 탭으로 들어온다.
 * 코드 참가·만들기는 목록 위 버튼이 각자의 화면을 연다 — 홈 클럽 줄의 '만들기'와 같은 길(UX 철칙 Jakob).
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
      {/* 주요 행동은 '클럽 만들기' 하나 — 코드 참가는 outline 으로 낮춰 왼쪽에 둔다(앱 공통 순서). */}
      <View style={styles.actionsFrame}>
        <TourTarget id="club-actions" style={styles.actions}>
          <Button
            label="코드로 참가"
            variant="outline"
            onPress={() => router.push('/club/join')}
            style={styles.action}
          />
          <Button label="클럽 만들기" onPress={() => router.push('/club/create')} style={styles.action} />
        </TourTarget>
      </View>

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
              description={'같은 책을 함께 읽으면 완독률이 올라갑니다.\n위에서 코드로 참가하거나 클럽을 만들어 보세요.'}
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
  // 여백은 바깥 틀에 둔다 — 둘러보기 대상(actions)이 두 버튼만 감싸게.
  actionsFrame: { ...layout.content, padding: spacing.lg },
  // 두 버튼은 같은 폭 — 서로 다른 동작이라 sm 이상 띄운다(오터치 방지).
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  // 카드 목록 — 구분선 대신 간격으로 띄운다. 아래는 하단 SectionNav 높이만큼 비운다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: NAV_CLEARANCE, gap: spacing.md },
});
