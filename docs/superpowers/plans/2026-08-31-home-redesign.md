# 홈 화면 OTT 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 탭을 스펙(`docs/superpowers/specs/2026-08-31-home-redesign-design.md`)대로 OTT 구성(이벤트 배너 캐러셀 → 풀블리드 히어로 → 표지 행 4개)으로 재작성하고, 알림을 헤더 종 아이콘 + 전용 화면으로 옮긴다.

**Architecture:** 행 단위 독립 컴포넌트(`src/components/home/`) + 조립만 하는 `home.tsx`. 각 행은 자기 react-query 쿼리로 로딩·오류·빈 상태를 처리한다(부분 실패 허용). 새 파일은 전부 새 토큰(`useTheme`/`typeScale`/`sans`)만 쓴다 — 홈이 레거시 호환 레이어를 벗어나는 첫 화면이다.

**Tech Stack:** Expo(RN) + TypeScript strict + expo-router + react-query + expo-linear-gradient(이번에 추가).

## Global Constraints

- **선행 조건**: 백엔드 계획(`project-bookey-backend/docs/superpowers/plans/2026-08-31-home-content-api.md`)이 완료되어 로컬 서버(8080)가 신규 엔드포인트를 노출해야 한다. Task 1이 이를 검증한다.
- 서버 응답 타입은 생성 타입만 쓴다 — `src/api/types.ts`에 별칭 추가, 필드 손글씨 금지 (저장소 규칙).
- 새 파일과 재작성 파일(`src/components/home/*`, `app/notifications.tsx`, `app/(tabs)/home.tsx`)에서 레거시 export(`colors`, `type`, `fonts`, `elevation`, `ornament`, 정적 `lagStyle`/`paceStyle`) import 금지. 허용: `useTheme`, `darkColors`(항상 어두운 히어로·배너 오버레이 전용), `typeScale`, `sans`, `spacing`, `radius`, `hairline`, `layout`, `getLagStyle` 등 새 API.
- 검증 게이트: `npm run typecheck` (테스트 스위트 없음 — 추가하지 않는다). 마지막 태스크에서 `npm run web` 육안 검증.
- 주석·커밋 메시지는 한국어 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 푸터.
- 네이티브 의존성 설치는 `npx expo install`(버전 호환 보장)로 한다.

---

### Task 1: 타입 재생성 + API 클라이언트 확장

**Files:**
- Modify: `src/api/generated.ts` (`npm run types`가 재생성 — 손대지 않음)
- Modify: `src/api/types.ts`
- Modify: `src/api/endpoints.ts`

**Interfaces:**
- Consumes: 백엔드 신규 스키마 `BannerView`, `PopularBookView` (OpenAPI)
- Produces: `Banner`·`PopularBook` 타입, `bannerApi.list(): Promise<Banner[]>`, `bookApi.popular(size?): Promise<PopularBook[]>`, `bookApi.recommended(size?): Promise<BookSummary[]>`

- [ ] **Step 1: 백엔드 확인 + 타입 재생성**

Run: `curl -s http://localhost:8080/api/v1/banners` → `[]`(200) 확인 후 `npm run types`
Expected: `src/api/generated.ts` 재생성, diff에 `BannerView`·`PopularBookView` 스키마 등장.

- [ ] **Step 2: types.ts 별칭 추가**

`src/api/types.ts`의 「도서 · 서재」 섹션 근처에 추가:

```ts
// ── 홈 콘텐츠 ────────────────────────────────────────────
export type Banner = Schemas['BannerView'];
export type PopularBook = Schemas['PopularBookView'];
```

- [ ] **Step 3: endpoints.ts 확장**

`bookApi`에 추가:

```ts
  popular: (size = 20) => api<PopularBook[]>('/api/v1/books/popular', { query: { size } }),
  recommended: (size = 20) => api<BookSummary[]>('/api/v1/books/recommended', { query: { size } }),
```

새 `bannerApi` 추가 (파일 하단, `notificationApi` 근처):

```ts
export const bannerApi = {
  list: () => api<Banner[]>('/api/v1/banners', { auth: false }),
};
```

import 목록에 `Banner`, `PopularBook` 추가.

- [ ] **Step 4: 타입 검사**

Run: `npm run typecheck`
Expected: exit 0. (백엔드 스키마 이름이 다르면 여기서 실패한다 — 그 경우 백엔드 계획의 Global Constraints 위반이므로 백엔드를 고친다, 별칭을 손으로 우회하지 않는다.)

- [ ] **Step 5: 커밋**

```bash
git add src/api/generated.ts src/api/types.ts src/api/endpoints.ts
git commit -m "홈 콘텐츠 API 타입·클라이언트 추가 (배너·인기·추천)"
```

---

### Task 2: expo-linear-gradient + BookRow 컴포넌트

**Files:**
- Modify: `package.json`, `package-lock.json` (`npx expo install expo-linear-gradient`)
- Create: `src/components/home/BookRow.tsx`

**Interfaces:**
- Consumes: 새 토큰 API만
- Produces: `RowBook = { key: string; bookId?: number; title: string; coverUrl?: string; progress?: number; rank?: number }`, `BookRow({ title, books, loading?, onPressBook, onPressAll? })` — 빈 배열이면 스스로 null 반환(행 숨김 규칙)

- [ ] **Step 1: 의존성 설치**

Run: `npx expo install expo-linear-gradient`
Expected: package.json dependencies에 `expo-linear-gradient` 추가.

- [ ] **Step 2: BookRow.tsx 작성**

```tsx
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';

export type RowBook = {
  key: string;
  bookId?: number;
  title: string;
  coverUrl?: string;
  /** 0~1 — 읽는 중 행의 진행률 오버레이 */
  progress?: number;
  /** 인기 행의 순위 (1부터) */
  rank?: number;
};

const COVER_W = 96;
const COVER_H = 144;

/** 가로 표지 캐러셀 행. 데이터가 비면 행 전체를 숨긴다. */
export function BookRow({ title, books, loading, onPressBook, onPressAll }: {
  title: string;
  books: RowBook[];
  loading?: boolean;
  onPressBook: (book: RowBook) => void;
  onPressAll?: () => void;
}) {
  const { colors } = useTheme();

  if (!loading && books.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>{title}</Text>
        {onPressAll ? (
          <Pressable onPress={onPressAll} hitSlop={8}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>전체보기 ›</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.cover, { backgroundColor: colors.surface }]} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={books}
          keyExtractor={(b) => b.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPressBook(item)} style={styles.item}>
              <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text numberOfLines={3} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
                    {item.title}
                  </Text>
                )}
                {item.rank != null ? (
                  <View style={[styles.rank, { backgroundColor: colors.scrimDim }]}>
                    <Text style={[typeScale.label, { color: '#F5F5F5' }]}>{item.rank}</Text>
                  </View>
                ) : null}
                {item.progress != null ? (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: colors.accent }]} />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs, width: COVER_W }]}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      )}
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
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, flexDirection: 'row' },
  item: { width: COVER_W },
  cover: { width: COVER_W, height: COVER_H, borderRadius: radius.sm, overflow: 'hidden' },
  coverFallback: { padding: spacing.sm },
  rank: {
    position: 'absolute',
    top: 0,
    left: 0,
    minWidth: 22,
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomRightRadius: radius.sm,
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
});
```

- [ ] **Step 3: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add package.json package-lock.json src/components/home/BookRow.tsx
git commit -m "홈: 가로 표지 행 컴포넌트 추가"
```

---

### Task 3: BannerCarousel 컴포넌트

**Files:**
- Create: `src/components/home/BannerCarousel.tsx`

**Interfaces:**
- Consumes: Task 1의 `Banner` 타입
- Produces: `BannerCarousel({ banners })` — 0건이면 null(영역 숨김). 링크 규칙: `http(s)://` = 외부 브라우저, 그 외 = 앱 내 라우트

- [ ] **Step 1: BannerCarousel.tsx 작성**

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Banner } from '@/api/types';
import { darkColors, radius, spacing, typeScale, useTheme } from '@/theme';

const CARD_H = 108;

/**
 * 홈 최상단 이벤트 배너 — 가로 페이징 캐러셀 + 인디케이터.
 * 이미지 위 오버레이 영역이라 모드와 무관하게 어두운 톤(darkColors)을 쓴다.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);

  if (banners.length === 0) {
    return null;
  }

  const open = (banner: Banner) => {
    if (!banner.linkUrl) return;
    if (/^https?:\/\//.test(banner.linkUrl)) {
      Linking.openURL(banner.linkUrl);
    } else {
      router.push(banner.linkUrl as never);
    }
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={banners}
          keyExtractor={(b) => String(b.id)}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              style={[styles.card, { width, backgroundColor: item.bgColor ?? colors.surfaceRaised }]}
            >
              {item.imageUrl ? (
                <>
                  <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: darkColors.scrimDim }]} />
                </>
              ) : null}
              <View style={styles.cardBody}>
                <View style={[styles.tag, { backgroundColor: darkColors.accent }]}>
                  <Text style={[typeScale.overline, { color: darkColors.onAccent }]}>EVENT</Text>
                </View>
                <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: darkColors.text }]}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      ) : null}

      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={[
                styles.dot,
                i === page
                  ? { width: 12, backgroundColor: colors.accent }
                  : { backgroundColor: colors.lineStrong },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, gap: spacing.sm },
  card: { height: CARD_H, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  cardBody: { padding: spacing.md, gap: 2 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 4, height: 4, borderRadius: radius.pill },
});
```

- [ ] **Step 2: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/components/home/BannerCarousel.tsx
git commit -m "홈: 이벤트 배너 캐러셀 추가"
```

---

### Task 4: HeroContinue 컴포넌트

**Files:**
- Create: `src/components/home/HeroContinue.tsx`

**Interfaces:**
- Consumes: `ReadingRecord` 타입, `expo-linear-gradient`, `darkColors.scrimStops`
- Produces: `HeroContinue({ record, streakLine?, loading?, onContinue, onDetail, onSearch })` — `loading` 스켈레톤 / `record` 풀블리드 히어로 / `record == null` 온보딩 배너

- [ ] **Step 1: HeroContinue.tsx 작성**

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingRecord } from '@/api/types';
import { darkColors, radius, spacing, typeScale, useTheme } from '@/theme';

const HERO_H = 360;

/**
 * 풀블리드 히어로 — 표지를 확대·블러해 배경으로 깔고 스크림 위에 정보·CTA.
 * 항상 어두운 영역이므로 오버레이 색은 darkColors 고정.
 */
export function HeroContinue({ record, streakLine, loading, onContinue, onDetail, onSearch }: {
  record: ReadingRecord | null;
  streakLine?: string;
  loading?: boolean;
  onContinue: (record: ReadingRecord) => void;
  onDetail: (record: ReadingRecord) => void;
  onSearch: () => void;
}) {
  const { colors } = useTheme();

  if (loading) {
    return <View style={[styles.hero, { backgroundColor: colors.surface }]} />;
  }

  if (!record) {
    return (
      <View style={[styles.hero, styles.onboarding, { backgroundColor: colors.surface }]}>
        <Text style={[typeScale.title, { color: colors.text, textAlign: 'center' }]}>
          첫 책을 찾아보세요
        </Text>
        <Text style={[typeScale.body, { color: colors.textMuted, textAlign: 'center' }]}>
          책을 등록하고 목표일을 정하면{'\n'}페이스가 밀릴 때 알려드립니다.
        </Text>
        <Pressable onPress={onSearch} style={[styles.cta, { backgroundColor: colors.accent }]}>
          <Text style={[typeScale.label, { color: colors.onAccent }]}>책 찾기</Text>
        </Pressable>
      </View>
    );
  }

  const progress = record.progress.completionRate ?? 0;
  const hasPages = record.progress.totalPages > 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: darkColors.surfaceRaised }]}>
        {record.book?.coverUrl ? (
          <Image
            source={{ uri: record.book.coverUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={16}
          />
        ) : null}
        <LinearGradient
          colors={[...darkColors.scrimStops]}
          start={{ x: 0, y: 0.15 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.info}>
          <Text style={[typeScale.overline, { color: darkColors.accent }]}>이어 읽기</Text>
          <Text numberOfLines={2} style={[typeScale.display, { color: darkColors.text }]}>
            {record.book?.title}
          </Text>
          <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
            {record.book?.author ?? '저자 미상'}
            {hasPages
              ? ` · ${record.progress.currentPage}/${record.progress.totalPages}쪽 · ${Math.round(progress * 100)}%`
              : ''}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => onContinue(record)} style={[styles.cta, { backgroundColor: darkColors.accent }]}>
              <Text style={[typeScale.label, { color: darkColors.onAccent }]}>▶ 이어서 읽기</Text>
            </Pressable>
            <Pressable onPress={() => onDetail(record)} style={[styles.cta, styles.ghost]}>
              <Text style={[typeScale.label, { color: darkColors.text }]}>상세</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {streakLine ? (
        <Text style={[typeScale.caption, { color: colors.textMuted, paddingHorizontal: spacing.lg }]}>
          {streakLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hero: {
    height: HERO_H,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  onboarding: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  info: { padding: spacing.lg, gap: spacing.xs },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.none,
    marginVertical: spacing.sm,
  },
  fill: { height: 3, backgroundColor: darkColors.accent },
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ghost: { borderWidth: 1, borderColor: darkColors.lineStrong },
});
```

- [ ] **Step 2: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/components/home/HeroContinue.tsx
git commit -m "홈: 풀블리드 히어로 추가 (이어 읽기·온보딩 변형)"
```

---

### Task 5: 알림 화면 + 헤더 종 아이콘

**Files:**
- Create: `src/components/home/NotificationBell.tsx`
- Create: `app/notifications.tsx`
- Modify: `app/(tabs)/_layout.tsx` (screenOptions에 headerRight 추가)
- Modify: `app/_layout.tsx` (Stack.Screen 라우트 등록)

**Interfaces:**
- Consumes: 기존 `notificationApi`(list/open), `Notification` 타입(`openedAt`으로 미열람 판별)
- Produces: `NotificationBell()` (미열람 배지 + `/notifications` 이동), `/notifications` 라우트

- [ ] **Step 1: NotificationBell.tsx 작성**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationApi } from '@/api/endpoints';
import { radius, sans, useTheme } from '@/theme';

/** 헤더 우측 종 — 미열람 수 배지, 누르면 알림 화면. */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const unread = data?.content.filter((n) => !n.openedAt).length ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="알림"
    >
      <Text style={{ fontSize: 20 }}>🔔</Text>
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { fontFamily: sans.bold, color: colors.onAccent }]}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10 },
});
```

- [ ] **Step 2: notifications.tsx 작성**

```tsx
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
```

- [ ] **Step 3: 레이아웃 연결**

`app/(tabs)/_layout.tsx` — import 추가 후 `screenOptions`에 두 줄 추가:

```tsx
import { NotificationBell } from '@/components/home/NotificationBell';
// screenOptions 안:
        headerRight: () => <NotificationBell />,
        headerRightContainerStyle: { paddingRight: spacing.lg },
```

`app/_layout.tsx` — `Stack.Screen` 목록에 추가 (search 라인 근처):

```tsx
          <Stack.Screen name="notifications" options={{ title: '알림' }} />
```

- [ ] **Step 4: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/components/home/NotificationBell.tsx app/notifications.tsx 'app/(tabs)/_layout.tsx' app/_layout.tsx
git commit -m "알림 화면 분리, 헤더 종 아이콘·미열람 배지 추가"
```

---

### Task 6: home.tsx 재작성 + 육안 검증

**Files:**
- Modify: `app/(tabs)/home.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 1~5의 전부 — `bannerApi`, `bookApi.popular/recommended`, `BannerCarousel`, `HeroContinue`, `BookRow`/`RowBook`
- Produces: 최종 홈 화면

- [ ] **Step 1: home.tsx 전체 교체**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { bannerApi, bookApi, libraryApi, statsApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { formatDuration } from '@/components/ui';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { BookRow, RowBook } from '@/components/home/BookRow';
import { HeroContinue } from '@/components/home/HeroContinue';
import { layout, spacing, useTheme } from '@/theme';

/** 탭 1. 홈 — OTT 구성: 이벤트 배너 → 풀블리드 히어로 → 표지 행 4개 (홈 리디자인 스펙) */
export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const want = useQuery({ queryKey: ['library', 'WANT_TO_READ'], queryFn: () => libraryApi.list('WANT_TO_READ') });
  const stats = useQuery({ queryKey: ['stats', 30], queryFn: () => statsApi.summary(30) });
  const banners = useQuery({ queryKey: ['banners'], queryFn: bannerApi.list });
  const popular = useQuery({ queryKey: ['books', 'popular'], queryFn: () => bookApi.popular() });
  const recommended = useQuery({ queryKey: ['books', 'recommended'], queryFn: () => bookApi.recommended() });

  const records = reading.data?.content ?? [];
  const hero = pickHero(records);
  const streakLine = stats.data
    ? `${stats.data.currentStreakDays ?? 0}일 연속 · 오늘 ${formatDuration(stats.data.todayDurationSec ?? 0)}`
    : undefined;

  const refreshing = reading.isFetching || banners.isFetching;
  const refetchAll = () => {
    reading.refetch(); want.refetch(); stats.refetch();
    banners.refetch(); popular.refetch(); recommended.refetch();
  };

  const openBook = (b: RowBook) => {
    if (b.bookId != null) router.push(`/book/${b.bookId}`);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
    >
      <BannerCarousel banners={banners.data ?? []} />

      <HeroContinue
        record={hero}
        streakLine={streakLine}
        loading={reading.isLoading}
        onContinue={(r) => router.push(`/timer?recordId=${r.id}`)}
        onDetail={(r) => router.push(`/book/${r.book?.id}?recordId=${r.id}`)}
        onSearch={() => router.push('/search')}
      />

      <BookRow
        title="읽는 중"
        loading={reading.isLoading}
        books={records.map((r): RowBook => ({
          key: `reading-${r.id}`,
          bookId: r.book?.id,
          title: r.book?.title ?? '',
          coverUrl: r.book?.coverUrl,
          progress: r.progress.completionRate ?? 0,
        }))}
        onPressBook={openBook}
        onPressAll={() => router.push('/(tabs)/library')}
      />

      <BookRow
        title="읽고 싶은"
        loading={want.isLoading}
        books={(want.data?.content ?? []).map((r): RowBook => ({
          key: `want-${r.id}`,
          bookId: r.book?.id,
          title: r.book?.title ?? '',
          coverUrl: r.book?.coverUrl,
        }))}
        onPressBook={openBook}
        onPressAll={() => router.push('/(tabs)/library')}
      />

      <BookRow
        title="추천"
        loading={recommended.isLoading}
        books={(recommended.data ?? []).map((b): RowBook => ({
          key: `pick-${b.id}`,
          bookId: b.id,
          title: b.title,
          coverUrl: b.coverUrl,
        }))}
        onPressBook={openBook}
      />

      <BookRow
        title="인기"
        loading={popular.isLoading}
        books={(popular.data ?? []).map((p, i): RowBook => ({
          key: `popular-${p.book.id}`,
          bookId: p.book.id,
          title: p.book.title,
          coverUrl: p.book.coverUrl,
          rank: i + 1,
        }))}
        onPressBook={openBook}
      />
    </ScrollView>
  );
}

/** 히어로 대상: 밀린 책(lagLevel 심각한 순) 우선, 없으면 최근 읽은 책. */
const LAG_RANK: Record<string, number> = {
  L4_NEGLECTED: 4, L3_SERIOUS: 3, L2_DELAYED: 2, L1_CAUTION: 1, L0_NORMAL: 0,
};

function pickHero(records: ReadingRecord[]): ReadingRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => {
    const lag = (LAG_RANK[b.progress.lagLevel ?? ''] ?? 0) - (LAG_RANK[a.progress.lagLevel ?? ''] ?? 0);
    if (lag !== 0) return lag;
    return (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '');
  })[0];
}

const styles = StyleSheet.create({
  container: {
    ...layout.content,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
});
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck` → exit 0. 이 파일에서 레거시 import(`colors`, `type`, `fonts`, `lagStyle` 등)가 모두 사라졌는지 grep으로 확인: `grep -nE "colors,|lagStyle|fonts" "app/(tabs)/home.tsx"` → 매치 없음.

- [ ] **Step 3: 육안 검증 (웹)**

백엔드(8080) 기동 상태에서 `npm run web` (또는 떠 있는 서버 사용):
1. 다크: 배너 캐러셀 스와이프·인디케이터, 히어로 블러 배경+스크림, 행 4개 가로 스크롤.
2. 히어로 CTA → 타이머, 상세 → 도서 상세, 표지 탭 → 도서 상세, 전체보기 → 서재 탭.
3. 종 아이콘 → 알림 화면, 항목 탭 시 미열람 점·배지 감소.
4. 라이트 에뮬레이션: 행 영역은 밝게, 히어로·배너는 어둡게 유지.
5. 새 dev 계정으로 로그인해 빈 서재 → 온보딩 히어로 + (데이터 있으면) 추천·인기 행.
6. 배너 0건(서버 데이터 없음)일 때 배너 영역이 숨겨지는지.

- [ ] **Step 4: 커밋**

```bash
git add 'app/(tabs)/home.tsx'
git commit -m "홈을 OTT 구성으로 재작성 (배너·히어로·표지 행)"
```
