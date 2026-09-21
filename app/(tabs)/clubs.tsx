import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { ClubCard } from '@/components/club';
import type { ClubCardVariant } from '@/components/club';
import { BrandHeader, PaperScreen } from '@/components/collage';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, spacing } from '@/theme';

/** 구역 4. 모임 — 내 모임 · 코드 참가 · 만들기 (§F12). 광장 칩이 아니라 상단 구역 탭으로 들어온다. */
export default function ClubsScreen() {
  const router = useRouter();
  // 시안 비교용 — ?v=b 면 포스터 띠 카드. 고른 뒤 지운다.
  const { v } = useLocalSearchParams<{ v?: string }>();
  const variant: ClubCardVariant = v === 'b' ? 'b' : 'a';
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

      <View style={styles.actions}>
        <Button
          label="코드로 참가"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/club/join')}
        />
        <Button
          label="모임 만들기"
          style={{ flex: 1 }}
          onPress={() => router.push('/club/create')}
        />
      </View>

      {clubs.isLoading ? <Loading /> : null}

      <FlatList
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
            variant={variant}
            onPress={() => router.push(`/club/${item.id}`)}
            // 관리는 모임을 연 사람(호스트)만 — 서버도 CLUB_NOT_HOST 로 막는다.
            onManage={item.myRole === 'HOST' ? () => router.push(`/club/${item.id}/settings`) : undefined}
          />
        )}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  actions: { ...layout.content, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  // 카드 목록 — 구분선 대신 간격으로 띄운다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: 104, gap: spacing.md },
});
