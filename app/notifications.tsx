import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';

import { notificationApi } from '@/api/endpoints';
import type { Notification, Page } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { FootAction, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { notificationTarget, openNotificationTarget } from '@/lib/notificationTarget';
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 알림 목록 — 항목을 누르면 열람 처리하고, 알림이 가리키는 화면으로 간다.
 * 지우기는 밀어서 휴지통을 누르거나, 시각 옆 '삭제'를 두 번 누른다 — 제스처만으로 되는 기능은 두지 않는다.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const open = useMutation({
    mutationFn: (id: number) => notificationApi.open(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => notificationApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Page<Notification>>(['notifications']);
      queryClient.setQueryData<Page<Notification>>(['notifications'], (current) => current ? {
        ...current,
        content: current.content.filter((item) => item.id !== id),
        totalElements: Math.max(0, (current.totalElements ?? current.content.length) - 1),
      } : current);
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteConfirm = useDeleteConfirm<number>();
  const pressDelete = (id: number) => {
    if (deleteConfirm.confirm === id) {
      deleteConfirm.disarm();
      remove.mutate(id);
    } else {
      deleteConfirm.arm(id);
    }
  };

  const tap = (item: Notification) => {
    if (!item.openedAt) open.mutate(item.id);
    const target = notificationTarget(item);
    if (target) openNotificationTarget(target);
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
            <Swipeable
              overshootRight={false}
              rightThreshold={44}
              renderRightActions={() => (
                <View style={styles.deleteTray}>
                  <Pressable
                    onPress={() => remove.mutate(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} 알림 삭제`}
                    style={({ pressed }) => [
                      styles.deleteAction,
                      { backgroundColor: colors.danger },
                      pressed ? pressedStyle : null,
                    ]}
                  >
                    <Trash2 size={27} color={colors.bg} {...iconStroke} />
                  </Pressable>
                </View>
              )}
            >
              <Pressable onPress={() => tap(item)} style={[styles.row, { backgroundColor: colors.bg }]}>
                <View style={styles.rowHead}>
                  {!item.openedAt ? <View style={[styles.dot, { backgroundColor: colors.ink }]} /> : null}
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                    {formatRelative(item.sentAt ?? item.scheduledAt)}
                  </Text>
                  <FootAction
                    label={deleteConfirm.confirm === item.id ? '한 번 더' : '삭제'}
                    onPress={() => pressDelete(item.id)}
                    tone={deleteConfirm.confirm === item.id ? 'danger' : 'faint'}
                    accessibilityLabel={deleteConfirm.confirm === item.id ? `${item.title} 알림 삭제 확인` : `${item.title} 알림 삭제`}
                  />
                </View>
                <Text style={[styles.body, { color: colors.textMuted }]}>{item.body}</Text>
              </Pressable>
            </Swipeable>
          )}
        />
      )}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { ...layout.content, paddingBottom: spacing.xxl },
  row: { padding: spacing.lg, gap: spacing.sm, minHeight: 86 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 25, flex: 1 },
  body: { ...typeScale.body, fontSize: 15, lineHeight: 22 },
  dot: { width: 6, height: 6, borderRadius: radius.round },
  deleteTray: { width: 84, alignItems: 'center', justifyContent: 'center' },
  deleteAction: { width: 62, height: 62, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
