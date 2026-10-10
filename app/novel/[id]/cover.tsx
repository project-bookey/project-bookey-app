import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { novelApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { usePhotoUploads } from '@/components/post/usePhotoUploads';
import { PaperScreen, SubHeader } from '@/components/collage';
import { NovelCover } from '@/components/novel/NovelCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelCoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const query = useQuery({ queryKey: ['novels', Number(id)], queryFn: () => novelApi.get(Number(id)) });
  return <PaperScreen><SubHeader category="표지 수정" />{query.isLoading ? <Loading /> : query.data?.novel.mine ? <CoverForm id={Number(id)} title={query.data.novel.title} coverUrl={query.data.novel.coverUrl} coverId={query.data.coverId} /> : <EmptyState title="개설자만 표지를 수정할 수 있어요" />}</PaperScreen>;
}
function CoverForm({ id, title, coverUrl, coverId }: { id: number; title: string; coverUrl?: string; coverId?: number }) {
  const router = useRouter(); const cache = useQueryClient(); const { colors } = useTheme();
  const [pickError, setPickError] = useState<string | null>(null);
  const uploads = usePhotoUploads(coverUrl && coverId ? [{ id: coverId, url: coverUrl }] : [], 1, novelApi.uploadCover); const photo = uploads.photos[0];
  const save = useMutation({ mutationFn: () => novelApi.changeCover(id, uploads.imageIds[0]), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['novels'] }); router.back(); } });
  return <ScrollView contentContainerStyle={{ ...layout.content, padding: spacing.lg, gap: spacing.lg }}><View style={{ alignItems: 'center' }}><NovelCover large uri={photo?.image?.url ?? photo?.localUri} title={title} /></View>{photo ? <Button label="표지 제거" variant="outline" disabled={save.isPending || uploads.busy} onPress={() => uploads.remove(photo.key)} /> : <Button label="표지 등록" variant="outline" disabled={uploads.picking || !uploads.retryable} onPress={() => { setPickError(null); void uploads.pick().catch(() => setPickError('사진을 선택하지 못했어요. 사진 접근 권한을 확인해 주세요.')); }} />}{photo?.status === 'failed' ? <Button label="다시 올리기" disabled={!uploads.retryable} onPress={() => uploads.retry(photo.key)} /> : null}{pickError || uploads.notice || save.isError ? <Text style={[typeScale.caption, { color: colors.danger }]}>{pickError ?? uploads.notice ?? (save.error instanceof ApiError ? save.error.message : '표지를 저장하지 못했어요.')}</Text> : null}<Button label="표지 저장" loading={save.isPending || uploads.busy} disabled={uploads.picking || photo?.status === 'failed'} onPress={() => save.mutate()} /></ScrollView>;
}
