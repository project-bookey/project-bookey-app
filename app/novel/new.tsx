import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePlus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { novelApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import type { NovelKind } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { usePhotoUploads } from '@/components/post/usePhotoUploads';
import { NovelCover } from '@/components/novel/NovelCard';
import { Button, Field, Segmented } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelCreateScreen() {
  const params = useLocalSearchParams<{ kind?: string }>(); const router = useRouter(); const cache = useQueryClient(); const { colors } = useTheme();
  const [kind, setKind] = useState<NovelKind>(params.kind === 'RELAY' ? 'RELAY' : 'SOLO');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [genre, setGenre] = useState('일상');
  const [memberLimit, setMemberLimit] = useState('6'); const [chapterLimit, setChapterLimit] = useState('20');
  const [error, setError] = useState<string | null>(null);
  const upload = usePhotoUploads([], 1, novelApi.uploadCover); const photo = upload.photos[0];
  const create = useMutation({
    mutationFn: () => novelApi.create({ kind, title: title.trim(), description: description.trim(), genre: genre.trim(), isPublic: visibility === 'PUBLIC', memberLimit: kind === 'RELAY' ? Number(memberLimit) : undefined, chapterLimit: Number(chapterLimit), turnHours: 24, coverId: upload.imageIds[0] }),
    onSuccess: data => { void cache.invalidateQueries({ queryKey: ['novels'] }); router.replace(`/novel/${data.novel.id}`); },
    onError: e => setError(e instanceof ApiError ? e.message : '작품을 만들지 못했어요. 다시 시도해 주세요.'),
  });
  const valid = title.trim() && genre.trim() && Number.isInteger(Number(chapterLimit)) && Number(chapterLimit) >= 1 && Number(chapterLimit) <= 100 && (kind === 'SOLO' || Number.isInteger(Number(memberLimit)) && Number(memberLimit) >= 2 && Number(memberLimit) <= 10);
  return <PaperScreen><SubHeader category="새 작품" /><KeyboardArea><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Segmented options={[{ value: 'SOLO', label: '소설' }, { value: 'RELAY', label: '릴레이노벨' }]} value={kind} onChange={setKind} />
    <Text style={[typeScale.caption, { color: colors.textMuted }]}>{kind === 'SOLO' ? '한 작가가 회차를 이어 가는 소설이에요.' : '승인된 참가자들이 순서대로 한 회씩 이어 써요. 차례마다 24시간이 주어져요.'}</Text>
    <View style={styles.coverRow}><NovelCover large uri={photo?.image?.url ?? photo?.localUri} title={title} /><View style={styles.coverActions}><Text style={[typeScale.label, { color: colors.text }]}>작품 표지 (선택)</Text><Text style={[typeScale.caption, { color: colors.textMuted }]}>세로 표지를 권장해요.{ '\n' }JPG · PNG · WebP, 10MB까지</Text>{photo ? <><Button label="표지 제거" size="sm" variant="outline" disabled={create.isPending} onPress={() => upload.remove(photo.key)} />{photo.status === 'failed' ? <Button label="다시 올리기" size="sm" disabled={!upload.retryable} onPress={() => upload.retry(photo.key)} /> : null}{photo.status === 'uploading' ? <Text style={[typeScale.caption, { color: colors.textMuted }]}>표지를 올리고 있어요.</Text> : null}</> : <Button label="표지 등록" icon={ImagePlus} size="sm" variant="outline" disabled={upload.picking || !upload.retryable} onPress={() => { void upload.pick().catch(() => setError('사진을 고르지 못했어요. 다시 시도해 주세요.')); }} />}</View></View>
    {upload.notice ? <Text style={[typeScale.caption, { color: colors.danger }]}>{upload.notice}</Text> : null}
    <Field label="작품 제목" value={title} onChangeText={setTitle} maxLength={120} placeholder="어떤 이야기를 들려주고 싶나요?" />
    <Field label="작품 소개 (선택)" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="이야기의 시작이나 함께 쓰고 싶은 방향을 적어 주세요." />
    <Field label="장르" value={genre} onChangeText={setGenre} maxLength={30} placeholder="예: 미스터리, 판타지, 일상" />
    <View style={styles.fields}>{kind === 'RELAY' ? <Field style={styles.flex} label="참가 정원" hint="개설자 포함 2~10명" value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad" maxLength={2} /> : null}<Field style={styles.flex} label="목표 회차" hint="1~100화 · 도달하면 완결" value={chapterLimit} onChangeText={setChapterLimit} keyboardType="number-pad" maxLength={3} /></View>
    <Text style={[typeScale.label, { color: colors.text }]}>공개 범위</Text><Segmented options={[{ value: 'PUBLIC', label: '공개' }, { value: 'PRIVATE', label: '비공개' }]} value={visibility} onChange={setVisibility} />
    <Text style={[typeScale.caption, { color: colors.textMuted }]}>{visibility === 'PUBLIC' ? kind === 'RELAY' ? '목록에 작품이 보이고 누구나 참여 신청할 수 있어요. 개설자가 승인한 사람만 집필해요.' : '다른 독자들이 작품과 회차를 읽을 수 있어요.' : kind === 'RELAY' ? '목록에 보이지 않아요. 초대 코드로 신청한 참가자를 승인해 함께 써요.' : '나만 작품과 회차를 읽을 수 있어요.'}</Text>
  </ScrollView><KeyboardDock style={[styles.dock, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>{error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}<Button label="작품 만들기" loading={create.isPending} disabled={!valid || upload.busy || upload.picking || photo?.status === 'failed'} onPress={() => { setError(null); create.mutate(); }} /></KeyboardDock></KeyboardArea></PaperScreen>;
}
const styles = StyleSheet.create({ content: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }, coverRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }, coverActions: { flex: 1, gap: spacing.md }, fields: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 }, dock: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: hairline, gap: spacing.sm } });
