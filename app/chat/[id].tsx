import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, Pressable,
  Image, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatMessage } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { openSection } from '@/components/pager/sectionPager';
import { KeyboardArea } from '@/components/keyboard';
import { BOOKEY_STICKER_PACKS, findBookeyChatSticker } from '@/components/chat/bookeyStickers';
import {
  ChatBubble, ChatEmpty, ChatError, ChatInput, ChatInputBar, ChatSendButton, ChatTime, chatListContent,
} from '@/components/chat/ChatParts';
import { FootAction } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, iconStroke, pressedStyle, radius, sans, spacing, useTheme } from '@/theme';

/** 새 메시지 폴링 주기(ms) — 실시간 인프라 없이 시작한다 (§13-11 결정). */
const POLL_MS = 4000;

/**
 * 1:1 대화방 (§14.3) — 엽서 답장이 오간 사이만. 메시지는 최신순으로 받아 inverted 리스트로 그린다.
 * 위로 스크롤하면 beforeId 커서로 과거 메시지를 더 불러온다.
 * 말풍선·입력 줄·보내기는 클럽 채팅과 같은 부품(ChatParts)이고, 이모티콘만 이 방의 것이다.
 */
export default function ChatRoomScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
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
      // 돌아갈 화면이 없으면(알림으로 바로 들어온 방 등) 메신저 '채팅' 칸을 연다.
      if (router.canGoBack()) router.back();
      else openSection('messenger', { pane: 'chats' });
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
      <KeyboardArea>
        <FlatList
          data={items}
          inverted
          keyExtractor={(message) => String(message.id)}
          contentContainerStyle={chatListContent}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
          }}
          renderItem={({ item }) => <Message message={item} />}
          ListFooterComponent={
            messages.isFetchingNextPage ? (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            messages.isLoading ? null : <ChatEmpty description="엽서를 주고받은 사이예요. 첫 인사를 건네 보세요." />
          }
        />

        {error ? <ChatError message={error} /> : null}

        {stickersOpen ? (
          <View style={[styles.stickerPanel, { borderTopColor: colors.line, backgroundColor: colors.surface }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
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
                    style={({ pressed }) => [
                      styles.stickerPackTab,
                      // 고른 묶음은 다른 선택 상태처럼 잉크로 뒤집는다.
                      {
                        borderColor: selected ? colors.ink : colors.control,
                        backgroundColor: selected ? colors.ink : colors.bg,
                      },
                      pressed ? pressedStyle : null,
                    ]}
                  >
                    <Image source={pack.thumbnail} style={styles.stickerPackThumb} resizeMode="contain" />
                    <Text
                      numberOfLines={1}
                      style={[styles.stickerPackName, { color: selected ? colors.onInk : colors.textMuted }]}
                    >
                      {pack.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.stickerList}
            >
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
                    pressed ? pressedStyle : null,
                  ]}
                >
                  <Image source={sticker.source} style={styles.stickerThumb} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ChatInputBar>
          <Pressable
            onPress={() => setStickersOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={stickersOpen ? '이모티콘 닫기' : '이모티콘 열기'}
            accessibilityState={{ expanded: stickersOpen }}
            style={({ pressed }) => [
              styles.stickerButton,
              // 열린 동안은 토글 선택 상태처럼 잉크로 뒤집는다.
              {
                borderColor: stickersOpen ? colors.ink : colors.control,
                backgroundColor: stickersOpen ? colors.ink : colors.surface,
              },
              pressed ? pressedStyle : null,
            ]}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={stickersOpen ? colors.onInk : colors.textMuted}
            >
              <Circle cx={12} cy={12} r={9} {...iconStroke} />
              <Path d="M9 9.5v1M15 9.5v1M8.5 14.5c1.9 2.2 5.1 2.2 7 0" {...iconStroke} />
            </Svg>
          </Pressable>
          <ChatInput value={draft} onChangeText={(next) => { setDraft(next); setError(null); }} />
          <ChatSendButton onPress={submit} disabled={draft.trim().length === 0} loading={send.isPending} />
        </ChatInputBar>
      </KeyboardArea>
    </PaperScreen>
  );
}

/**
 * 메시지 한 줄 — 글은 공용 말풍선, 이모티콘은 말풍선 없이 그림만. 상대 이름은 머리에 있어 비운다.
 * 이모티콘에도 말풍선과 같은 자리에 시각을 단다.
 */
function Message({ message }: { message: ChatMessage }) {
  const mine = message.mine === true;
  const sticker = findBookeyChatSticker(message.body);
  if (!sticker) return <ChatBubble mine={mine} body={message.body ?? ''} createdAt={message.createdAt} />;
  return (
    <View style={[styles.stickerRow, mine ? styles.stickerRowMine : null]}>
      <View>
        <Image
          source={sticker.source}
          style={styles.messageSticker}
          resizeMode="contain"
          accessibilityLabel={sticker.label}
        />
        <ChatTime createdAt={message.createdAt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerAction: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  loading: { padding: spacing.md, alignItems: 'center' },
  stickerRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  stickerRowMine: { justifyContent: 'flex-end' },
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
  // 보내기와 같은 48pt 네모 — 입력 줄 양 끝이 같은 크기로 맞선다.
  stickerButton: {
    width: 48,
    height: 48,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageSticker: { width: 156, height: 156 },
});
