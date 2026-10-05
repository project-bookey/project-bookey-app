import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ApiError } from '@/api/client';
import { meetingNoteApi } from '@/api/endpoints';
import type { MeetingNote } from '@/api/types';
import { parseMeetingNoteDoc } from '@/components/note';
import { NoteDocThumb } from '@/components/note/NoteDocThumb';
import { Avatar } from '@/components/Avatar';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { meetingDay, meetingWeekday } from './meetingTime';
import { meetingNotesKey } from './useMeetingNoteSync';

const COLUMNS = 3;
const GAP = spacing.xs;
const PAGE_SIZE = 18;
/** 칸 아래쪽에 겹쳐 보일 기여자 수. */
const CONTRIBUTOR_MAX = 3;

/**
 * 클럽 모임 노트 — 클럽 홈 '노트' 탭. 인스타 프로필처럼 3열 정사각 격자, 칸 하나가 모임 하나의 공유 노트.
 * 칸에는 대형노트에서 쓴 구역을 정사각으로 잘라 보이고, 왼쪽 위에 모임 날짜, 왼쪽 아래에 함께 쓴 멤버,
 * 아직 마무리하지 않은 노트는 오른쪽 위에 '작성 중'을 얹는다(마무리는 모임을 연 사람이 노트 화면에서 한다).
 * 칸을 누르면 그 노트를 연다. 노트는 모임 상세(또는 함께 독서 종료)에서 처음 생긴다 — 여기엔 새로 만들기 버튼이 없다.
 */
export function MeetingNoteGrid({ clubId, onOpenMeetings }: { clubId: number; onOpenMeetings?: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const notes = useInfiniteQuery({
    queryKey: meetingNotesKey(clubId),
    queryFn: ({ pageParam }) => meetingNoteApi.clubNotes(clubId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(clubId),
  });
  const items = useMemo(() => notes.data?.pages.flatMap((p) => p.content) ?? [], [notes.data]);
  const total = notes.data?.pages[0]?.totalElements ?? items.length;
  const contentWidth = Math.min(width, layout.content.maxWidth);
  const cell = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const open = (note: MeetingNote) => router.push({
    pathname: '/club/[id]/note/[meetingId]',
    params: { id: String(clubId), meetingId: String(note.meetingId) },
  });

  if (notes.isLoading) return <Loading />;
  if (notes.isError && items.length === 0) {
    return (
      <EmptyState
        title="모임 노트를 불러오지 못했어요"
        description={notes.error instanceof ApiError ? notes.error.message : undefined}
        action={<Button label="다시 시도" variant="outline" onPress={() => notes.refetch()} />}
      />
    );
  }

  return (
    <FlatList
      data={items}
      key={COLUMNS}
      numColumns={COLUMNS}
      keyExtractor={(n) => String(n.meetingId)}
      renderItem={({ item }) => <MeetingNoteCell note={item} size={cell} onPress={() => open(item)} />}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      onEndReached={() => {
        if (notes.hasNextPage && !notes.isFetchingNextPage) void notes.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      onRefresh={() => void notes.refetch()}
      refreshing={notes.isRefetching && !notes.isFetchingNextPage}
      ListHeaderComponent={
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 노트 · {total}권</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="아직 모임 노트가 없어요"
          description="모임을 마치면 멤버 모두가 노트 한 장에 그날을 기록할 수 있어요."
          action={onOpenMeetings ? <Button label="모임 보기" variant="outline" onPress={onOpenMeetings} /> : undefined}
        />
      }
      ListFooterComponent={notes.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.accent} style={styles.more} /> : null}
      windowSize={5}
      initialNumToRender={9}
      showsVerticalScrollIndicator={false}
    />
  );
}

/** 격자 한 칸 — 정사각 썸네일, 왼쪽 위 날짜 쪽지, 왼쪽 아래 함께 쓴 멤버. 클럽 홈의 '최근 노트'도 이 칸을 쓴다. */
export function MeetingNoteCell({ note, size, onPress }: { note: MeetingNote; size: number; onPress: () => void }) {
  const { colors } = useTheme();
  const doc = useMemo(() => parseMeetingNoteDoc(note.document), [note.document]);
  const contributors = note.contributors.slice(0, CONTRIBUTOR_MAX);
  const date = note.meetingStartsAt ? `${meetingDay(note.meetingStartsAt)} ${meetingWeekday(note.meetingStartsAt)}` : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${note.meetingTitle ?? '모임'} 노트${date ? `, ${date}` : ''}, ${note.contributors.length}명이 함께 씀${note.closedAt ? '' : ', 작성 중'}`}
      style={({ pressed }) => [styles.cell, { width: size, height: size, borderColor: colors.line, backgroundColor: colors.surface }, pressed ? pressedStyle : null]}
    >
      <NoteDocThumb doc={doc} width={size} ratio={1} />
      {date ? (
        <View pointerEvents="none" style={[styles.date, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, styles.dateText, { color: colors.text }]}>{date}</Text>
        </View>
      ) : null}
      {note.closedAt ? null : (
        <View pointerEvents="none" style={[styles.draft, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, styles.dateText, { color: colors.textMuted }]}>작성 중</Text>
        </View>
      )}
      {contributors.length > 0 ? (
        <View pointerEvents="none" style={styles.people}>
          {contributors.map((p, i) => (
            <View key={p.userId ?? i} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -6, borderColor: colors.surface }]}>
              <Avatar uri={p.avatarUrl} nickname={p.nickname ?? '멤버'} size={18} />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: GAP },
  row: { gap: GAP },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: GAP,
    borderBottomWidth: hairline,
  },
  cell: { overflow: 'hidden', borderRadius: radius.sm, borderWidth: hairline },
  date: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.badge,
    borderWidth: hairline,
  },
  dateText: { fontSize: 10 },
  draft: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.badge,
    borderWidth: hairline,
  },
  people: { position: 'absolute', left: spacing.xs, bottom: spacing.xs, flexDirection: 'row' },
  avatar: { borderWidth: 1.5, borderRadius: radius.round },
  more: { paddingVertical: spacing.md },
});
