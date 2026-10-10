import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { ApiError } from '@/api/client';
import { novelApi } from '@/api/endpoints';
import type { NovelDetail } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { confirmAsync, notify } from '@/components/club';
import { NovelCover, novelStatusLabel } from '@/components/novel/NovelCard';
import { Button, Card, EmptyState, Loading, TextLink } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelDetailScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>(); const id = Number(raw); const router = useRouter();
  const cache = useQueryClient(); const { colors } = useTheme();
  const query = useQuery({ queryKey: ['novels', id], queryFn: () => novelApi.get(id), enabled: Number.isSafeInteger(id) && id > 0, refetchInterval: 30000 });
  const data = query.data; const n = data?.novel;
  const mayRead = !!data && (data.novel.isPublic || data.novel.mine || data.myMembership === 'ACTIVE');
  const chapters = useInfiniteQuery({ queryKey: ['novels', id, 'chapters'], initialPageParam: 0, queryFn: ({ pageParam }) => novelApi.chapters(id, pageParam), getNextPageParam: last => last.hasNext ? (last.page ?? 0) + 1 : undefined, enabled: mayRead });
  const action = useMutation({ mutationFn: (run: () => Promise<NovelDetail | void>) => run(), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['novels'] }); }, onError: e => notify(e instanceof ApiError ? e.message : '처리하지 못했어요. 다시 시도해 주세요.') });
  if (!data || !n) return <PaperScreen><SubHeader category="작품" />{query.isLoading ? <Loading /> : <EmptyState title="작품을 불러오지 못했어요" description={query.error instanceof ApiError ? query.error.message : undefined} action={<Button label="다시 시도" variant="outline" onPress={() => query.refetch()} />} />}</PaperScreen>;
  return <PaperScreen><SubHeader category={n.kind === 'SOLO' ? '소설' : '릴레이노벨'} /><FlatList
    data={chapters.data?.pages.flatMap(p => p.content) ?? []} keyExtractor={item => String(item.id)} contentContainerStyle={styles.content}
    refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); if (mayRead) void chapters.refetch(); }}
    onEndReached={() => { if (chapters.hasNextPage && !chapters.isFetchingNextPage) void chapters.fetchNextPage(); }}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.top}><NovelCover large uri={n.coverUrl} title={n.title} /><View style={styles.info}><Text style={[typeScale.caption, { color: colors.textMuted }]}>{n.genre} · {novelStatusLabel[n.status]} · {n.isPublic ? '공개' : '비공개'}</Text><Text style={[typeScale.titleSerif, { color: colors.text }]}>{n.title}</Text><Text style={[typeScale.caption, { color: colors.textMuted }]}>{n.ownerNickname} · {n.chapterCount}/{n.chapterLimit}화</Text>{n.mine ? <Button size="sm" variant="outline" label="표지 수정" onPress={() => router.push(`/novel/${id}/cover`)} /> : null}</View></View>
      {n.description ? <Text style={[typeScale.body, { color: colors.textMuted }]}>{n.description}</Text> : null}
      {data.canWrite ? <Button label={n.chapterCount === 0 ? '첫 이야기 쓰기' : '이어 쓰기'} onPress={() => router.push(`/novel/${id}/write`)} /> : null}
      {n.kind === 'RELAY' ? <>
        <Card><Text style={[typeScale.label, { color: colors.text }]}>집필 순서 · {n.memberCount}/{n.memberLimit}명</Text><View style={styles.members}>{data.members.map((m, index) => <Text key={m.userId} style={[typeScale.body, { color: m.currentWriter ? colors.accent : colors.textMuted }]}>{index + 1}. {m.nickname}{m.owner ? ' · 개설자' : ''}{m.currentWriter ? ' · 지금 집필 중' : ''}</Text>)}</View>{n.status === 'RECRUITING' ? <Text style={[typeScale.caption, { color: colors.textMuted }]}>개설자가 참가자를 승인하고 시작하면 순서대로 집필해요.</Text> : n.turnDueAt ? <Text style={[typeScale.caption, { color: colors.textMuted }]}>마감 {new Date(n.turnDueAt).toLocaleString('ko-KR')}</Text> : null}</Card>
        {data.canApply ? <Button label="참여 신청" loading={action.isPending} onPress={() => action.mutate(() => novelApi.apply(id))} /> : null}
        {data.myMembership === 'PENDING' ? <Card><Text style={[typeScale.body, { color: colors.textMuted }]}>참여 신청을 보냈어요. 개설자의 승인을 기다려 주세요.</Text></Card> : null}
        {data.canStart ? <Button label="릴레이 시작" loading={action.isPending} onPress={async () => { if (await confirmAsync('개설자부터 차례당 24시간씩 집필해요.', '시작', '릴레이를 시작할까요?')) action.mutate(() => novelApi.start(id)); }} /> : null}
        {data.inviteCode ? <Button label="초대 코드 복사" variant="outline" onPress={() => { void Clipboard.setStringAsync(data.inviteCode!).then(() => notify('초대 코드를 복사했어요.')); }} /> : null}
        {n.mine && data.applications.length > 0 ? <View style={styles.header}><Text style={[typeScale.section, { color: colors.text }]}>참여 신청 · {data.applications.length}명</Text>{data.applications.map(m => <Card key={m.userId}><View style={styles.application}><Text style={[typeScale.bodyStrong, styles.flex, { color: colors.text }]}>{m.nickname}</Text><Button label="거절" size="sm" variant="outline" disabled={action.isPending} onPress={() => action.mutate(() => novelApi.decide(id, m.userId, false))} /><Button label="승인" size="sm" disabled={action.isPending} onPress={() => action.mutate(() => novelApi.decide(id, m.userId, true))} /></View></Card>)}</View> : null}
        {!n.mine && ['ACTIVE', 'PENDING'].includes(data.myMembership) ? <Button label={data.myMembership === 'PENDING' ? '신청 취소' : '참가 그만두기'} variant="outline" disabled={action.isPending} onPress={async () => { if (await confirmAsync('작성한 회차는 작품에 남아요.', '그만두기')) action.mutate(async () => { await novelApi.leave(id); router.back(); }); }} /> : null}
      </> : null}
      {data.canComplete ? <Button label="작품 완결" variant="outline" disabled={action.isPending} onPress={async () => { if (await confirmAsync('완결한 뒤에는 새 회차를 올릴 수 없어요.', '완결', '작품을 완결할까요?')) action.mutate(() => novelApi.complete(id)); }} /> : null}
      <Text style={[typeScale.section, { color: colors.text }]}>이야기 · {n.chapterCount}화</Text>
    </View>}
    renderItem={({ item }) => <Card><Text style={[typeScale.caption, { color: colors.textMuted }]}>{item.chapterNumber}화 · {item.authorNickname}</Text><Text style={[typeScale.titleSerif, styles.chapterTitle, { color: colors.text }]}>{item.title}</Text><Text numberOfLines={2} style={[typeScale.body, { color: colors.textMuted }]}>{item.excerpt}</Text><TextLink label="회차 읽기" onPress={() => router.push(`/novel/${id}/chapter/${item.chapterNumber}`)} /></Card>}
    ListEmptyComponent={chapters.isLoading ? <Loading /> : <EmptyState title={!mayRead ? '승인 후 이야기를 읽을 수 있어요' : chapters.isError ? '회차를 불러오지 못했어요' : '첫 이야기를 기다리고 있어요'} action={chapters.isError ? <Button label="다시 시도" variant="outline" onPress={() => chapters.refetch()} /> : undefined} />}
    ListFooterComponent={chapters.isFetchingNextPage ? <Loading /> : chapters.isFetchNextPageError ? <Button label="다음 회차 다시 불러오기" variant="outline" onPress={() => chapters.fetchNextPage()} /> : null}
  /></PaperScreen>;
}
const styles = StyleSheet.create({ content: { ...layout.content, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }, header: { gap: spacing.lg, paddingBottom: spacing.md }, top: { flexDirection: 'row', gap: spacing.lg }, info: { flex: 1, gap: spacing.md }, members: { gap: spacing.sm, marginVertical: spacing.md }, application: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, flex: { flex: 1 }, chapterTitle: { marginVertical: spacing.sm } });
