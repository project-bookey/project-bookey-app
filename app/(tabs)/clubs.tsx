import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { ClubCard } from '@/components/club';
import { BrandHeader, PaperScreen } from '@/components/collage';
import { Button, EmptyState, Loading } from '@/components/ui';
import { TourTarget } from '@/components/tour/TourTarget';
import { SwipeableTabs } from '@/components/SwipeableTabs';
import { layout, spacing } from '@/theme';
import { ClubCreateContent } from '../club/create';
import { ClubJoinContent } from '../club/join';

type ClubView = 'list' | 'join' | 'create';
const CLUB_VIEWS: readonly ClubView[] = ['list', 'join', 'create'];

/** 구역 4. 모임 — 내 모임 · 코드 참가 · 만들기 (§F12). 광장 칩이 아니라 상단 구역 탭으로 들어온다. */
export default function ClubsScreen() {
  const router = useRouter();
  const [view, setView] = useState<ClubView>('list');
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: clubApi.myClubs });
  const { refetch } = clubs;
  const items = (clubs.data?.content ?? []).filter(Boolean);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <PaperScreen withTopInset>
      <BrandHeader />

      <TourTarget id="club-actions" style={styles.actions}>
        <Button
          label="내 모임"
          size="sm"
          variant={view === 'list' ? 'primary' : 'outline'}
          style={{ flex: 1 }}
          onPress={() => setView('list')}
        />
        <Button
          label="코드로 참가"
          size="sm"
          variant={view === 'join' ? 'primary' : 'outline'}
          style={{ flex: 1 }}
          onPress={() => setView('join')}
        />
        <Button
          label="모임 만들기"
          size="sm"
          variant={view === 'create' ? 'primary' : 'outline'}
          style={{ flex: 1 }}
          onPress={() => setView('create')}
        />
      </TourTarget>

      <SwipeableTabs values={CLUB_VIEWS} value={view} onChange={setView}>
        {view === 'join' ? <ClubJoinContent embedded /> : null}
        {view === 'create' ? <ClubCreateContent embedded /> : null}

        {view === 'list' && clubs.isLoading ? <Loading /> : null}

        {view === 'list' ? <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={clubs.isFetching}
        onRefresh={() => clubs.refetch()}
        ListEmptyComponent={
          clubs.isLoading ? null : (
            <EmptyState
              title="참가 중인 모임이 없어요"
              description={'같은 책을 함께 읽으면 완독률이 올라갑니다.\n초대 코드를 받았다면 코드로 참가하세요.'}
            />
          )
        }
        renderItem={({ item }) => (
          <ClubCard
            club={item}
            onPress={() => router.push(`/club/${item.id}`)}
            // 관리는 모임을 연 사람(호스트)만 — 서버도 CLUB_NOT_HOST 로 막는다.
            onManage={item.myRole === 'HOST' ? () => router.push(`/club/${item.id}/settings`) : undefined}
          />
        )}
        /> : null}
      </SwipeableTabs>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  actions: { ...layout.content, flexDirection: 'row', gap: spacing.xs, padding: spacing.lg },
  // 카드 목록 — 구분선 대신 간격으로 띄운다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: 104, gap: spacing.md },
});
