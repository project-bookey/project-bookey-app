import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { novelApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelChapterScreen() {
  const { id, number } = useLocalSearchParams<{ id: string; number: string }>(); const router = useRouter(); const { colors } = useTheme();
  const query = useQuery({ queryKey: ['novels', Number(id), 'chapter', Number(number)], queryFn: () => novelApi.chapter(Number(id), Number(number)) });
  const detail = useQuery({ queryKey: ['novels', Number(id)], queryFn: () => novelApi.get(Number(id)) }); const c = query.data;
  return <PaperScreen><SubHeader category={`${number}화`} />{query.isLoading ? <Loading /> : !c ? <EmptyState title="회차를 불러오지 못했어요" description={query.error instanceof ApiError ? query.error.message : undefined} action={<Button label="다시 시도" variant="outline" onPress={() => query.refetch()} />} /> : <ScrollView contentContainerStyle={styles.content}><Text style={[typeScale.caption, { color: colors.textMuted }]}>{c.chapterNumber}화 · {c.authorNickname}</Text><Text style={[typeScale.titleSerif, { color: colors.text }]}>{c.title}</Text><Text selectable style={[typeScale.quote, styles.body, { color: colors.text }]}>{c.body}</Text><View style={styles.buttons}>{c.chapterNumber > 1 ? <Button label="이전 회차" variant="outline" style={styles.flex} onPress={() => router.replace(`/novel/${id}/chapter/${c.chapterNumber - 1}`)} /> : null}{c.chapterNumber < (detail.data?.novel.chapterCount ?? 0) ? <Button label="다음 회차" style={styles.flex} onPress={() => router.replace(`/novel/${id}/chapter/${c.chapterNumber + 1}`)} /> : <Button label="작품으로" variant="outline" style={styles.flex} onPress={() => router.replace(`/novel/${id}`)} />}</View></ScrollView>}</PaperScreen>;
}
const styles = StyleSheet.create({ content: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }, body: { lineHeight: 32 }, buttons: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 } });
