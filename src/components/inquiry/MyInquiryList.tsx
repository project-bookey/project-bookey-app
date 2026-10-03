import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { inquiryApi } from '@/api/endpoints';
import type { InquirySummary } from '@/api/types';
import { EmptyState, FootAction, formatRelative, linkLabel } from '@/components/ui';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

import { InquiryStatusTag } from './InquiryStatusTag';
import { INQUIRY_PAGE_SIZE, inquiriesKey } from './queries';

/** 내 문의 한 줄 — 유형·날짜 한 줄, 내용 두 줄, 오른쪽 위에 상태. */
function InquiryRow({ inquiry, onPress }: { inquiry: InquirySummary; onPress: () => void }) {
  const { colors } = useTheme();
  const status = inquiry.status === 'ANSWERED' ? '답변 완료' : '답변 대기';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${inquiry.categoryLabel} 문의, ${status}, ${formatRelative(inquiry.createdAt)}, ${inquiry.preview}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && pressedStyle]}
    >
      <View style={styles.rowHead}>
        <Text style={[typeScale.monoLabel, styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {inquiry.categoryLabel} · {formatRelative(inquiry.createdAt)}
        </Text>
        <InquiryStatusTag status={inquiry.status} />
      </View>
      <Text style={[typeScale.body, { color: colors.text }]} numberOfLines={2}>
        {inquiry.preview}
      </Text>
    </Pressable>
  );
}

/**
 * 내 문의 — 최신순 무한 목록. 줄을 누르면 문의 내용과 답변으로 간다.
 * 빈 상태에는 따로 버튼을 두지 않는다 — 화면 아래 '문의하기'가 유일한 입구다(UX 철칙 Hick).
 */
export function MyInquiryList() {
  const router = useRouter();
  const { colors } = useTheme();
  const query = useInfiniteQuery({
    queryKey: inquiriesKey,
    queryFn: ({ pageParam }) => inquiryApi.list(pageParam, INQUIRY_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });
  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.content) ?? [], [query.data]);

  return (
    <FlatList
      data={items}
      keyExtractor={(inquiry) => String(inquiry.id)}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => query.refetch()}
      renderItem={({ item }) => <InquiryRow inquiry={item} onPress={() => router.push(`/inquiry/${item.id}`)} />}
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
            ))}
          </View>
        ) : query.isError ? (
          <EmptyState
            title="문의를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={(
              <Pressable
                onPress={() => query.refetch()}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                style={styles.retry}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
              </Pressable>
            )}
          />
        ) : (
          <EmptyState
            title="아직 남긴 문의가 없어요"
            description="궁금한 점은 아래 '문의하기'로 남겨 주세요. 답변이 오면 알림으로 알려 드려요."
          />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : query.isError && items.length > 0 ? (
          <View style={styles.footer}>
            <FootAction
              label="더 불러오지 못했어요 · 다시 시도"
              onPress={() => (query.hasNextPage ? query.fetchNextPage() : query.refetch())}
              tone="accent"
              accessibilityLabel="문의 더 불러오기"
            />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  // 줄 안(유형·날짜 ↔ 내용)은 xs, 줄 사이는 괘선과 md 여백으로 나눈다(UX 철칙 Proximity).
  row: { paddingVertical: spacing.md, gap: spacing.xs, borderBottomWidth: hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowMeta: { flex: 1 },
  skeletonList: { gap: spacing.md, paddingTop: spacing.sm },
  skeleton: { height: 64, borderRadius: radius.sm },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
