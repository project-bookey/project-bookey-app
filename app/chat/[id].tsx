import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable,
  Image, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatMessage } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { BOOKEY_STICKER_PACKS, findBookeyChatSticker } from '@/components/chat/bookeyStickers';
import { FootAction } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, radius, sans, spacing, typeScale, useTheme } from '@/theme';

/** 새 메시지 폴링 주기(ms) — 실시간 인프라 없이 시작한다 (§13-11 결정). */
const POLL_MS = 4000;

/**
 * 1:1 대화방 (§14.3) — 엽서 답장이 오간 사이만. 메시지는 최신순으로 받아 inverted 리스트로 그린다.
 * 위로 스크롤하면 beforeId 커서로 과거 메시지를 더 불러온다.
 */
export default function ChatRoomScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const chatId = Number(id);
  const [draft, setDraft] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [selectedStickerPackId, setSelectedStickerPackId] = useState(BOOKEY_STICKER_PACKS[0].id);
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
    // 백그라운드에서는 네트워크·배터리를 쓰지 않고, 복귀 이벤트에서 즉시 동기화한다.
    refetchIntervalInBackground: false,
    enabled: Number.isInteger(chatId),
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Number.isInteger(chatId)) {
        void messages.refetch();
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
    });
    return () => subscription.remove();
  }, [chatId, messages.refetch, queryClient]);

  const items = useMemo(
    () => messages.data?.pages.flatMap((p) => p.messages ?? []) ?? [],
    [messages.data],
  );
  const selectedStickerPack = BOOKEY_STICKER_PACKS.find((pack) => pack.id === selectedStickerPackId)
    ?? BOOKEY_STICKER_PACKS[0];

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(chatId, body),
    onSuccess: () => {
      setDraft('');
      setStickersOpen(false);
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

  const sendSticker = (code: string) => {
    if (send.isPending) return;
    send.mutate(code);
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
                엽서를 주고받은 사이입니다. 첫 인사를 건네보세요.
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

        {stickersOpen ? (
          <View style={[styles.stickerPanel, { borderTopColor: colors.line, backgroundColor: colors.surface }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stickerPackList}
            >
              {BOOKEY_STICKER_PACKS.map((pack) => {
                const selected = pack.id === selectedStickerPack.id;
                return (
                  <Pressable
                    key={pack.id}
                    onPress={() => setSelectedStickerPackId(pack.id)}
                    accessibilityRole="tab"
                    accessibilityLabel={`${pack.name} 이모티콘`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.stickerPackTab,
                      {
                        borderColor: selected ? colors.accent : colors.line,
                        backgroundColor: selected ? colors.accentSoft : colors.bg,
                      },
                    ]}
                  >
                    <Image source={pack.thumbnail} style={styles.stickerPackThumb} resizeMode="contain" />
                    <Text
                      numberOfLines={1}
                      style={[styles.stickerPackName, { color: selected ? colors.accent : colors.textMuted }]}
                    >
                      {pack.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerList}>
              {selectedStickerPack.stickers.map((sticker) => (
                <Pressable
                  key={sticker.code}
                  onPress={() => sendSticker(sticker.code)}
                  disabled={send.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`${sticker.label} 이모티콘 보내기`}
                  style={({ pressed }) => [
                    styles.stickerCell,
                    { borderColor: colors.line },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Image source={sticker.source} style={styles.stickerThumb} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[
          styles.inputRow,
          {
            borderTopColor: colors.line,
            backgroundColor: colors.bg,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}>
          <Pressable
            onPress={() => setStickersOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={stickersOpen ? '이모티콘 닫기' : '이모티콘 열기'}
            accessibilityState={{ expanded: stickersOpen }}
            style={[styles.stickerButton, {
              borderColor: stickersOpen ? colors.accent : colors.lineStrong,
              backgroundColor: stickersOpen ? colors.accentSoft : colors.surface,
            }]}
          >
            <Text style={[styles.stickerButtonText, { color: stickersOpen ? colors.accent : colors.textMuted }]}>☺</Text>
          </Pressable>
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
  const sticker = findBookeyChatSticker(message.body);
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
      {sticker ? (
        <Image
          source={sticker.source}
          style={styles.messageSticker}
          resizeMode="contain"
          accessibilityLabel={sticker.label}
        />
      ) : (
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
      )}
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
  stickerPanel: {
    borderTopWidth: hairline,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stickerPackList: { gap: spacing.xs, paddingBottom: spacing.xs },
  stickerPackTab: {
    width: 64,
    minHeight: 66,
    borderWidth: hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  stickerPackThumb: { width: 42, height: 42 },
  stickerPackName: { fontFamily: sans.regular, fontSize: 10, lineHeight: 13 },
  stickerList: { gap: spacing.sm, paddingVertical: spacing.sm },
  stickerCell: {
    width: 72,
    height: 72,
    borderWidth: hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerThumb: { width: 66, height: 66 },
  stickerButton: {
    width: 40,
    height: 40,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerButtonText: { fontSize: 22, lineHeight: 28 },
  messageSticker: { width: 156, height: 156 },
  pressed: { opacity: 0.72 },
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
    width: 40, height: 40, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
});
