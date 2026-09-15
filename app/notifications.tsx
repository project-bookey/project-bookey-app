import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationApi } from '@/api/endpoints';
import type { Notification } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 알림이 가리키는 화면. 구역(섹션)은 navigate, 하위 화면은 push 로 간다. */
type Target = { href: Href; section?: boolean };

/** 페이로드 값 하나를 수로 — 서버는 수로 담지만 푸시를 거치면 문자열이 되기도 한다. */
function numberOf(payload: Notification['payload'], key: string): number | null {
  const raw = payload?.[key];
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

/**
 * 알림 한 건이 가리키는 화면 — 목적지를 모르면 null 이고, 그때는 열람 처리만 한다.
 * 페이로드 이름은 서버가 알림을 만들 때 넣는 값 그대로다.
 */
function targetOf(item: Notification): Target | null {
  const clubId = item.clubId ?? numberOf(item.payload, 'clubId');
  const club = (pathname: string, params?: Record<string, string>): Target | null =>
    clubId == null ? null : { href: { pathname, params: { id: String(clubId), ...params } } };
  const one = (pathname: string, key: string): Target | null => {
    const id = numberOf(item.payload, key);
    return id == null ? null : { href: { pathname, params: { id: String(id) } } };
  };

  switch (item.type) {
    // 모임
    case 'CLUB_WEEKLY_LOG': {
      const weekOf = item.payload?.weekOf;
      return club('/club/[id]/log/week', typeof weekOf === 'string' ? { weekOf } : undefined);
    }
    case 'CLUB_NEW_POST':
      return club('/club/[id]/posts');
    case 'CLUB_ENDED':
      return club('/club/[id]/result');
    case 'CLUB_CHECKPOINT_DUE':
    case 'CLUB_CHECKPOINT_RESULT':
    case 'CLUB_OVERTAKEN':
    case 'CLUB_FALLBEHIND':
    case 'CLUB_NUDGE':
      return club('/club/[id]');

    // 광장·밑줄
    case 'POST_LIKED':
    case 'POST_COMMENTED':
      return one('/post/[id]', 'postId');
    case 'QUOTE_AGREED':
    case 'QUOTE_COMMENTED':
      return one('/quote/[id]', 'quoteId');

    // 메신저 — 답장은 내가 보낸 엽서에 붙으므로 '보낸 엽서' 칸으로 간다.
    case 'POSTCARD_RECEIVED':
      return { href: { pathname: '/messenger', params: { pane: 'inbox' } }, section: true };
    case 'POSTCARD_REPLIED':
      return { href: { pathname: '/messenger', params: { pane: 'sent' } }, section: true };
    case 'CHAT_MESSAGE':
      return one('/chat/[id]', 'chatId');
    case 'FOLLOW_CONNECTED':
      return one('/user/[id]', 'userId');

    // 내 독서 — 알림에 담긴 건 읽기 기록 id 뿐이라 책이 아니라 서가로 보낸다.
    case 'HABIT':
    case 'LAG':
    case 'MICRO_MISSION':
    case 'STREAK':
    case 'ALMOST_DONE':
    case 'ACHIEVEMENT':
    case 'CLEANUP':
      return { href: '/library' };
    default:
      return null;
  }
}

/** 알림 목록 — 항목을 누르면 열람 처리하고, 알림이 가리키는 화면으로 간다. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const open = useMutation({
    mutationFn: (id: number) => notificationApi.open(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const tap = (item: Notification) => {
    if (!item.openedAt) open.mutate(item.id);
    const target = targetOf(item);
    if (!target) return;
    if (target.section) router.navigate(target.href);
    else router.push(target.href);
  };

  const items = list.data?.content ?? [];

  return (
    <PaperScreen>
      <SubHeader category="알림" />

      {items.length === 0 && !list.isLoading ? (
        <View style={styles.empty}>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>아직 알림이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={{ height: hairline, backgroundColor: colors.line }} />
          )}
          renderItem={({ item }) => (
            <Pressable onPress={() => tap(item)} style={styles.row}>
              <View style={styles.rowHead}>
                {!item.openedAt ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                  {formatRelative(item.sentAt ?? item.scheduledAt)}
                </Text>
              </View>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>{item.body}</Text>
            </Pressable>
          )}
        />
      )}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { ...layout.content, paddingBottom: spacing.xxl },
  row: { padding: spacing.lg, gap: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 16, lineHeight: 22, flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
