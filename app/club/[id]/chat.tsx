import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, clubCommunityApi } from '@/api/endpoints';
import {
  ChatBubble, ChatEmpty, ChatError, ChatInput, ChatInputBar, ChatSendButton, chatListContent,
} from '@/components/chat/ChatParts';
import { PaperScreen, SubHeader } from '@/components/collage';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button, Card, FootAction, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';

/** 새 메시지 폴링 주기(ms) — 1:1 대화방과 같다. */
const POLL_MS = 4000;

/**
 * 클럽 채팅 — 클럽 홈 헤더의 말풍선에서 여는 전체 화면. 1:1 대화방(/chat/[id])과 같은 모양이라
 * 키보드가 올라와도 머리·탭에 자리를 뺏기지 않고, 뒤로 가면 클럽 홈으로 돌아온다.
 * 잠겨 있으면 책갈피로 여는 안내, 열리면 말풍선 목록과 입력 줄. 말풍선·입력 줄·보내기는
 * 1:1 대화방과 같은 부품(ChatParts)이다 — 상대 말은 종이에 헤어라인, 내 말은 잉크 반전, 민트는 쓰지 않는다.
 */
export default function ClubChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [showGift, setShowGift] = useState(false);

  // 머리의 클럽 이름 — 클럽 홈에서 왔으면 이미 캐시에 있다.
  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });
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
    refetchInterval: POLL_MS,
    // 백그라운드에서는 네트워크·배터리를 쓰지 않고, 복귀 이벤트에서 즉시 동기화한다.
    refetchIntervalInBackground: false,
  });
  const { refetch: refetchMessages } = pages;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetchMessages();
    });
    return () => subscription.remove();
  }, [refetchMessages]);

  // 메시지를 받으면 서버가 읽음으로 적는다 — 나가면 클럽 홈 말풍선의 안 읽음 배지를 새로 받게 한다.
  useEffect(
    () => () => {
      void qc.invalidateQueries({ queryKey: ['clubChat', clubId, 'state'] });
    },
    [qc, clubId],
  );
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

  const header = (
    <SubHeader
      category={club.data?.name ?? '클럽 채팅'}
      right={
        <View style={styles.headerAction}>
          <FootAction label="선물" onPress={() => setShowGift(true)} accessibilityLabel="채팅 이용권 선물" />
        </View>
      }
    />
  );

  if (state.isLoading) {
    return (
      <PaperScreen>
        {header}
        <Loading />
      </PaperScreen>
    );
  }

  if (!state.data?.unlocked) {
    const cost = state.data?.unlockCost ?? 2;
    return (
      <PaperScreen>
        {header}
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
      </PaperScreen>
    );
  }

  return (
    <PaperScreen>
      {header}
      {giftSheet}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.fill}
      >
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
    </PaperScreen>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  paging: { paddingVertical: spacing.md, alignItems: 'center' },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
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
