import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Plus, KeyRound } from 'lucide-react-native';
import { useRouter } from '@/navigation';
import { ApiError } from '@/api/client';
import { useAuth } from '@/store/auth';
import { novelApi } from '@/api/endpoints';
import type { NovelKind, NovelStatus } from '@/api/types';
import { Chip, NAV_CLEARANCE, PaperScreen } from '@/components/collage';
import { NovelCard } from '@/components/novel/NovelCard';
import { Button, Card, EmptyState, Loading, Segmented } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

const FILTERS: { value: NovelStatus | 'ALL' | 'MINE'; label: string }[] = [
  { value: 'ALL', label: '전체' }, { value: 'RECRUITING', label: '모집 중' },
  { value: 'ONGOING', label: '연재 중' }, { value: 'COMPLETED', label: '완결' }, { value: 'MINE', label: '내 작품' },
];
export default function NovelsScreen() {
  const router = useRouter(); const { colors } = useTheme();
  const authStatus = useAuth(state => state.status);
  const userId = useAuth(state => state.user?.id);
  const authenticated = authStatus === 'authenticated';
  const [kind, setKind] = useState<NovelKind>('SOLO');
  const [filter, setFilter] = useState<NovelStatus | 'ALL' | 'MINE'>('ALL');
  const list = useInfiniteQuery({
    queryKey: ['novels', 'feed', userId, kind, filter], initialPageParam: 0, enabled: authenticated,
    queryFn: ({ pageParam }) => filter === 'MINE' ? novelApi.mine(pageParam, kind) : novelApi.feed(kind, filter === 'ALL' ? undefined : filter, pageParam),
    getNextPageParam: (last) => last.hasNext ? (last.page ?? 0) + 1 : undefined,
  });
  const turns = useQuery({ queryKey: ['novels', 'my-turns', userId], queryFn: novelApi.myTurns, enabled: authenticated, refetchInterval: 60000 });
  const turn = turns.data?.find(n => n.kind === kind);
  const needsLogin = !authenticated || list.error instanceof ApiError && list.error.status === 401;
  const openAuthenticated = (path: '/novel/join' | '/novel/new') => {
    if (!authenticated) { router.push('/login'); return; }
    if (path === '/novel/new') router.push({ pathname: path, params: { kind } });
    else router.push(path);
  };
  return (
    <PaperScreen>
      <FlatList
        data={authenticated ? list.data?.pages.flatMap(p => p.content) ?? [] : []} keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list} refreshing={list.isRefetching} onRefresh={() => { if (authenticated) { void list.refetch(); void turns.refetch(); } }}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }} onEndReachedThreshold={0.4}
        ListHeaderComponent={<View style={styles.header}>
          <Segmented options={[{ value: 'SOLO', label: '소설' }, { value: 'RELAY', label: '릴레이노벨' }]} value={kind} onChange={v => { setKind(v); setFilter('ALL'); }} />
          <View style={styles.heading}><View style={{ flex: 1 }}><Text style={[typeScale.titleSerif, { color: colors.text }]}>{kind === 'SOLO' ? '나의 문장, 하나의 소설' : '함께 쓰는 이야기'}</Text><Text style={[typeScale.caption, styles.subtitle, { color: colors.textMuted }]}>{kind === 'SOLO' ? '당신의 이야기를 한 회씩 펼쳐 보세요.' : '한 사람의 문장이, 우리의 소설로.'}</Text></View></View>
          <View style={styles.actions}><Button label="새 작품" icon={Plus} size="sm" onPress={() => openAuthenticated('/novel/new')} /><Button label="초대 코드" icon={KeyRound} size="sm" variant="outline" onPress={() => openAuthenticated('/novel/join')} /></View>
          {turn ? <Card style={{ backgroundColor: colors.accentSoft }}><View style={styles.turn}><View style={{ flex: 1 }}><Text style={[typeScale.caption, { color: colors.accent }]}>내 차례 · {turn.chapterCount + 1}번째 이야기</Text><Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text, marginTop: spacing.xs }]}>{turn.title}</Text><Text style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>{turn.turnDueAt ? `마감 ${new Date(turn.turnDueAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '다음 회차를 기다리고 있어요.'}</Text></View><Button label="이어 쓰기" size="sm" onPress={() => router.push(`/novel/${turn.id}/write`)} /></View></Card> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.filter(f => kind === 'RELAY' || f.value !== 'RECRUITING').map(f => <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />)}</ScrollView>
          <Text style={[typeScale.label, { color: colors.textMuted }]}>{filter === 'MINE' ? '내가 만들거나 참여한 작품' : '새로운 이야기를 만나보세요'}</Text>
        </View>}
        renderItem={({ item }) => <NovelCard novel={item} onPress={() => router.push(`/novel/${item.id}`)} />}
        ListEmptyComponent={authStatus === 'loading' || list.isLoading ? <Loading /> : needsLogin ? <EmptyState title="로그인하고 이야기를 만나보세요" description="소설을 읽거나 함께 쓰려면 로그인해 주세요." action={<Button label="로그인" onPress={() => router.push('/login')} />} /> : <EmptyState title={list.isError ? '작품을 불러오지 못했어요' : '아직 작품이 없어요'} description={list.error instanceof ApiError ? list.error.message : '새 작품을 만들고 첫 이야기를 시작해 보세요.'} action={list.isError ? <Button label="다시 시도" variant="outline" onPress={() => list.refetch()} /> : undefined} />}
        ListFooterComponent={list.isFetchingNextPage ? <Loading /> : list.isFetchNextPageError ? <Button label="다음 작품 다시 불러오기" variant="outline" onPress={() => list.fetchNextPage()} /> : null}
      />
    </PaperScreen>
  );
}
const styles = StyleSheet.create({
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: NAV_CLEARANCE, gap: spacing.md },
  header: { gap: spacing.lg, paddingBottom: spacing.sm }, heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subtitle: { marginTop: spacing.sm }, actions: { flexDirection: 'row', gap: spacing.sm }, turn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  filters: { gap: spacing.sm, paddingVertical: spacing.sm },
});
