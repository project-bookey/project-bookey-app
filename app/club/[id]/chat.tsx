import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi } from '@/api/endpoints';
import {
  ChatBubble, ChatEmpty, ChatError, ChatInput, ChatInputBar, ChatSendButton, chatListContent,
} from '@/components/chat/ChatParts';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button, Card, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/**
 * 클럽 채팅 — 클럽 홈 '채팅' 탭의 본문. 잠겨 있으면 책갈피로 여는 안내, 열리면 말풍선 목록과 입력 줄.
 * 말풍선·입력 줄·보내기는 1:1 대화방과 같은 부품(ChatParts)이다 — 상대 말은 종이에 헤어라인,
 * 내 말은 잉크 반전, 민트는 쓰지 않는다.
 */
export function ClubChatBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [showGift, setShowGift] = useState(false);
  // 이 본문은 클럽 머리(이름·탭) 아래에 끼워져 있다. KeyboardAvoidingView 는 자기 위치를
  // 부모 기준으로만 알아서, 화면 위에서 얼마나 내려와 있는지를 오프셋으로 알려 줘야 키보드가
  // 입력 줄을 가리지 않는다.
  const wrapRef = useRef<View>(null);
  const [windowY, setWindowY] = useState(0);

  const state = useQuery({
    queryKey: ['clubChat', clubId, 'state'],
    queryFn: () => clubCommunityApi.chatState(clubId),
  });
  const pages = useInfiniteQuery({
    queryKey: ['clubChat', clubId, 'messages'],
    queryFn: ({ pageParam }) => clubCommunityApi.chatMessages(clubId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (p) => p.nextBeforeId,
    enabled: state.data?.unlocked === true,
    refetchInterval: 4000,
  });
  const candidates = useQuery({
    queryKey: ['clubChat', clubId, 'giftCandidates'],
    queryFn: () => clubCommunityApi.giftCandidates(clubId),
    enabled: showGift,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['clubChat', clubId] });
  const unlock = useMutation({ mutationFn: () => clubCommunityApi.unlockChat(clubId), onSuccess: refresh });
  const gift = useMutation({
    mutationFn: (userId: number) => clubCommunityApi.giftChat(clubId, userId),
    onSuccess: refresh,
  });
  const send = useMutation({
    mutationFn: (body: string) => clubCommunityApi.sendChat(clubId, body),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
  });
  const items = useMemo(() => pages.data?.pages.flatMap((p) => p.messages) ?? [], [pages.data]);

  const giftSheet = (
    <NoteSheet visible={showGift} title="채팅 이용권 선물" onClose={() => setShowGift(false)}>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>
        내 책갈피 2개로 고른 멤버의 채팅을 열어 줘요.
      </Text>
      <ScrollView style={{ maxHeight: 320 }}>
        {(candidates.data ?? []).map((c) => (
          <View key={c.userId} style={[styles.giftRow, { borderBottomColor: colors.line }]}>
            <Text style={[typeScale.body, { color: colors.text }]}>{c.nickname}</Text>
            <Button
              size="sm"
              variant={c.unlocked ? 'ghost' : 'outline'}
              label={c.unlocked ? '이용 중' : '2개 선물'}
              disabled={c.unlocked || gift.isPending}
              onPress={() => gift.mutate(c.userId)}
            />
          </View>
        ))}
      </ScrollView>
      {gift.error ? (
        <Text style={[typeScale.caption, { color: colors.danger }]}>
          {errorText(gift.error, '책갈피가 부족하거나 선물할 수 없어요.')}
        </Text>
      ) : null}
      <Button label="닫기" variant="ghost" size="sm" onPress={() => setShowGift(false)} />
    </NoteSheet>
  );

  if (state.isLoading) return <Loading />;

  const giftBar = (
    <View style={styles.giftBar}>
      <Button label="선물" size="sm" variant="ghost" onPress={() => setShowGift(true)} />
    </View>
  );

  if (!state.data?.unlocked) {
    const cost = state.data?.unlockCost ?? 2;
    return (
      <View style={styles.fill}>
        {giftBar}
        {giftSheet}
        <View style={styles.lock}>
          <Card style={{ gap: spacing.sm }}>
            <Text style={[styles.lockTitle, { color: colors.text }]}>
              새 메시지 {state.data?.unreadCount ?? 0}개
            </Text>
            <Text style={[typeScale.body, { color: colors.textMuted }]}>
              책갈피 {cost}개로 채팅을 열면 이전 대화 전체를 읽고 메시지를 보낼 수 있어요.
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              현재 책갈피 {state.data?.bookmarkBalance ?? 0}개 · 해제 후 환불되지 않아요.
            </Text>
            <Button
              label={`책갈피 ${cost}개로 열기`}
              onPress={() => unlock.mutate()}
              loading={unlock.isPending}
              style={{ marginTop: spacing.xs }}
            />
            {unlock.error ? (
              <Text style={[typeScale.caption, { color: colors.danger }]}>
                {errorText(unlock.error, '책갈피가 부족하거나 채팅을 열 수 없어요.')}
              </Text>
            ) : null}
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View
      ref={wrapRef}
      style={styles.fill}
      onLayout={() => wrapRef.current?.measureInWindow((_x, y) => setWindowY(y))}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={windowY}
        style={styles.fill}
      >
        {giftBar}
        {giftSheet}
        <FlatList
          style={styles.fill}
          inverted
          data={items}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={chatListContent}
          // 1:1 대화방과 같게 — 이전 메시지를 받는 중엔 다시 부르지 않고, 목록 끝(위쪽)에 진행 표시를 둔다.
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (pages.hasNextPage && !pages.isFetchingNextPage) pages.fetchNextPage();
          }}
          ListFooterComponent={
            pages.isFetchingNextPage ? (
              <View style={styles.paging}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ChatBubble mine={item.mine} body={item.body} sender={item.senderNickname} createdAt={item.createdAt} />
          )}
          ListEmptyComponent={<ChatEmpty description="첫 마디를 남겨 보세요." />}
        />
        {send.error ? <ChatError message={errorText(send.error, '메시지를 보내지 못했어요.')} /> : null}
        <ChatInputBar>
          <ChatInput
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              // 1:1 대화방처럼 다시 쓰기 시작하면 실패 문구를 거둔다.
              if (send.isError) send.reset();
            }}
          />
          <ChatSendButton
            onPress={() => {
              const body = draft.trim();
              if (body) send.mutate(body);
            }}
            disabled={draft.trim().length === 0}
            loading={send.isPending}
          />
        </ChatInputBar>
      </KeyboardAvoidingView>
    </View>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  paging: { paddingVertical: spacing.md, alignItems: 'center' },
  giftBar: {
    ...layout.content,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  lock: { ...layout.content, flex: 1, justifyContent: 'center', padding: spacing.lg },
  lockTitle: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27 },
  giftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
  },
});

/** 딥링크 호환 — 채팅은 이제 클럽 홈의 탭이다. */
export default function ClubChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'chat' } }} />;
}
