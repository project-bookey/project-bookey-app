import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubSummary } from '@/api/types';
import { BrandHeader, PaperScreen, TiltCover } from '@/components/collage';
import {
  Button, EmptyState, Loading, Numeral, ProgressBar, Tag, percent,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 구역 4. 모임 — 내 모임 · 코드 참가 · 만들기 (§F12). 광장 칩이 아니라 상단 구역 탭으로 들어온다. */
export default function ClubsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: clubApi.myClubs });
  const items = (clubs.data?.content ?? []).filter(Boolean);

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
        ItemSeparatorComponent={() => (
          <View style={{ height: hairline, backgroundColor: colors.line }} />
        )}
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
          <ClubRow club={item} onPress={() => router.push(`/club/${item.id}`)} />
        )}
      />
    </PaperScreen>
  );
}

function ClubRow({ club, onPress }: { club: ClubSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <TiltCover uri={club.book?.coverUrl} title={club.book?.title} width={48} tilt={0} entering={false} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{club.name}</Text>
          {ended ? (
            <Tag label="종료" />
          ) : (
            <Numeral style={[styles.dday, { color: colors.accent }]}>
              {club.daysLeft >= 0 ? `D-${club.daysLeft}` : '기간 종료'}
            </Numeral>
          )}
        </View>
        <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
          {club.book?.title ?? '도서 없음'} · {club.memberCount}명
        </Text>

        <View style={styles.progressBlock}>
          <View style={styles.progressLine}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>나</Text>
            <View style={styles.progressTrackWrap}>
              <ProgressBar value={club.myCompletionRate} height={5} />
            </View>
            <Numeral style={[styles.progressValue, { color: colors.text }]}>
              {percent(club.myCompletionRate)}
            </Numeral>
          </View>
          <View style={styles.progressLine}>
            <Text style={[styles.progressLabel, { color: colors.textFaint }]}>평균</Text>
            <View style={[styles.avgTrack, { backgroundColor: colors.line }]}>
              <View
                style={[
                  styles.avgFill,
                  {
                    width: `${Math.min(100, (club.averageCompletionRate ?? 0) * 100)}%`,
                    backgroundColor: colors.textFaint,
                  },
                ]}
              />
            </View>
            <Numeral style={[styles.progressValue, { color: colors.textFaint }]}>
              {percent(club.averageCompletionRate)}
            </Numeral>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { ...layout.content, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: 104 },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  rowBody: { flex: 1, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typeScale.titleSerif, fontSize: 17, lineHeight: 23, flexShrink: 1 },
  dday: { fontSize: 12 },
  progressBlock: { gap: 5, marginTop: spacing.sm },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressLabel: { ...typeScale.caption, width: 24 },
  progressTrackWrap: { flex: 1 },
  progressValue: { fontSize: 11, width: 40, textAlign: 'right' },
  avgTrack: { flex: 1, height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  avgFill: { height: '100%', borderRadius: radius.pill },
});
