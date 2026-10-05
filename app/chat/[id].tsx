import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { Ellipsis } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, BackHandler, FlatList, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatMessage } from '@/api/types';
import { PersonGlyph } from '@/components/Avatar';
import { CachedImage as Image } from '@/components/CachedImage';
import { ICON_SIZE, IconButton, PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea } from '@/components/keyboard';
import { BookeyPackTabs } from '@/components/chat/BookeyPackTabs';
import { BOOKEY_STICKER_PACKS, findBookeyChatSticker } from '@/components/chat/bookeyStickers';
import {
  COMPOSER_HEIGHT, COMPOSER_KEY, COMPOSER_SLOP, ChatComposer, ChatDaySeparator, ChatEmpty, ChatError, ChatFloatingBar,
  ChatInput, ChatSendButton, ChatSideTime, DirectBubble, chatDayKey, chatListContent, composerInputStyle,
} from '@/components/chat/ChatParts';
import { kstTime } from '@/components/clubLog';
import { useBlockUser } from '@/components/messenger/useBlockUser';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { controlFace, hairline, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 새 메시지 폴링 주기(ms) — 실시간 인프라 없이 시작한다 (§13-11 결정). */
const POLL_MS = 4000;

/** 머리의 상대 사진 지름. */
const HEAD_AVATAR = 28;

/**
 * 1:1 대화방 (§14.3) — 엽서 답장이 오간 사이만. 메시지는 최신순으로 받아 inverted 리스트로 그린다.
 * 위로 스크롤하면 beforeId 커서로 과거 메시지를 더 불러온다.
 *
 * 2026-10-05 시안 A(사용자 결정): 머리 가운데에 상대 사진·이름(누르면 프로필), 오른쪽 ⋯ 메뉴에 프로필 보기 ·
 * 차단 · 채팅 삭제 — 구석에 서 있던 '삭제'를 메뉴 안으로 넣었다. 날짜가 바뀌면 날짜 줄, 같은 사람이 같은 분에
 * 이어 보낸 말은 묶어 시각을 한 번만, 입력줄은 이모티콘·입력·보내기를 한 상자로. 클럽 채팅은 예전 부품 그대로다.
 * 같은 날 둥근 시안 1(사용자 결정): 그 상자는 하단 탭 바와 같은 유리 캡슐로 화면 아래에 떠 있고, 위 선·바탕 띠가
 * 없어 메시지가 그 밑으로 지나간다.
 */
export default function ChatRoomScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; name?: string; userId?: string; avatar?: string }>();
  const chatId = Number(params.id);
  const [draft, setDraft] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [selectedStickerPackId, setSelectedStickerPackId] = useState(BOOKEY_STICKER_PACKS[0].id);
  const [error, setError] = useState<string | null>(null);
  // 떠 있는 입력 줄 높이 — 재기 전에는 한 줄 상자 + 최소 아래 여백으로 잡아 둔다.
  const [barHeight, setBarHeight] = useState(COMPOSER_HEIGHT + spacing.md);
  // 오류·이모티콘 판이 열리면 목록과 입력 줄 사이에 제자리를 잡는다.
  const trayOpen = error != null || stickersOpen;
  const { confirm, arm, disarm } = useDeleteConfirm<'chat'>();
  const confirmingDelete = confirm === 'chat';
  const [menuOpen, setMenuOpen] = useState(false);
  const { confirmBlock } = useBlockUser();

  // 상대 — 목록·프로필에서 들어오면 주소에 실려 오고, 알림으로 들어오면 채팅 목록 캐시(헤더 말풍선이 받아 둔다)에서 찾는다.
  const chats = useQuery({ queryKey: ['chats'], queryFn: () => chatApi.list(), staleTime: 60_000 });
  const known = chats.data?.content.find((chat) => chat.id === chatId);
  const otherId = params.userId ? Number(params.userId) : known?.otherUserId;
  const otherName = params.name ?? known?.otherNickname ?? '채팅';
  const otherAvatar = params.avatar ?? known?.otherAvatarUrl;

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
      // 돌아갈 화면이 없으면(알림으로 바로 들어온 방 등) 채팅 목록을 연다.
      if (router.canGoBack()) router.back();
      else router.replace('/chats');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '채팅을 삭제하지 못했어요.'),
  });
  const pressDelete = () => {
    if (confirmingDelete) {
      disarm();
      setMenuOpen(false);
      remove.mutate();
      return;
    }
    arm('chat');
  };
  const closeMenu = () => {
    setMenuOpen(false);
    disarm();
  };
  // 차단하면 이 방은 내게 없는 방이 된다 — 목록으로 돌아간다.
  const pressBlock = async () => {
    if (otherId == null) return;
    closeMenu();
    if (!(await confirmBlock(otherId, otherName))) return;
    queryClient.removeQueries({ queryKey: ['chatMessages', chatId] });
    if (router.canGoBack()) router.back();
    else router.replace('/chats');
  };
  const openProfile = () => {
    if (otherId == null) return;
    closeMenu();
    router.push(`/user/${otherId}`);
  };
  // 안드로이드 뒤로 가기는 열린 메뉴부터 닫는다.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const submit = () => {
    const body = draft.trim();
    if (body.length === 0 || send.isPending) return;
    send.mutate(body);
  };

  const sendSticker = (code: string) => {
    if (send.isPending) return;
    send.mutate(code);
  };

  /**
   * 메시지 한 칸 — inverted 목록이라 index 0 이 가장 새 말이고 index+1 이 바로 앞(더 오래된) 말이다.
   * 칸마다 뒤집혀 그려지므로 칸 안의 날짜 줄·위 여백은 화면에서도 그 말 위에 놓인다.
   */
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = items[index + 1];
    const newer = items[index - 1];
    const mine = item.mine === true;
    const day = item.createdAt ? chatDayKey(item.createdAt) : '';
    const time = item.createdAt ? kstTime(item.createdAt) : '';
    const startsDay = !older?.createdAt || chatDayKey(older.createdAt) !== day;
    const joinsOlder = !startsDay && older != null && (older.mine === true) === mine;
    // 같은 사람이 같은 분에 이어 보낸 말이면 시각은 묶음 끝(더 새 말)에만.
    const joinsNewer = newer?.createdAt != null && (newer.mine === true) === mine
      && chatDayKey(newer.createdAt) === day && kstTime(newer.createdAt) === time;
    return (
      <View style={{ marginTop: startsDay ? spacing.sm : joinsOlder ? spacing.xs : spacing.md }}>
        {startsDay && item.createdAt ? <ChatDaySeparator createdAt={item.createdAt} /> : null}
        <Message message={item} time={joinsNewer || !time ? undefined : time} />
      </View>
    );
  };

  return (
    <PaperScreen>
      {/* 머리와 메뉴를 한 층에 — 메뉴는 머리 바로 아래 오른쪽에 붙고, 바깥을 누르면 닫힌다(덮개는 아래 형제). */}
      <View style={styles.headLayer}>
        <SubHeader
          onBack={() => router.back()}
          center={
            <Pressable
              onPress={otherId != null ? openProfile : undefined}
              disabled={otherId == null}
              accessibilityRole={otherId != null ? 'button' : undefined}
              accessibilityLabel={otherId != null ? `${otherName}님 프로필 보기` : otherName}
              hitSlop={6}
              style={({ pressed }) => [styles.who, pressed ? pressedStyle : null]}
            >
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={styles.whoAvatar} />
              ) : (
                <View style={[styles.whoAvatar, { backgroundColor: colors.surfaceRaised }]}>
                  <PersonGlyph size={HEAD_AVATAR} color={colors.textFaint} />
                </View>
              )}
              <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.whoName, { color: colors.text }]}>
                {otherName}
              </Text>
            </Pressable>
          }
          right={
            <IconButton
              onPress={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              accessibilityLabel={menuOpen ? '메뉴 닫기' : '채팅 메뉴'}
            >
              <Ellipsis size={ICON_SIZE} color={colors.text} {...iconStroke} />
            </IconButton>
          }
        />
        {menuOpen ? (
          <View
            accessibilityRole="menu"
            style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}
          >
            {otherId != null ? <MenuItem label="프로필 보기" onPress={openProfile} /> : null}
            {otherId != null ? <MenuItem label="차단" onPress={() => void pressBlock()} /> : null}
            <MenuItem
              label={confirmingDelete ? '한 번 더' : '채팅 삭제'}
              danger
              onPress={pressDelete}
              accessibilityLabel={confirmingDelete ? '채팅 삭제 확인' : '채팅 삭제'}
            />
          </View>
        ) : null}
      </View>
      <KeyboardArea>
        <FlatList
          data={items}
          inverted
          keyExtractor={(message) => String(message.id)}
          // 간격은 칸마다 정한다(묶음 안은 좁게, 묶음 사이는 넓게) — 목록 공용 gap 은 끈다.
          // 맨 아래(inverted 라 paddingTop)는 떠 있는 입력 줄만큼 비운다 — 오류·이모티콘 판이 열리면 판이 그 자리를 비운다.
          contentContainerStyle={[
            chatListContent,
            styles.messages,
            { paddingTop: trayOpen ? spacing.lg : barHeight + spacing.lg },
          ]}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
          }}
          renderItem={renderMessage}
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

        {trayOpen ? (
          // 오류·이모티콘 판은 목록 아래 제자리에 — 판 면은 화면 끝까지 깔고, 떠 있는 입력 줄 높이만큼 아래를 비운다.
          <View
            style={[
              stickersOpen ? [styles.stickerTray, { borderTopColor: colors.line, backgroundColor: colors.surface }] : null,
              { paddingBottom: barHeight + spacing.md },
            ]}
          >
            {error ? <ChatError message={error} /> : null}
            {stickersOpen ? (
              <View style={styles.stickerPanel}>
                <BookeyPackTabs value={selectedStickerPack.id} onChange={setSelectedStickerPackId} />
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
          </View>
        ) : null}

        <ChatFloatingBar onHeight={setBarHeight}>
          <ChatComposer>
            <Pressable
              onPress={() => setStickersOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={stickersOpen ? '이모티콘 닫기' : '이모티콘 열기'}
              accessibilityState={{ expanded: stickersOpen }}
              hitSlop={COMPOSER_SLOP}
              style={({ pressed }) => [
                styles.stickerButton,
                // 닫힌 동안은 상자 안의 맨 아이콘, 열린 동안은 토글 선택 상태처럼 잉크로 뒤집는다.
                stickersOpen ? controlFace(colors.ink) : null,
                pressed ? pressedStyle : null,
              ]}
            >
              <Svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke={stickersOpen ? colors.onInk : colors.textMuted}
              >
                <Circle cx={12} cy={12} r={9} {...iconStroke} />
                <Path d="M9 9.5v1M15 9.5v1M8.5 14.5c1.9 2.2 5.1 2.2 7 0" {...iconStroke} />
              </Svg>
            </Pressable>
            <ChatInput
              value={draft}
              onChangeText={(next) => { setDraft(next); setError(null); }}
              // 유리 위에서는 textFaint 안내 글자가 흐려 한 단계 진하게 둔다.
              placeholderTextColor={colors.textMuted}
              style={composerInputStyle}
            />
            <ChatSendButton
              compact
              onPress={submit}
              disabled={draft.trim().length === 0}
              loading={send.isPending}
            />
          </ChatComposer>
        </ChatFloatingBar>
      </KeyboardArea>
      {menuOpen ? (
        <Pressable
          style={styles.menuScrim}
          onPress={closeMenu}
          accessibilityRole="button"
          accessibilityLabel="메뉴 닫기"
        />
      ) : null}
    </PaperScreen>
  );
}

/** ⋯ 메뉴 한 줄 — 44pt, 파괴적 동작(채팅 삭제)만 위험 색. */
function MenuItem({ label, onPress, danger = false, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.menuItem, pressed ? pressedStyle : null]}
    >
      <Text style={[typeScale.body, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * 메시지 한 줄 — 글은 1:1 말풍선, 이모티콘은 말풍선 없이 그림만. 상대 이름·사진은 머리에 있어 비운다.
 * 시각은 묶음 끝에만 — 말풍선과 같은 자리(옆 바닥)에 단다.
 */
function Message({ message, time }: { message: ChatMessage; time?: string }) {
  const mine = message.mine === true;
  const sticker = findBookeyChatSticker(message.body);
  if (!sticker) return <DirectBubble mine={mine} body={message.body ?? ''} time={time} />;
  return (
    <View style={[styles.stickerRow, mine ? styles.stickerRowMine : null]}>
      {mine && time ? <ChatSideTime time={time} /> : null}
      <Image
        source={sticker.source}
        style={styles.messageSticker}
        resizeMode="contain"
        accessibilityLabel={sticker.label}
      />
      {!mine && time ? <ChatSideTime time={time} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 머리 층은 목록·입력줄보다 위, 메뉴 덮개(아래 형제)보다도 위 — 메뉴가 덮개에 가리지 않게.
  headLayer: { zIndex: 3 },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  whoAvatar: {
    width: HEAD_AVATAR, height: HEAD_AVATAR, borderRadius: HEAD_AVATAR / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  whoName: { flexShrink: 1 },
  menu: {
    position: 'absolute',
    top: '100%',
    right: spacing.lg,
    minWidth: 160,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  // 메뉴 바깥을 누르면 닫는 투명 덮개 — 화면 전체, 머리 층(3) 바로 아래.
  menuScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 },
  messages: { gap: 0 },
  loading: { padding: spacing.md, alignItems: 'center' },
  stickerRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-end', gap: spacing.xs + 2 },
  stickerRowMine: { justifyContent: 'flex-end' },
  stickerTray: { borderTopWidth: hairline },
  stickerPanel: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stickerList: { gap: spacing.sm, paddingVertical: spacing.sm },
  // 그림 고르는 칸 — 버튼 면 대신 얇은 선만 두는 격자(노트 스티커 시트와 같은 칸).
  stickerCell: {
    width: 72,
    height: 72,
    borderWidth: hairline,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerThumb: { width: 66, height: 66 },
  // 입력 상자 안 보내기와 같은 40pt 동그라미 — 캡슐 양 끝이 같은 크기로 맞선다.
  stickerButton: {
    width: COMPOSER_KEY,
    height: COMPOSER_KEY,
    borderRadius: COMPOSER_KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageSticker: { width: 156, height: 156 },
});
