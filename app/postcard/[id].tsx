import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi } from '@/api/endpoints';
import type { PostcardView } from '@/api/types';
import { AVATAR_SIZE, PersonGlyph } from '@/components/Avatar';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardScroll, useKeyboardReveal } from '@/components/keyboard';
import { findPostcard, POSTCARDS_KEY } from '@/components/messenger/postcardQueries';
import { Button, Card, DeleteAction, EmptyState, Loading, Tag, TextLink, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { countGraphemes } from '@/lib/graphemes';
import { useFocusEffect, useLocalSearchParams, useRouter } from '@/navigation';
import { useAuth } from '@/store/auth';
import { usePostcardOpened } from '@/store/postcardOpened';
import { hairline, layout, pressedStyle, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const MAX_GRAPHEMES = 16;

/** 엽서는 실제로 상세 화면이 보인 뒤 읽음으로 표시한다. 목록에는 본문을 노출하지 않는다. */
export default function PostcardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postcardId = Number(id);
  const valid = Number.isSafeInteger(postcardId) && postcardId > 0;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const userId = useAuth((state) => state.user?.id);
  const markOpened = usePostcardOpened((state) => state.markOpened);
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
  const confirming = confirm === postcardId;
  const detailKey = ['postcards', 'detail', postcardId] as const;
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => findPostcard(postcardId),
    enabled: valid,
    // 목록에서 눌렀다면 이미 받은 원문으로 즉시 연다. 직접 연 주소만 서버에서 찾는다.
    initialData: () => queryClient.getQueryData<PostcardView[]>(POSTCARDS_KEY)?.find((card) => card.id === postcardId),
    initialDataUpdatedAt: () => queryClient.getQueryState(POSTCARDS_KEY)?.dataUpdatedAt,
    staleTime: 60_000,
  });
  const card = detail.data;
  useFocusEffect(useCallback(() => {
    if (card && !card.mine && userId != null) markOpened(userId, card.id);
  }, [card?.id, card?.mine, userId, markOpened]));

  const remove = useMutation({
    mutationFn: () => postcardApi.remove(postcardId),
    onSuccess: () => {
      queryClient.setQueryData<PostcardView[]>(POSTCARDS_KEY, (cards) => cards?.filter((item) => item.id !== postcardId));
      queryClient.removeQueries({ queryKey: detailKey, exact: true });
      if (router.canGoBack()) router.back();
      else router.replace('/postcards');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '엽서를 삭제하지 못했어요.'),
  });
  const pressDelete = () => {
    if (remove.isPending) return;
    if (!confirming) { arm(postcardId); return; }
    disarm();
    remove.mutate();
  };
  const head = <SubHeader category="엽서" right={card ? (
    <DeleteAction target="엽서" confirming={confirming} onPress={pressDelete} />
  ) : undefined} />;
  if (detail.isLoading) return <PaperScreen>{head}<Loading /></PaperScreen>;
  if (!valid || !card) return (
    <PaperScreen>
      {head}
      <EmptyState title={detail.isError ? '엽서를 불러오지 못했어요' : '엽서를 찾을 수 없어요'}
        description={detail.isError ? '잠시 후 다시 열어 주세요.' : '삭제되었거나 열 수 없는 엽서예요.'}
        action={detail.isError ? <TextLink label="다시 시도" kind="action" onPress={() => detail.refetch()} /> : undefined} />
    </PaperScreen>
  );
  const inbox = !card.mine;
  const name = inbox ? card.fromNickname : card.toNickname;
  const avatar = inbox ? card.fromAvatarUrl : card.toAvatarUrl;
  const counterpartId = inbox ? card.fromUserId : card.toUserId;
  const replied = card.status === 'REPLIED';
  return (
    <PaperScreen>
      {head}
      <KeyboardScroll contentContainerStyle={styles.content}>
        {error ? <Text accessibilityRole="alert" style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
        <Card>
          <Pressable disabled={!replied} onPress={() => router.push(`/user/${counterpartId}`)}
            accessibilityRole={replied ? 'button' : undefined}
            accessibilityLabel={replied ? `${name}님 프로필 보기` : name}
            style={({ pressed }) => [styles.person, replied && pressed && pressedStyle]}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : (
              <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
                <PersonGlyph size={AVATAR_SIZE} color={colors.textFaint} />
              </View>
            )}
            <Text style={[typeScale.bodyStrong, styles.grow, { color: colors.text }]}>
              {inbox ? `${name}에게서 온 엽서` : `${name}에게 보낸 엽서`}
            </Text>
          </Pressable>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{formatRelative(card.createdAt)}</Text>
          {card.postTitle ? <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            『{card.postTitle}』 독후감을 보고
          </Text> : null}
          <View style={[styles.letter, { borderColor: colors.line, backgroundColor: colors.bg }]}>
            <Text selectable style={[typeScale.quote, { color: colors.text }]}>{card.body}</Text>
          </View>
          <View style={styles.tags}>
            {card.stampAttached ? <Tag label="우표 동봉 — 무료 답장" fg={colors.accent} bg={colors.accentSoft} /> : null}
            {replied ? <Tag label="답장 완료" /> : null}
          </View>
          {replied && card.replyBody ? <View style={[styles.replyLetter, { borderColor: colors.line }]}>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>답장</Text>
            <Text selectable style={[typeScale.quote, { color: colors.text }]}>{card.replyBody}</Text>
          </View> : null}
        </Card>
        {inbox && !replied ? <ReplyForm card={card} /> : null}
      </KeyboardScroll>
    </PaperScreen>
  );
}

function ReplyForm({ card }: { card: PostcardView }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reveal = useKeyboardReveal();
  const actions = useRef<View>(null);
  const sending = useRef(false);
  const used = countGraphemes(body);
  const over = used > MAX_GRAPHEMES;
  const reply = useMutation({
    mutationFn: (text: string) => postcardApi.reply(card.id, text),
    onSuccess: (updated) => {
      queryClient.setQueryData(['postcards', 'detail', card.id], updated);
      queryClient.setQueryData<PostcardView[]>(POSTCARDS_KEY, (cards) => cards?.map((item) => item.id === card.id ? updated : item));
      queryClient.invalidateQueries({ queryKey: ['postcards'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '답장을 보내지 못했어요.'),
    onSettled: () => { sending.current = false; },
  });
  const submit = () => {
    const text = body.trim();
    if (sending.current || !text || over) return;
    sending.current = true;
    reply.mutate(text);
  };
  return (
    <Card>
      <Text style={[typeScale.bodyStrong, { color: colors.text }]}>답장 쓰기</Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>
        {card.stampAttached ? '동봉된 우표로 무료로 답장할 수 있어요.' : '답장을 보내면 우표 1개를 사용해요.'}
      </Text>
      <TextInput multiline value={body} onChangeText={(next) => { setBody(next); setError(null); }}
        placeholder="마음을 담아 16글자까지" placeholderTextColor={colors.textFaint}
        accessibilityLabel="답장 본문" editable={!reply.isPending}
        onFocus={() => reveal(actions)}
        style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: over ? colors.danger : colors.lineStrong }]} />
      <Text style={[typeScale.monoLabel, styles.counter, { color: over ? colors.danger : colors.textFaint }]}>
        {used} / {MAX_GRAPHEMES}
      </Text>
      {error ? <Text accessibilityRole="alert" style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
      <View ref={actions}>
        <Button label={card.stampAttached ? '무료로 답장 보내기' : '우표 1개로 답장 보내기'}
          onPress={submit} loading={reply.isPending} disabled={over || body.trim().length === 0} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { ...layout.content, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  grow: { flex: 1 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl, marginVertical: spacing.sm, borderWidth: hairline, borderRadius: radius.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  replyLetter: { borderTopWidth: hairline, paddingTop: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
  input: { minHeight: 96, borderRadius: radius.md, borderWidth: hairline, padding: spacing.md, fontFamily: sans.regular, fontSize: 15, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end' },
});
