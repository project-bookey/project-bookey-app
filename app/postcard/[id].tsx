import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi } from '@/api/endpoints';
import type { PostcardView } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { EnvelopeOpening } from '@/components/messenger/EnvelopeOpening';
import { PostcardLetter } from '@/components/messenger/PostcardLetter';
import { isSealed, patchPostcard, postcardKey, postcardListKey } from '@/components/messenger/postcardQueries';
import { useBlockUser } from '@/components/messenger/useBlockUser';
import { openSection } from '@/components/pager/sectionPager';
import { Button, EmptyState } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { countGraphemes } from '@/lib/graphemes';
import { hairline, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const MAX_GRAPHEMES = 16;

/**
 * 엽서 한 장 — 엽서 목록 줄이나 엽서 알림을 누르면 온다. 아직 열지 않은 받은 엽서는 닫힌 봉투가 열리는 짧은 효과와 함께
 * 펼치고(EnvelopeOpening), 서버에 연 시각을 남긴다 — 보낸 사람에게는 알리지 않는다(읽음 표시 없음, 2026-10-05 사용자 결정).
 * 받은 엽서에 아직 답장하지 않았으면 화면 아래 바에서 16글자 답장을 보낸다 — 이 화면의 주요 행동은 이것 하나다.
 * 차단·삭제는 엽서 발치의 작은 단추로 둔다(목록에서는 줄을 밀어서도 한다).
 */
export default function PostcardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postcardId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const deleteConfirm = useDeleteConfirm<true>();
  const { confirmBlock } = useBlockUser();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else openSection('messenger');
  };

  const remove = useMutation({
    mutationFn: () => postcardApi.remove(postcardId),
    onSuccess: () => {
      queryClient.setQueryData<PostcardView[]>(postcardListKey, (list) => list?.filter((item) => item.id !== postcardId));
      queryClient.invalidateQueries({ queryKey: postcardListKey });
      queryClient.removeQueries({ queryKey: postcardKey(postcardId) });
      leave();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '엽서를 삭제하지 못했어요.'),
  });

  const card = useQuery({
    queryKey: postcardKey(postcardId),
    queryFn: () => postcardApi.get(postcardId),
    // 목록에서 들어오면 받아 둔 줄로 바로 그리고, 뒤에서 새로 받는다.
    initialData: () => queryClient.getQueryData<PostcardView[]>(postcardListKey)?.find((item) => item.id === postcardId),
    initialDataUpdatedAt: () => queryClient.getQueryState(postcardListKey)?.dataUpdatedAt,
    // 지운 뒤 뒤로 가는 동안 지운 엽서를 다시 묻지 않게 막는다.
    enabled: Number.isFinite(postcardId) && !remove.isSuccess,
  });

  const open = useMutation({
    mutationFn: () => postcardApi.open(postcardId),
    // 목록의 그 줄도 바꿔 돌아가면 봉투가 열린 모양이다. 실패하면 닫힌 봉투로 남고 다음에 열 때 다시 남긴다.
    onSuccess: (view) => patchPostcard(queryClient, view),
  });

  // 이 화면에 들어올 때 닫힌 엽서였는가 — 처음 받은 값으로 한 번만 정한다. 연 뒤 캐시가 바뀌어도 효과를 다시 틀지 않는다.
  const enteredSealed = useRef<boolean | null>(null);
  if (enteredSealed.current === null && card.data) enteredSealed.current = isSealed(card.data);
  const opening = enteredSealed.current === true;
  const openRequested = useRef(false);
  const openPostcard = open.mutate;
  useEffect(() => {
    if (!opening || openRequested.current) return;
    openRequested.current = true;
    openPostcard();
  }, [opening, openPostcard]);

  const reply = useMutation({
    mutationFn: () => postcardApi.reply(postcardId, body.trim()),
    onSuccess: (view) => {
      setBody('');
      setError(null);
      patchPostcard(queryClient, view);
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '답장을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  const pressDelete = () => {
    if (remove.isPending) return;
    if (deleteConfirm.confirm) {
      deleteConfirm.disarm();
      setError(null);
      remove.mutate();
    } else {
      deleteConfirm.arm(true);
    }
  };
  const pressBlock = async (view: PostcardView) => {
    const counterpart = view.mine
      ? { id: view.toUserId, name: view.toNickname }
      : { id: view.fromUserId, name: view.fromNickname };
    // 막으면 이 엽서가 목록에서 빠지니 목록으로 돌아간다.
    if (await confirmBlock(counterpart.id, counterpart.name)) leave();
  };

  const data = card.data;
  const canReply = data != null && !data.mine && data.status !== 'REPLIED';
  const used = countGraphemes(body);
  const over = used > MAX_GRAPHEMES;
  const sendReply = () => {
    if (over || body.trim().length === 0 || reply.isPending) return;
    setError(null);
    reply.mutate();
  };

  const notFound = !Number.isFinite(postcardId) || (card.error instanceof ApiError && card.error.status === 404);
  const placeholder = notFound ? (
    <EmptyState title="엽서를 찾을 수 없어요" description="삭제했거나 더 볼 수 없는 엽서예요." />
  ) : data ? null : card.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface, borderColor: colors.line }]} />
  ) : card.isError ? (
    <EmptyState
      title="엽서를 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      action={<Button label="다시 시도" variant="outline" onPress={() => card.refetch()} />}
    />
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="엽서" />
      <KeyboardArea>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={card.isRefetching} onRefresh={() => card.refetch()} />}
        >
          {placeholder ?? (data ? (
            <EnvelopeOpening play={opening}>
              <PostcardLetter
                card={data}
                confirmingDelete={deleteConfirm.confirm === true}
                onDelete={pressDelete}
                onBlock={() => void pressBlock(data)}
              />
            </EnvelopeOpening>
          ) : null)}
          {/* 답장 바가 없을 때(보낸 엽서·답장한 엽서)의 삭제 오류는 엽서 아래에 둔다. */}
          {error && !canReply ? (
            <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>
          ) : null}
        </ScrollView>

        {/* 답장 — 다른 쓰기 화면처럼 엄지가 닿는 아래 바에 두고, 키보드가 뜨면 그 위에 붙는다. */}
        {canReply && data ? (
          <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, {
                  borderColor: over ? colors.danger : colors.lineStrong,
                  backgroundColor: colors.surface,
                  color: colors.text,
                }]}
                value={body}
                onChangeText={(next) => { setBody(next); setError(null); }}
                placeholder="답장도 16글자까지"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="답장 본문"
                returnKeyType="send"
                onSubmitEditing={sendReply}
              />
              <Text style={[typeScale.monoLabel, { color: over ? colors.danger : colors.textFaint }]}>
                {used} / {MAX_GRAPHEMES}
              </Text>
            </View>
            {error ? (
              <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>
            ) : null}
            <Button
              label={data.stampAttached ? '무료로 보내기' : '우표 1개로 보내기'}
              onPress={sendReply}
              loading={reply.isPending}
              disabled={over || body.trim().length === 0}
            />
          </KeyboardDock>
        ) : null}
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  bottomBar: {
    ...layout.content,
    width: '100%',
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  // 엽서 한 장 높이쯤의 빈 종이 — 알림에서 바로 들어와 아직 받는 중일 때.
  skeleton: { height: 220, borderRadius: radius.lg, borderWidth: hairline },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontFamily: sans.regular,
    fontSize: 15,
  },
});
