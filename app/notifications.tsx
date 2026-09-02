import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

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
            <Pressable
              onPress={() => (item.openedAt ? undefined : open.mutate(item.id))}
              style={styles.row}
            >
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
