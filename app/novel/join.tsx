import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from '@/navigation';
import { novelApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Field } from '@/components/ui';
import { KeyboardArea } from '@/components/keyboard';
import { layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelJoinScreen() {
  const router = useRouter(); const cache = useQueryClient(); const { colors } = useTheme(); const [code, setCode] = useState('');
  const join = useMutation({ mutationFn: () => novelApi.join(code.trim()), onSuccess: data => { void cache.invalidateQueries({ queryKey: ['novels'] }); router.replace(`/novel/${data.novel.id}`); } });
  return <PaperScreen><SubHeader category="초대 코드로 신청" /><KeyboardArea><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ ...layout.content, padding: spacing.lg, gap: spacing.lg }}><Text style={[typeScale.titleSerif, { color: colors.text }]}>함께 쓸 이야기로 초대받았나요?</Text><Text style={[typeScale.body, { color: colors.textMuted }]}>개설자가 보내 준 코드를 입력해 주세요. 승인되면 집필 순서에 들어가요.</Text><Field label="초대 코드" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={32} />{join.isError ? <Text style={[typeScale.caption, { color: colors.danger }]}>{join.error instanceof ApiError ? join.error.message : '신청하지 못했어요. 코드를 확인하고 다시 시도해 주세요.'}</Text> : null}<Button label="참여 신청" loading={join.isPending} disabled={!code.trim()} onPress={() => join.mutate()} /></ScrollView></KeyboardArea></PaperScreen>;
}
