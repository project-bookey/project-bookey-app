import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubChatMessage } from '@/api/endpoints';
import { kstTime } from '@/components/clubLog';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, iconStroke, mono, pressedStyle } from '@/theme/tokens';

/**
 * 클럽 채팅 — 클럽 홈 '채팅' 탭의 본문. 잠겨 있으면 책갈피로 여는 안내, 열리면 말풍선 목록과 입력 줄.
 * 상대 말은 종이(surface)에 헤어라인 말풍선, 내 말은 잉크 반전. 민트는 쓰지 않는다 —
 * 보내기도 잉크 네모에 선 아이콘이다. 이름·시각은 모노.
 */
export function ClubChatBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [showGift, setShowGift] = useState(false);
  // 이 본문은 클럽 머리(표지·숫자 띠·탭) 아래에 끼워져 있다. KeyboardAvoidingView 는 자기 위치를
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
  const canSend = draft.trim().length > 0 && !send.isPending;

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
          contentContainerStyle={styles.list}
          onEndReached={() => pages.hasNextPage && pages.fetchNextPage()}
          renderItem={({ item }) => <Bubble message={item} />}
          ListEmptyComponent={
            // inverted 목록은 빈 상태도 뒤집혀 그려지므로 한 번 더 뒤집는다.
            <View style={styles.flip}>
              <EmptyState title="아직 대화가 없어요" description="첫 마디를 남겨 보세요." />
            </View>
          }
        />
        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: colors.line,
              backgroundColor: colors.bg,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="메시지 보내기"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={1000}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
          />
          <Pressable
            onPress={() => {
              const body = draft.trim();
              if (body) send.mutate(body);
            }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="보내기"
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: canSend ? colors.ink : colors.surfaceRaised },
              pressed && canSend ? pressedStyle : null,
            ]}
          >
            {send.isPending ? (
              <ActivityIndicator size="small" color={colors.onInk} />
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={canSend ? colors.onInk : colors.textFaint}>
                <Path d="M12 19V5M6 11l6-6 6 6" {...iconStroke} />
              </Svg>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 말풍선 한 장 — 상대는 종이에 헤어라인, 나는 잉크 반전. 이름·시각은 모노. */
function Bubble({ message }: { message: ClubChatMessage }) {
  const { colors } = useTheme();
  const mine = message.mine;
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.ink }
            : { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.line },
        ]}
      >
        {!mine ? (
          <Text style={[styles.who, { color: colors.textFaint }]}>{message.senderNickname}</Text>
        ) : null}
        <Text style={[typeScale.body, { color: mine ? colors.onInk : colors.text }]}>{message.body}</Text>
        <Text style={[styles.time, { color: mine ? colors.mid : colors.textFaint }]}>
          {kstTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  giftBar: {
    ...layout.content,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  lock: { ...layout.content, flex: 1, justifyContent: 'center', padding: spacing.lg },
  lockTitle: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27 },
  list: { ...layout.content, padding: spacing.lg, gap: spacing.md },
  flip: { transform: [{ scaleY: -1 }] },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    gap: 3,
  },
  who: { fontFamily: mono.medium, fontSize: 9.5, letterSpacing: 0.4 },
  time: { fontFamily: mono.regular, fontSize: 9.5, letterSpacing: 0.3, alignSelf: 'flex-end', marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: hairline,
  },
  input: {
    ...typeScale.body,
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: hairline,
    borderRadius: radius.sm,
  },
  send: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
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
