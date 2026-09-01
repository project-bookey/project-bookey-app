# 서재 탭 OTT 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서재 탭을 스펙(`docs/superpowers/specs/2026-09-01-library-redesign-design.md`)대로 칩 필터 5종(멈춤 신규) + 3열 표지 그리드(첫 타일 "+ 책 추가")로 재작성한다.

**Architecture:** `app/(tabs)/library.tsx` 단일 파일 전면 재작성 — 칩 바·그리드 셀·+ 타일·빈 상태는 화면 전용 로컬 컴포넌트(별도 파일 분리 없음, YAGNI). 기존 쿼리 키(`['library', status]`, `['library','summary']`)를 그대로 써서 홈·타이머와 캐시를 공유한다. 새 토큰만 사용 — 서재가 레거시 호환 레이어를 벗어나는 두 번째 화면.

**Tech Stack:** Expo(RN) + TypeScript strict + react-query. 새 의존성 없음.

## Global Constraints

- **커밋 메시지에 AI 어트리뷰션 금지** — `Co-Authored-By`, "Generated with Claude Code" 등 일절 없이 변경 내용만 기술 (CLAUDE.md Git 규칙).
- 재작성 파일에서 레거시 테마 export(`colors`, `type`, `fonts`, `elevation`, `ornament`, 정적 `lagStyle`/`paceStyle`, `Segmented`/`Screen`/`EmptyState` 등 `@/components/ui`의 레거시 스타일 컴포넌트) 사용 금지. 허용: `useTheme`, `darkColors`, `typeScale`, `sans`, `spacing`, `radius`, `hairline`, `layout`, `statusLabel` + `@/components/ui`의 순수 유틸 함수(`formatDuration`, `percent` 등).
- 쿼리 키는 기존 그대로: `['library', status]`, `['library', 'summary']` — 변경 금지 (홈·타이머 캐시 공유).
- 검증 게이트: `npm run typecheck` exit 0 + 레거시 import grep 무매치. 마지막에 웹 육안 검증.
- 주석·커밋 메시지 한국어.

---

### Task 1: library.tsx 전면 재작성

**Files:**
- Modify: `app/(tabs)/library.tsx` (전체 교체)

**Interfaces:**
- Consumes: `libraryApi.list(status)` / `libraryApi.summary()` (기존), `ReadingRecord`·`ReadingStatus`(`@/api/types`), 새 토큰 API, `formatDuration`(`@/components/ui`)
- Produces: 최종 서재 화면 (외부 소비자 없음)

- [ ] **Step 1: library.tsx 전체 교체**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { libraryApi } from '@/api/endpoints';
import type { ReadingRecord, ReadingStatus } from '@/api/types';
import type { ColorTokens } from '@/theme';
import { darkColors, layout, radius, spacing, statusLabel, typeScale, useTheme } from '@/theme';

const FILTERS: { value: ReadingStatus; label: string }[] = [
  { value: 'READING', label: '읽는 중' },
  { value: 'WANT_TO_READ', label: '읽고 싶은' },
  { value: 'FINISHED', label: '완독' },
  { value: 'PAUSED', label: '멈춤' },
  { value: 'ABANDONED', label: '하차' },
];

/** 그리드 항목 — 첫 셀은 항상 '+ 책 추가' 타일, 로딩 중엔 스켈레톤. */
type GridItem =
  | { kind: 'add' }
  | { kind: 'skeleton'; key: number }
  | { kind: 'record'; record: ReadingRecord };

/** 탭 2. 서재 — OTT 표지 그리드: 칩 필터 5종 + 3열 포스터 월 (서재 리디자인 스펙) */
export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
  const items: GridItem[] = [
    { kind: 'add' },
    ...(list.isLoading
      ? Array.from({ length: 6 }, (_, i): GridItem => ({ kind: 'skeleton', key: i }))
      : records.map((record): GridItem => ({ kind: 'record', record }))),
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === status;
            return (
              <Pressable
                key={f.value}
                onPress={() => setStatus(f.value)}
                accessibilityRole="button"
                accessibilityLabel={f.label}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: colors.text, borderColor: colors.text }
                    : { borderColor: colors.lineStrong },
                ]}
              >
                <Text style={[typeScale.label, { color: active ? colors.bg : colors.textMuted }]}>
                  {f.label} {counts[f.value]}
                </Text>
              </Pressable>
            );
          })}
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
            <EmptyNote status={status} colors={colors} onSearch={() => router.push('/search')} />
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'add') {
            return <AddTile colors={colors} onPress={() => router.push('/search')} />;
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
              onPress={() =>
                item.record.book?.id != null &&
                router.push(`/book/${item.record.book.id}?recordId=${item.record.id}`)}
            />
          );
        }}
      />
    </View>
  );
}

/** 표지 셀 — 상태별 표현은 스펙의 '셀 상태 표현' 표를 따른다. */
function GridTile({ record, colors, onPress }: {
  record: ReadingRecord;
  colors: ColorTokens;
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
      <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[StyleSheet.absoluteFill, abandoned && styles.dimmed]}>
          {record.book?.coverUrl ? (
            <Image source={{ uri: record.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text numberOfLines={4} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
              {record.book?.title}
            </Text>
          )}
        </View>

        {record.status === 'PAUSED' ? (
          <View style={[styles.stateTag, { backgroundColor: colors.warnSoft }]}>
            <Text style={[typeScale.overline, { color: colors.warn }]}>멈춤</Text>
          </View>
        ) : null}
        {abandoned ? (
          <View style={[styles.stateTag, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[typeScale.overline, { color: colors.textFaint }]}>하차</Text>
          </View>
        ) : null}
        {record.round > 1 ? (
          <View style={[styles.roundBadge, { backgroundColor: colors.scrimDim }]}>
            <Text style={[typeScale.overline, { color: darkColors.text }]}>{record.round}회독</Text>
          </View>
        ) : null}

        {showProgress ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }]} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {record.book?.title}
      </Text>
    </Pressable>
  );
}

/** 첫 타일 — 점선 테두리 '+ 책 추가'. */
function AddTile({ colors, onPress }: { colors: ColorTokens; onPress: () => void }) {
  return (
    <Pressable style={styles.cell} onPress={onPress} accessibilityRole="button" accessibilityLabel="책 추가">
      <View style={[styles.cover, styles.addTile, { borderColor: colors.lineStrong }]}>
        <Text style={[typeScale.title, { color: colors.textMuted }]}>+</Text>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>책 추가</Text>
      </View>
    </Pressable>
  );
}

/** 빈 상태 — 기존 문구 유지. 오류 시에도 동일하게 노출된다(당겨서 새로고침으로 복구). */
function EmptyNote({ status, colors, onSearch }: {
  status: ReadingStatus;
  colors: ColorTokens;
  onSearch: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[typeScale.bodyStrong, { color: colors.text, textAlign: 'center' }]}>
        {statusLabel[status]} 책이 없어요
      </Text>
      <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
        {status === 'ABANDONED'
          ? '하차도 기록입니다. 맞지 않는 책을 내려놓는 것도 독서의 일부예요.'
          : '검색해서 서재에 담아보세요.'}
      </Text>
      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        style={[styles.emptyCta, { backgroundColor: colors.accent }]}
      >
        <Text style={[typeScale.label, { color: colors.onAccent }]}>책 찾기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipBar: { ...layout.content, paddingTop: spacing.md, paddingBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, flexDirection: 'row' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  gridContent: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.sm },
  cell: { flex: 1, maxWidth: '33.33%', marginBottom: spacing.md },
  cover: { aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: 'hidden' },
  coverFallback: { padding: spacing.sm },
  dimmed: { opacity: 0.4 },
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
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fill: { height: 3 },
  addTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyCta: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
});
```

- [ ] **Step 2: 타입 검사 + 레거시 import 검증**

Run: `npm run typecheck`
Expected: exit 0.

Run: `grep -nE "colors,|lagStyle|fonts|Segmented|EmptyState|BookCover" "app/(tabs)/library.tsx"`
Expected: 매치 없음 (레거시 컴포넌트·토큰 참조가 전부 사라졌는지 확인).

- [ ] **Step 3: 커밋**

```bash
git add 'app/(tabs)/library.tsx'
git commit -m "서재를 표지 그리드로 재작성 (칩 필터 5종·+ 타일·멈춤 필터 추가)"
```

---

### Task 2: 육안 검증 (컨트롤러 수행)

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1의 화면, 로컬 백엔드(8080)·웹 서버(8083)

- [ ] **Step 1: 웹 육안 검증**

`npm run web`(또는 8083의 기존 서버)에서:
1. 칩 5개 전환 — 각 필터의 목록·카운트, **멈춤 필터가 새로 동작**하는지
2. 첫 타일 "+ 책 추가" → 검색 화면
3. 읽는 중 표지의 진행 바, 하차 표지의 흐림+태그, 2회독 이상 뱃지
4. 빈 필터에서 빈 상태 문구 + "책 찾기" CTA (하차 전용 문구 포함)
5. 다크/라이트 모드, 당겨서 새로고침
