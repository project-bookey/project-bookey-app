# 하단 탭 해체 · 헤더 내비게이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-09-01-tabless-nav-design.md`)대로 `(tabs)` 그룹을 해체해 탭바를 제거하고, 서재·프로필을 홈 헤더 아이콘으로, 모임을 홈 추천 모임 섹션으로 재배치한다.

**Architecture:** 새 컴포넌트 2개(`HomeHeaderIcons`, `ClubRow`)를 먼저 만들고(독립 — Task 1), 그다음 화면 4개를 루트 Stack으로 `git mv`하고 참조 7줄을 교체·등록한다(Task 2). 화면 내용은 이동만 — 리디자인 없음.

**Tech Stack:** Expo(RN) + TypeScript strict + react-query. 새 의존성 없음.

## Global Constraints

- **커밋 규칙**: AI 어트리뷰션 금지, 첫 줄 "신규:"/"수정:" 접두 + 한국어 요약.
- 새 파일은 새 토큰 API만(`useTheme`/`typeScale`/`spacing`/`radius`). 이동하는 화면 4개의 **내용은 변경 금지**(경로 문자열 교체 제외).
- 추천 모임 섹션은 공개 모임 0건·오류여도 "+ 모임 만들기" 타일과 함께 항상 렌더된다.
- 검증 게이트: `npm run typecheck` exit 0 + `grep -rn "'/(tabs)" app src` 무매치.

---

### Task 1: HomeHeaderIcons + ClubRow 컴포넌트

**Files:**
- Create: `src/components/home/HomeHeaderIcons.tsx`
- Create: `src/components/home/ClubRow.tsx`

**Interfaces:**
- Consumes: 기존 `NotificationBell`(`./NotificationBell`), `clubApi.publicClubs()`, `ClubPreview`(`@/api/types`), 새 토큰 API
- Produces: `HomeHeaderIcons()` (홈 헤더 우측 트리오), `ClubRow()` (자체 쿼리 보유 — props 없음). Task 2가 둘을 연결한다.

- [ ] **Step 1: HomeHeaderIcons.tsx 작성**

```tsx
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/theme';

import { NotificationBell } from './NotificationBell';

/** 홈 헤더 우측 아이콘 트리오 — 종(알림) · 서재 · 프로필 (탭 해체 스펙). */
export function HomeHeaderIcons() {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <NotificationBell />
      <Pressable
        onPress={() => router.push('/library')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="서재"
      >
        <Text style={styles.icon}>📚</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/profile')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="프로필"
      >
        <Text style={styles.icon}>👤</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 20 },
});
```

- [ ] **Step 2: ClubRow.tsx 작성**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPreview } from '@/api/types';
import { radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 홈 추천 모임 행 — 공개 모임 카드 + 맨 끝 '+ 모임 만들기' 타일.
 * 탭 제거 후 유일한 모임 생성 진입점이므로 0건·오류여도 섹션을 유지한다.
 */
export function ClubRow() {
  const router = useRouter();
  const { colors } = useTheme();
  const clubs = useQuery({ queryKey: ['clubs', 'public'], queryFn: clubApi.publicClubs });

  const items = (clubs.data?.content ?? []).filter(
    (c) => c.status === 'RECRUITING' || c.status === 'ACTIVE',
  );

  const open = (club: ClubPreview) => {
    router.push(club.alreadyMember ? `/club/${club.id}` : '/clubs');
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>추천 모임</Text>
        <Pressable onPress={() => router.push('/clubs')} hitSlop={8} accessibilityRole="button" accessibilityLabel="전체보기">
          <Text style={[typeScale.label, { color: colors.textMuted }]}>전체보기 ›</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={clubs.isLoading ? [] : items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          clubs.isLoading ? (
            <View style={styles.skeletonRow}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/club/create')}
            accessibilityRole="button"
            accessibilityLabel="모임 만들기"
            style={[styles.card, styles.createTile, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.title, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>모임 만들기</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
              {item.book?.coverUrl ? (
                <Image source={{ uri: item.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text numberOfLines={3} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
                  {item.book?.title ?? item.name}
                </Text>
              )}
            </View>
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                인원 {item.memberCount}/{item.memberLimit}
              </Text>
              <View style={[styles.badge, {
                backgroundColor: item.status === 'RECRUITING' ? colors.accentSoft : colors.surfaceRaised,
              }]}>
                <Text style={[typeScale.overline, {
                  color: item.status === 'RECRUITING' ? colors.accent : colors.textMuted,
                }]}>
                  {item.status === 'RECRUITING' ? '모집 중' : '진행 중'}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: spacing.sm },
  card: { width: 150, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  cover: { width: 52, height: 78, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.xs },
  coverFallback: { padding: spacing.xs },
  createTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
});
```

- [ ] **Step 3: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/components/home/HomeHeaderIcons.tsx src/components/home/ClubRow.tsx
git commit -m "신규: 홈 헤더 아이콘 트리오·추천 모임 행 컴포넌트"
```

---

### Task 2: 라우트 이동 · 참조 교체 · 연결

**Files:**
- Move: `app/(tabs)/home.tsx` → `app/home.tsx` · `app/(tabs)/library.tsx` → `app/library.tsx` · `app/(tabs)/clubs.tsx` → `app/clubs.tsx` · `app/(tabs)/profile.tsx` → `app/profile.tsx`
- Delete: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx` · `app/home.tsx` · `app/index.tsx` · `app/login.tsx` · `app/club/[id]/index.tsx` · `src/components/LogoHome.tsx`

**Interfaces:**
- Consumes: Task 1의 `HomeHeaderIcons`, `ClubRow`
- Produces: 최종 라우트 구조 (탭바 없음)

- [ ] **Step 1: 파일 이동·삭제**

```bash
git mv 'app/(tabs)/home.tsx' app/home.tsx
git mv 'app/(tabs)/library.tsx' app/library.tsx
git mv 'app/(tabs)/clubs.tsx' app/clubs.tsx
git mv 'app/(tabs)/profile.tsx' app/profile.tsx
git rm 'app/(tabs)/_layout.tsx'
```

- [ ] **Step 2: `app/_layout.tsx` — Stack 등록 교체**

import 추가:

```tsx
import { HomeHeaderIcons } from '@/components/home/HomeHeaderIcons';
```

`<Stack.Screen name="(tabs)" options={{ headerShown: false }} />` 한 줄을 다음 4줄로 교체:

```tsx
          <Stack.Screen
            name="home"
            options={{ headerTitle: '', headerRight: () => <HomeHeaderIcons /> }}
          />
          <Stack.Screen name="library" options={{ title: '서재' }} />
          <Stack.Screen name="clubs" options={{ title: '모임' }} />
          <Stack.Screen name="profile" options={{ title: '프로필' }} />
```

(홈의 headerLeft는 공통 `HeaderBackLogo` 그대로 — 홈은 스택 루트라 `canGoBack()`이 false여서 셰브론이 자동으로 숨고 로고만 남는다.)

- [ ] **Step 3: 참조 7줄 교체**

| 파일 | 기존 | 변경 |
|---|---|---|
| `app/home.tsx` (2곳, 전체보기) | `router.push('/(tabs)/library')` | `router.push('/library')` |
| `app/index.tsx` | `status === 'authenticated' ? '/(tabs)/home' : '/login'` | `status === 'authenticated' ? '/home' : '/login'` |
| `app/login.tsx` (2곳) | `router.replace('/(tabs)/home')` | `router.replace('/home')` |
| `app/club/[id]/index.tsx` | `router.replace('/(tabs)/clubs')` | `router.replace('/clubs')` |
| `src/components/LogoHome.tsx` | `router.navigate('/(tabs)/home')` | `router.navigate('/home')` |

- [ ] **Step 4: `app/home.tsx` — 추천 모임 행 연결**

import 추가:

```tsx
import { ClubRow } from '@/components/home/ClubRow';
```

마지막 `BookRow`(제목 "인기") 컴포넌트 바로 뒤, `</ScrollView>` 이전에 추가:

```tsx
      <ClubRow />
```

- [ ] **Step 5: 검증 + 커밋**

Run: `npm run typecheck` → exit 0
Run: `grep -rn "'/(tabs)" app src` → 매치 없음

```bash
git add -A
git commit -m "수정: 하단 탭 해체 — 서재·프로필은 헤더 아이콘, 모임은 홈 추천 섹션으로

(tabs) 그룹을 루트 Stack으로 이동, 탭바 제거, 참조 경로 7곳 교체"
```

---

### Task 3: 육안 검증 (컨트롤러 수행)

**Files:** 없음

- [ ] **Step 1: 웹 육안 검증**

웹(8083)에서:
1. 하단 탭바가 사라졌는지, 홈 헤더 우측에 종·서재·프로필 아이콘
2. 서재/프로필 아이콘 → 해당 화면(‹+로고 헤더) → 뒤로가기로 홈 복귀
3. 홈 맨 아래 추천 모임 행 — 카드(표지·이름·인원·뱃지), 맨 끝 + 타일 → 모임 만들기
4. 전체보기 → 모임 화면, 로그인 → `/home` 리다이렉트, 로고 탭 홈 복귀
5. 다크/라이트
