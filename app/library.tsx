import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Plus } from 'lucide-react-native';

import { libraryApi } from '@/api/endpoints';
import type { ReadingRecord, ReadingStatus } from '@/api/types';
import { Chip, ICON_SIZE, PaperScreen, SubHeader } from '@/components/collage';
import { Button, EmptyState } from '@/components/ui';
import type { ColorTokens, ThemeMode } from '@/theme';
import {
  controlFace, darkColors, hairline, iconStroke, layout, pressedStyle, radius, spacing, statusLabel, typeScale, useTheme,
} from '@/theme';
import { coverShadow } from '@/theme/palette';
import { serif } from '@/theme/tokens';

const FILTERS: { value: ReadingStatus; label: string }[] = [
  { value: 'READING', label: '읽는 중' },
  { value: 'WANT_TO_READ', label: '읽고 싶음' },
  { value: 'FINISHED', label: '완독' },
  { value: 'PAUSED', label: '쉬는 중' },
  { value: 'ABANDONED', label: '하차' },
];

/** 그리드 항목 — 첫 셀은 항상 '+ 책 추가' 타일, 로딩 중엔 스켈레톤. */
type GridItem =
  | { kind: 'add' }
  | { kind: 'skeleton'; key: number }
  | { kind: 'record'; record: ReadingRecord };

/**
 * 서재 — 칩 필터 5종 + 3열 표지 그리드. '나' 구역의 선반에서 전체보기로 들어온다.
 *
 * 표지 셀은 TiltCover 를 쓰지 않는다 — TiltCover 는 고정 px 폭이 전제인데 이 그리드는
 * 3열 비율(flex + aspectRatio) 로 폭이 정해지고, 셀마다 상태 태그·회독 배지·진행 바가
 * 얹힌다. 대신 같은 표지 스킨(surfaceDeep 바탕 · 헤어라인 테두리 · coverShadow · 세리프
 * 폴백 제목)만 맞춰 콜라주 언어를 공유한다.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const [status, setStatus] = useState<ReadingStatus>('READING');

  const summary = useQuery({ queryKey: ['library', 'summary'], queryFn: libraryApi.summary });
  const list = useQuery({ queryKey: ['library', status], queryFn: () => libraryApi.list(status) });

  const counts: Record<ReadingStatus, number> = {
    READING: summary.data?.reading ?? 0,
    WANT_TO_READ: summary.data?.wantToRead ?? 0,
    FINISHED: summary.data?.finished ?? 0,
    PAUSED: summary.data?.paused ?? 0,
    ABANDONED: summary.data?.abandoned ?? 0,
  };

  const records = list.data?.content ?? [];
  // 비어 있으면 아래 빈 상태의 '책 찾기'가 같은 곳으로 간다 — 입구를 둘 두지 않게 담기 칸은 뺀다.
  const showAddTile = list.isLoading || records.length > 0;
  const items: GridItem[] = [
    ...(showAddTile ? [{ kind: 'add' } as GridItem] : []),
    ...(list.isLoading
      ? Array.from({ length: 6 }, (_, i): GridItem => ({ kind: 'skeleton', key: i }))
      : records.map((record): GridItem => ({ kind: 'record', record }))),
  ];

  return (
    <PaperScreen>
      <SubHeader category="서재" />

      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={`${f.label} ${counts[f.value]}`}
              active={f.value === status}
              onPress={() => setStatus(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(item) =>
          item.kind === 'add' ? 'add' : item.kind === 'skeleton' ? `s-${item.key}` : String(item.record.id)}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching || summary.isFetching}
            onRefresh={() => {
              list.refetch();
              summary.refetch();
            }}
          />
        }
        ListFooterComponent={
          !list.isLoading && records.length === 0 ? (
            <EmptyNote status={status} onSearch={() => router.navigate('/book-search')} />
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'add') {
            return <AddTile colors={colors} onPress={() => router.navigate('/book-search')} />;
          }
          if (item.kind === 'skeleton') {
            return (
              <View style={styles.cell}>
                <View style={[styles.cover, { backgroundColor: colors.surface }]} />
              </View>
            );
          }
          return (
            <GridTile
              record={item.record}
              colors={colors}
              mode={mode}
              onPress={() =>
                item.record.book?.id != null &&
                router.push(`/book/${item.record.book.id}?recordId=${item.record.id}`)}
            />
          );
        }}
      />
    </PaperScreen>
  );
}

/** 표지 셀 — 상태별 표현은 스펙의 '셀 상태 표현' 표를 따른다. */
function GridTile({ record, colors, mode, onPress }: {
  record: ReadingRecord;
  colors: ColorTokens;
  mode: ThemeMode;
  onPress: () => void;
}) {
  const showProgress = record.status === 'READING' || record.status === 'PAUSED';
  const abandoned = record.status === 'ABANDONED';
  const progress = record.progress.completionRate ?? 0;

  return (
    <Pressable
      style={styles.cell}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={record.book?.title ?? '책'}
    >
      {/* 바깥 프레임(coverShadow 자리)과 안쪽 면(클리핑)을 나눠 둔다 — 나중에 무언가를 깔아도 잘리지 않는다. */}
      <View style={[styles.cover, { backgroundColor: colors.surfaceDeep }, coverShadow[mode].rest]}>
        <View style={[styles.coverInner, { borderColor: colors.line }]}>
          <View style={[StyleSheet.absoluteFill, abandoned && styles.dimmed]}>
            {record.book?.coverUrl ? (
              <Image source={{ uri: record.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.fallback}>
                <View style={[styles.fallbackRule, { backgroundColor: colors.textFaint }]} />
                <Text numberOfLines={3} style={[styles.fallbackTitle, { color: colors.textMuted }]}>
                  {record.book?.title ?? '표지 없음'}
                </Text>
              </View>
            )}
          </View>

          {record.status === 'PAUSED' ? (
            <View style={[styles.stateTag, { backgroundColor: colors.warnSoft }]}>
              <Text style={[typeScale.monoLabel, styles.tagText, { color: colors.warn }]}>쉬는 중</Text>
            </View>
          ) : null}
          {abandoned ? (
            <View style={[styles.stateTag, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[typeScale.monoLabel, styles.tagText, { color: colors.textFaint }]}>하차</Text>
            </View>
          ) : null}
          {record.round > 1 ? (
            <View style={[styles.roundBadge, { backgroundColor: colors.scrimDim }]}>
              <Text style={[typeScale.monoLabel, styles.tagText, { color: darkColors.text }]}>
                {record.round}회독
              </Text>
            </View>
          ) : null}

          {showProgress ? (
            <View style={[styles.track, { backgroundColor: colors.scrimDim }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }]} />
            </View>
          ) : null}
        </View>
      </View>
      <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
        {record.book?.title}
      </Text>
    </Pressable>
  );
}

/** 첫 타일 — 회색 면에 + 아이콘만(홈 '책 추가' 칸과 같은 모양, 2026-10-05 사용자 결정). 이름은 접근성 라벨로만. */
function AddTile({ colors, onPress }: { colors: ColorTokens; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && pressedStyle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="책 추가"
    >
      <View style={[styles.cover, styles.addTile, controlFace(colors.tonal)]}>
        <Plus size={ICON_SIZE} color={colors.text} {...iconStroke} />
      </View>
    </Pressable>
  );
}

/** 상태마다 문장을 통째로 둔다 — 상태 이름에 '책이 없어요'를 붙이면 '읽는 중 책이 없어요'처럼 깨진다. */
const EMPTY_TITLE: Record<ReadingStatus, string> = {
  READING: '지금 읽는 책이 없어요',
  WANT_TO_READ: '읽고 싶은 책이 없어요',
  FINISHED: '아직 다 읽은 책이 없어요',
  PAUSED: '쉬고 있는 책이 없어요',
  ABANDONED: '하차한 책이 없어요',
};

/** 빈 상태 — 오류 시에도 동일하게 노출된다(당겨서 새로고침으로 복구). */
function EmptyNote({ status, onSearch }: { status: ReadingStatus; onSearch: () => void }) {
  return (
    <EmptyState
      title={EMPTY_TITLE[status]}
      description={
        status === 'ABANDONED'
          ? '하차도 기록이에요. 맞지 않는 책을 내려놓는 것도 독서의 일부예요.'
          : '책을 찾아 서재에 담아 보세요.'
      }
      action={<Button label="책 찾기" onPress={onSearch} />}
    />
  );
}

const styles = StyleSheet.create({
  chipBar: { ...layout.content, paddingTop: spacing.sm, paddingBottom: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, flexDirection: 'row' },
  gridContent: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
  cell: { flex: 1, maxWidth: '33.33%', marginBottom: spacing.lg },
  cover: { aspectRatio: 2 / 3, borderRadius: radius.sm },
  coverInner: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.sm,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  fallbackRule: { width: 16, height: 1.5 },
  fallbackTitle: { fontFamily: serif.bold, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  dimmed: { opacity: 0.4 },
  tagText: { fontSize: 9, letterSpacing: 0.6 },
  stateTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomRightRadius: radius.sm,
  },
  roundBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomLeftRadius: radius.sm,
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  fill: { height: 3 },
  addTile: {
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
