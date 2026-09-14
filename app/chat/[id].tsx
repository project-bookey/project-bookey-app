import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatMessage } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { FootAction } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 새 메시지 폴링 주기(ms) — 실시간 인프라 없이 시작한다 (§13-11 결정). */
const POLL_MS = 4000;

/**
 * 1:1 대화방 (§14.3) — 맞팔로우끼리만. 메시지는 최신순으로 받아 inverted 리스트로 그린다.
 * 위로 스크롤하면 beforeId 커서로 과거 메시지를 더 불러온다.
 */
export default function ChatRoomScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const chatId = Number(id);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<'chat'>();
  const confirmingDelete = confirm === 'chat';

  const messages = useInfiniteQuery({
    queryKey: ['chatMessages', chatId],
    queryFn: ({ pageParam }) => chatApi.messages(chatId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextBeforeId ?? undefined,
    // 폴링은 로드된 전 페이지를 다시 받는다 — 보통 첫 페이지뿐이라 감당된다. 실시간은 후속.
    refetchInterval: POLL_MS,
    // 방이 마운트된 동안만 도는 폴링이다 — 웹에서 창 포커스가 빠져도 멈추지 않게 한다.
    refetchIntervalInBackground: true,
    enabled: Number.isInteger(chatId),
  });

  const items = useMemo(
    () => messages.data?.pages.flatMap((p) => p.messages ?? []) ?? [],
    [messages.data],
  );

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(chatId, body),
    onSuccess: () => {
      setDraft('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['chatMessages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '메시지를 보내지 못했어요.'),
  });
  const remove = useMutation({
    mutationFn: () => chatApi.remove(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.removeQueries({ queryKey: ['chatMessages', chatId] });
      if (router.canGoBack()) router.back();
      else router.replace('/chats');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '채팅을 삭제하지 못했어요.'),
  });
  const pressDelete = () => {
    if (confirmingDelete) {
      disarm();
      remove.mutate();
      return;
    }
    arm('chat');
  };

  const submit = () => {
    const body = draft.trim();
    if (body.length === 0 || send.isPending) return;
    send.mutate(body);
  };

  return (
    <PaperScreen>
      <SubHeader
        category={name ?? '채팅'}
        onBack={() => router.back()}
        right={
          <View style={styles.headerAction}>
            <FootAction
              label={confirmingDelete ? '한 번 더' : '삭제'}
              onPress={pressDelete}
              tone={confirmingDelete ? 'danger' : 'faint'}
              accessibilityLabel={confirmingDelete ? '채팅 삭제 확인' : '채팅 삭제'}
            />
          </View>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={items}
          inverted
          keyExtractor={(message) => String(message.id)}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
          }}
          renderItem={({ item }) => <Bubble message={item} />}
          ListFooterComponent={
            messages.isFetchingNextPage ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            messages.isLoading ? null : (
              // inverted 리스트라 위아래가 뒤집힌다 — 빈 상태는 단순 문구만 둔다.
              <Text style={[typeScale.caption, styles.empty, { color: colors.textFaint }]}>
                서로 팔로우한 사이입니다. 첫 인사를 건네보세요.
              </Text>
            )
          }
        />

        {error ? (
          <Text
            style={[typeScale.caption, { color: colors.danger, paddingHorizontal: spacing.lg }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        <View style={[styles.inputRow, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>
          <TextInput
            style={[styles.input, {
              borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text,
            }]}
            value={draft}
            onChangeText={(next) => { setDraft(next); setError(null); }}
            placeholder="메시지 보내기"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={1000}
            accessibilityLabel="메시지 입력"
          />
          <Pressable
            onPress={submit}
            disabled={draft.trim().length === 0 || send.isPending}
            accessibilityRole="button"
            accessibilityLabel="보내기"
            style={[styles.sendButton, {
              backgroundColor: draft.trim().length === 0 ? colors.surface : colors.accent,
            }]}
          >
            {send.isPending ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[typeScale.bodyStrong, {
                color: draft.trim().length === 0 ? colors.textFaint : colors.onAccent,
              }]}>
                ↑
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const mine = message.mine;
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.accent, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.bubbleText, { color: mine ? colors.onAccent : colors.text }]}>
          {message.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
  loading: { padding: spacing.md, alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleText: { fontFamily: sans.regular, fontSize: 15, lineHeight: 21 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: hairline,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: sans.regular,
    fontSize: 15,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
