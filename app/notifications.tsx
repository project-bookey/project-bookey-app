import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationApi } from '@/api/endpoints';
import { formatRelative } from '@/components/ui';
import { hairline, spacing, typeScale, useTheme } from '@/theme';

/** 알림 목록 — 항목을 누르면 열람 처리한다. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const open = useMutation({
    mutationFn: (id: number) => notificationApi.open(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = list.data?.content ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {items.length === 0 && !list.isLoading ? (
        <View style={styles.empty}>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>아직 알림이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          ItemSeparatorComponent={() => (
            <View style={{ height: hairline, backgroundColor: colors.line }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => (item.openedAt ? undefined : open.mutate(item.id))}
              style={styles.row}
            >
              <View style={styles.rowHead}>
                {!item.openedAt ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                <Text style={[typeScale.bodyStrong, { color: colors.text, flex: 1 }]}>{item.title}</Text>
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  {formatRelative(item.sentAt ?? item.scheduledAt)}
                </Text>
              </View>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>{item.body}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { padding: spacing.lg, gap: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
