# 도서 상세 OTT 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 도서 상세를 스펙(`docs/superpowers/specs/2026-09-01-book-detail-redesign-design.md`)대로 풀블리드 히어로 + 카드 섹션 + 2탭 확인 + 소개 접기 + 리뷰 쓰기 인라인 폼으로 재작성한다.

**Architecture:** 2탭 확인 패턴만 `src/components/ConfirmButton.tsx`로 공용 추출(모임 화면들이 곧 재사용)하고, 나머지(히어로·진척 카드·소개·검증·세션·리뷰 폼)는 `app/book/[id].tsx` 화면 로컬 컴포넌트로 둔다. 쿼리 키·뮤테이션은 기존 그대로 + `reviewApi.create`만 신규.

**Tech Stack:** Expo(RN) + TypeScript strict + react-query + expo-linear-gradient(기설치). 새 의존성 없음.

## Global Constraints

- **커밋 규칙**: AI 어트리뷰션 금지, 첫 줄 "신규:"/"수정:" 접두 + 한국어 요약 (CLAUDE.md + 커밋 스타일).
- 레거시 테마 export·레거시 UI 컴포넌트(`Screen`, `Card`, `Eyebrow`, `KeyValue`, `Loading`, `Numeral`, `ProgressBar`, `Rule`, `Tag`, `Button`, `BookCover`) 사용 금지. 허용: 새 토큰 API + `@/components/ui`의 순수 유틸(`formatDuration`, `formatRelative`, `percent`).
- 쿼리 키 기존 유지: `['book', bookId]` · `['library','record',rid]` · `['sessions', rid]` · `['review','preview',rid]` · `['book', bookId, 'reviews']`.
- 하차 사유는 기존 `'NOT_MY_TASTE'` 유지. 담기 CTA는 넣지 않는다 (스펙 결정).
- 히어로·오버레이 색은 `darkColors` 고정, 카드 영역은 `useTheme().colors` (홈 히어로와 같은 문법).
- 검증 게이트: `npm run typecheck` exit 0 + 레거시 import 부재 확인.

---

### Task 1: ConfirmButton 공용 컴포넌트

**Files:**
- Create: `src/components/ConfirmButton.tsx`

**Interfaces:**
- Consumes: 새 토큰 API만
- Produces: `ConfirmButton({ label, question, confirmLabel?, tone?: 'accent'|'danger', variant?: 'outline'|'ghost', pending?, onConfirm })` — 1탭에 질문+[확정][취소]로 전환, pending 종료 시 자동 원상 복귀. Task 2가 완독·하차에 사용.

- [ ] **Step 1: ConfirmButton.tsx 작성**

```tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 2탭 확인 버튼 — 1탭에 질문 + [확정][취소]로 전환되고, 확정 시 onConfirm을 실행한다.
 * pending이 true→false로 떨어지면(성공·실패 무관) 자동으로 원래 버튼으로 복귀한다.
 * 실패 안내 캡션은 호출부가 뮤테이션 상태로 표시한다.
 */
export function ConfirmButton({ label, question, confirmLabel = '확정', tone = 'accent', variant = 'outline', pending = false, onConfirm }: {
  label: string;
  question: string;
  confirmLabel?: string;
  /** 확정 버튼 색 — accent(완독 등) | danger(하차 등) */
  tone?: 'accent' | 'danger';
  /** 대기 상태 버튼 모양 */
  variant?: 'outline' | 'ghost';
  pending?: boolean;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const [arming, setArming] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending) {
      setWasPending(true);
    } else if (wasPending) {
      setArming(false);
      setWasPending(false);
    }
  }, [pending, wasPending]);

  if (arming) {
    const confirmBg = tone === 'danger' ? colors.danger : colors.accent;
    const confirmFg = tone === 'danger' ? colors.bg : colors.onAccent;
    return (
      <View style={styles.row}>
        <Text style={[typeScale.caption, { color: colors.textMuted, flex: 1 }]}>{question}</Text>
        <Pressable
          disabled={pending}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[styles.button, { backgroundColor: confirmBg, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={[typeScale.label, { color: confirmFg }]}>
            {pending ? '처리 중…' : confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          disabled={pending}
          onPress={() => setArming(false)}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={[styles.button, { borderWidth: 1, borderColor: colors.lineStrong }]}
        >
          <Text style={[typeScale.label, { color: colors.textMuted }]}>취소</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setArming(true)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        styles.idle,
        variant === 'outline' ? { borderWidth: 1, borderColor: colors.lineStrong } : null,
      ]}
    >
      <Text style={[typeScale.label, { color: variant === 'ghost' ? colors.textFaint : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  idle: { alignSelf: 'stretch' },
});
```

- [ ] **Step 2: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/components/ConfirmButton.tsx
git commit -m "신규: 2탭 확인 버튼 공용 컴포넌트"
```

---

### Task 2: book/[id].tsx 전면 재작성

**Files:**
- Modify: `app/book/[id].tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 `ConfirmButton`, 기존 API(`bookApi.detail/reviews`, `libraryApi.detail/finish/abandon`, `sessionApi.listByRecord`, `reviewApi.preview/create`), `ApiError`(`@/api/client`), 새 토큰 API, `formatDuration`·`formatRelative`·`percent`(`@/components/ui`)
- Produces: 최종 도서 상세 화면

- [ ] **Step 1: book/[id].tsx 전체 교체**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import type { BookSummary, VerificationLevel } from '@/api/types';
import { ConfirmButton } from '@/components/ConfirmButton';
import { formatDuration, formatRelative, percent } from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { darkColors, getLagStyle, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  VERIFIED_FULL: '완독 검증',
  VERIFIED_PARTIAL: '부분 검증',
  UNVERIFIED: '미검증',
  FLAGGED: '검토 중',
};

/** 도서 상세 — 풀블리드 히어로 + 진척·소개·검증·세션·리뷰 (도서 상세 리디자인 스펙) */
export default function BookDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id, recordId } = useLocalSearchParams<{ id: string; recordId?: string }>();
  const bookId = Number(id);
  const rid = recordId ? Number(recordId) : null;

  const book = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => bookApi.detail(bookId),
    enabled: Number.isFinite(bookId),
  });
  const record = useQuery({
    queryKey: ['library', 'record', rid],
    queryFn: () => libraryApi.detail(rid!),
    enabled: rid != null,
  });
  const sessions = useQuery({
    queryKey: ['sessions', rid],
    queryFn: () => sessionApi.listByRecord(rid!),
    enabled: rid != null,
  });
  const verification = useQuery({
    queryKey: ['review', 'preview', rid],
    queryFn: () => reviewApi.preview(rid!),
    enabled: rid != null,
  });
  // 리뷰 목록 쿼리는 ReviewSection이 소유한다 (화면 컴포넌트에 중복 선언 금지)

  const invalidateRecord = () => {
    queryClient.invalidateQueries({ queryKey: ['library'] });
    queryClient.invalidateQueries({ queryKey: ['library', 'record', rid] });
    queryClient.invalidateQueries({ queryKey: ['review', 'preview', rid] });
  };
  const finish = useMutation({ mutationFn: () => libraryApi.finish(rid!), onSuccess: invalidateRecord });
  const abandon = useMutation({
    mutationFn: () => libraryApi.abandon(rid!, 'NOT_MY_TASTE'),
    onSuccess: invalidateRecord,
  });

  const info = book.data?.book;
  const description = book.data?.description;
  const progress = record.data?.progress;
  const lag = progress ? getLagStyle(colors)[progress.lagLevel] : null;
  const actionFailed = (finish.isError && !finish.isPending) || (abandon.isError && !abandon.isPending);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      {book.isLoading ? (
        <View style={[styles.hero, { backgroundColor: colors.surface }]} />
      ) : (
        <Hero info={info} />
      )}

      <View style={styles.sections}>
        {record.data && progress ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHead}>
              <Text style={[typeScale.overline, { color: colors.accent }]}>내 진척</Text>
              {lag && progress.lagLevel !== 'L0_NORMAL' ? (
                <View style={[styles.tag, { backgroundColor: lag.bg }]}>
                  <Text style={[typeScale.overline, { color: lag.fg }]}>{lag.label}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.progressNumbers}>
              <Text style={[styles.bigNumber, { fontFamily: sans.extraBold, color: colors.text }]}>
                {progress.currentPage}
              </Text>
              <Text style={[typeScale.body, { color: colors.textFaint }]}>
                {progress.totalPages > 0 ? ` / ${progress.totalPages}쪽` : '쪽'}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textMuted, marginLeft: 'auto' }]}>
                {percent(progress.completionRate)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.line }]}>
              <View style={[styles.fill, {
                width: `${Math.round((progress.completionRate ?? 0) * 100)}%`,
                backgroundColor: colors.accent,
              }]} />
            </View>

            <KV label="누적 독서시간" value={formatDuration(progress.totalDurationSec)} colors={colors} />
            <KV label="최근 7일 페이스" value={`${(progress.actualDailyPace ?? 0).toFixed(1)}쪽/일`} colors={colors} />
            {progress.requiredDailyPace != null ? (
              <KV label="필요 페이스" value={`${progress.requiredDailyPace.toFixed(1)}쪽/일`} colors={colors} />
            ) : null}
            {progress.estimatedFinishDate ? (
              <KV label="예상 완독일" value={progress.estimatedFinishDate} colors={colors} />
            ) : null}

            <Pressable
              onPress={() => router.push(`/timer?recordId=${rid}`)}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: colors.accent }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>▶ 독서 시작</Text>
            </Pressable>
            {record.data.status !== 'FINISHED' ? (
              <ConfirmButton
                label="완독 처리"
                question="완독으로 기록할까요?"
                tone="accent"
                pending={finish.isPending}
                onConfirm={() => finish.mutate()}
              />
            ) : null}
            {record.data.status === 'READING' ? (
              <ConfirmButton
                label="하차하기"
                question="정말 하차할까요?"
                tone="danger"
                variant="ghost"
                pending={abandon.isPending}
                onConfirm={() => abandon.mutate()}
              />
            ) : null}
            {actionFailed ? (
              <Text style={[typeScale.caption, { color: colors.warn }]}>
                처리하지 못했어요 · 다시 시도
              </Text>
            ) : null}
          </View>
        ) : null}

        {description ? <DescriptionCard text={description} colors={colors} /> : null}

        {verification.data ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[typeScale.overline, { color: colors.accent }]}>리뷰 검증 상태</Text>
            <View style={styles.verifyHead}>
              <Text style={[typeScale.title, { color: colors.text }]}>
                {VERIFICATION_LABEL[verification.data.expectedLevel]}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                지금 리뷰를 쓰면 받게 될 배지
              </Text>
            </View>
            <KV label="읽은 범위" value={percent(verification.data.coverage)} colors={colors} />
            <KV label="타이머 세션" value={`${verification.data.timerSessionCount}회`} colors={colors} />
            <KV
              label="인정 독서시간"
              value={`${verification.data.verifiedMinutes}분 / 최소 ${verification.data.requiredMinutes}분`}
              colors={colors}
            />
            {verification.data.flags.length > 0 ? (
              <Text style={[typeScale.caption, { color: colors.warn }]}>
                신호: {verification.data.flags.join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {sessions.data && sessions.data.length > 0 ? (
          <View style={styles.section}>
            <Text style={[typeScale.section, { color: colors.text }]}>세션 기록</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, gap: 0 }]}>
              {sessions.data.slice(0, 8).map((session, index) => (
                <View
                  key={session.id}
                  style={[styles.sessionRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                      {session.startPage ?? 0} → {session.endPage ?? session.startPage ?? 0}쪽
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                      {formatRelative(session.startedAt)} · {session.source === 'TIMER' ? '타이머' : '수동'}
                      {!session.countedForVerification ? ' · 검증 제외' : ''}
                    </Text>
                  </View>
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                    {formatDuration(session.durationSec)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <ReviewSection bookId={bookId} rid={rid} colors={colors} />
      </View>
    </ScrollView>
  );
}

/** 풀블리드 히어로 — 블러 표지 배경 + 중앙 원본 표지. 오버레이는 darkColors 고정. */
function Hero({ info }: { info?: BookSummary }) {
  return (
    <View style={[styles.hero, { backgroundColor: darkColors.surfaceRaised }]}>
      {info?.coverUrl ? (
        <Image source={{ uri: info.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={16} />
      ) : null}
      <LinearGradient
        colors={[...darkColors.scrimStops]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        <View style={[styles.heroCover, { backgroundColor: darkColors.surface }]}>
          {info?.coverUrl ? (
            <Image source={{ uri: info.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text numberOfLines={4} style={[typeScale.caption, { color: darkColors.textMuted, padding: spacing.sm }]}>
              {info?.title}
            </Text>
          )}
        </View>
        <Text numberOfLines={2} style={[typeScale.title, styles.heroTitle, { color: darkColors.text }]}>
          {info?.title}
        </Text>
        <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
          {info?.author ?? '저자 미상'}
          {info?.publisher ? ` · ${info.publisher}` : ''}
          {info?.totalPages ? ` · ${info.totalPages}쪽` : ''}
        </Text>
      </View>
    </View>
  );
}

function KV({ label, value, colors }: { label: string; value: string; colors: ColorTokens }) {
  return (
    <View style={styles.kv}>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typeScale.caption, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

/** 소개 — 3줄 미리보기 + 더보기/접기. */
function DescriptionCard({ text, colors }: { text: string; colors: ColorTokens }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[typeScale.overline, { color: colors.accent }]}>소개</Text>
      <Text numberOfLines={expanded ? undefined : 3} style={[typeScale.body, { color: colors.textMuted }]}>
        {text}
      </Text>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <Text style={[typeScale.label, { color: colors.textFaint }]}>
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </Text>
      </Pressable>
    </View>
  );
}

/** 리뷰 목록 + (record 있을 때) 인라인 작성 폼. */
function ReviewSection({ bookId, rid, colors }: { bookId: number; rid: number | null; colors: ColorTokens }) {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ['book', bookId, 'reviews'],
    queryFn: () => bookApi.reviews(bookId),
    enabled: Number.isFinite(bookId),
  });

  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  const create = useMutation({
    mutationFn: () =>
      reviewApi.create({ readingRecordId: rid!, rating: rating || undefined, body: body.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'preview', rid] });
      setOpen(false);
      setDone(true);
    },
  });

  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError
        ? create.error.message
        : '등록하지 못했어요 · 다시 시도'
      : null;

  const items = reviews.data?.content ?? [];

  return (
    <View style={styles.section}>
      <View style={styles.cardHead}>
        <Text style={[typeScale.section, { color: colors.text }]}>리뷰</Text>
        {rid != null && !done && !open ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8}>
            <Text style={[typeScale.label, { color: colors.accent }]}>리뷰 쓰기</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n === rating ? 0 : n)} hitSlop={6}
                accessibilityRole="button" accessibilityLabel={`별점 ${n}`}>
                <Text style={{ fontSize: 24, color: n <= rating ? colors.accent : colors.lineStrong }}>★</Text>
              </Pressable>
            ))}
            <Text style={[typeScale.caption, { color: colors.textFaint, marginLeft: spacing.sm }]}>
              {rating > 0 ? `${rating}점` : '별점 선택 (선택 사항)'}
            </Text>
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="이 책은 어땠나요?"
            placeholderTextColor={colors.textFaint}
            multiline
            style={[styles.reviewInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
          />
          {errorMessage ? (
            <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
          ) : null}
          <View style={styles.formActions}>
            <Pressable
              disabled={body.trim().length === 0 || create.isPending}
              onPress={() => create.mutate()}
              accessibilityRole="button"
              style={[styles.cta, {
                backgroundColor: colors.accent,
                opacity: body.trim().length === 0 || create.isPending ? 0.5 : 1,
                flex: 1,
              }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>
                {create.isPending ? '등록 중…' : '등록'}
              </Text>
            </Pressable>
            <Pressable
              disabled={create.isPending}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              style={[styles.cta, { borderWidth: 1, borderColor: colors.lineStrong, flex: 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.textMuted }]}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            아직 리뷰가 없습니다. 완독하면 검증 배지와 함께 첫 리뷰를 남길 수 있어요.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, gap: 0 }]}>
          {items.map((review, index) => (
            <View
              key={review.id}
              style={[styles.reviewRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
            >
              <View style={styles.reviewHead}>
                <Text style={[typeScale.label, { color: colors.text }]}>{review.authorNickname}</Text>
                <View style={[styles.tag, {
                  backgroundColor: review.verificationLevel === 'VERIFIED_FULL' ? colors.accentSoft : colors.surfaceRaised,
                }]}>
                  <Text style={[typeScale.overline, {
                    color: review.verificationLevel === 'VERIFIED_FULL' ? colors.accent : colors.textMuted,
                  }]}>
                    {VERIFICATION_LABEL[review.verificationLevel]}
                  </Text>
                </View>
                {review.rating ? (
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>★ {review.rating}</Text>
                ) : null}
              </View>
              <Text style={[typeScale.body, { color: colors.text }]}>{review.body}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  hero: { height: 340, justifyContent: 'flex-end' },
  heroContent: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.lg },
  heroCover: {
    width: 110,
    height: 165,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  heroTitle: { textAlign: 'center', paddingHorizontal: spacing.xl },
  sections: { ...layout.content, padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  card: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  progressNumbers: { flexDirection: 'row', alignItems: 'baseline' },
  bigNumber: { fontSize: 28 },
  track: { height: 4, borderRadius: radius.none },
  fill: { height: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between' },
  cta: {
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  verifyHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reviewInput: {
    minHeight: 96,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  reviewRow: { paddingVertical: spacing.md, gap: spacing.xs },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
```

주의: 리뷰 목록 쿼리(`['book', bookId, 'reviews']`)는 `ReviewSection`만 소유한다 — 화면 컴포넌트에 중복 선언하지 않는다 (위 코드가 그 상태).

- [ ] **Step 2: 타입 검사 + 레거시 import 검증**

Run: `npm run typecheck` → exit 0
Run: `grep -nE "from '@/components/ui'" "app/book/[id].tsx"` → `formatDuration, formatRelative, percent`만 (컴포넌트 import 없음)
Run: `grep -nE "lagStyle|fonts|ornament|elevation" "app/book/[id].tsx"` → `getLagStyle` 외 매치 없음

- [ ] **Step 3: 커밋**

```bash
git add 'app/book/[id].tsx'
git commit -m "수정: 도서 상세를 OTT 문법으로 재작성

풀블리드 히어로, 완독·하차 2탭 확인, 소개 접기, 리뷰 인라인 작성 폼 추가"
```

---

### Task 3: 육안 검증 (컨트롤러 수행)

**Files:** 없음

- [ ] **Step 1: 웹 육안 검증**

웹(8083)에서 (로그인 막히면 `__preview` 목 데이터 우회):
1. 히어로 — 표지 블러 배경 + 중앙 표지, 표지 없는 책 폴백
2. record 있는 진입(서재 경유): 진척 카드·검증·세션·리뷰 쓰기 노출 / record 없는 진입(검색 경유): 히어로+소개+리뷰만
3. 완독·하차 2탭 확인 — 취소 복귀·확정 동작·실패 캡션
4. 소개 더보기/접기, 리뷰 폼(별점 토글·등록·실패 메시지), 다크/라이트
