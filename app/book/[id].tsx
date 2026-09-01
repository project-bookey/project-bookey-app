import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import type { BookDetail, BookSummary, ReadingStatus, VerificationLevel } from '@/api/types';
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
  const paramRid = recordId ? Number(recordId) : null;
  const [addedRid, setAddedRid] = useState<number | null>(null);

  const book = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => bookApi.detail(bookId),
    enabled: Number.isFinite(bookId),
  });

  // 라우트 파라미터 → 이 세션에서 담은 기록 → 서버가 알려준 내 기록 순으로 채택
  const rid = paramRid ?? addedRid ?? book.data?.myRecordId ?? null;

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
        <Hero info={info} description={description} />
      )}

      <View style={styles.sections}>
        {book.data ? (
          <ActionBar
            bookId={bookId}
            liked={book.data.liked}
            likeCount={book.data.likeCount}
            hasRecord={rid != null}
            colors={colors}
            onAdded={setAddedRid}
          />
        ) : null}

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

/** 표지 없는 책의 히어로 기본 배경 — 브랜드 틸 딥 그라데이션 (중간 색 = darkColors.accentSoft). */
const FALLBACK_BG_STOPS = ['#1B4A3E', darkColors.accentSoft, '#0D1F1B'] as const;

/** 풀블리드 히어로 — 블러 표지 배경, 표지는 좌측·간단한 소개는 좌하단. 오버레이는 darkColors 고정. */
function Hero({ info, description }: { info?: BookSummary; description?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.hero, { backgroundColor: darkColors.surfaceRaised }]}>
      {info?.coverUrl ? (
        <Image source={{ uri: info.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={16} />
      ) : (
        <LinearGradient
          colors={[...FALLBACK_BG_STOPS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={[...darkColors.scrimStops]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        <View style={styles.heroRow}>
          <View style={[styles.heroCover, { backgroundColor: darkColors.surface }]}>
            {info?.coverUrl ? (
              <Image source={{ uri: info.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text numberOfLines={4} style={[typeScale.caption, { color: darkColors.textMuted, padding: spacing.sm }]}>
                {info?.title}
              </Text>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text numberOfLines={3} style={[typeScale.title, { color: darkColors.text }]}>
              {info?.title}
            </Text>
            <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
              {info?.author ?? '저자 미상'}
              {info?.publisher ? ` · ${info.publisher}` : ''}
              {info?.totalPages ? ` · ${info.totalPages}쪽` : ''}
            </Text>
          </View>
        </View>
        {description ? (
          <View style={styles.heroDesc}>
            <Text numberOfLines={expanded ? undefined : 3} style={[typeScale.caption, { color: darkColors.textMuted }]}>
              {description}
            </Text>
            <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={8}>
              <Text style={[typeScale.label, { color: darkColors.textFaint }]}>
                {expanded ? '접기 ▲' : '더보기 ▼'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** 히어로 아래 액션 바 — ♥ 좋아요(항상) + 서재에 없으면 담기 2버튼. */
function ActionBar({ bookId, liked, likeCount, hasRecord, colors, onAdded }: {
  bookId: number;
  liked: boolean;
  likeCount: number;
  hasRecord: boolean;
  colors: ColorTokens;
  onAdded: (recordId: number) => void;
}) {
  const queryClient = useQueryClient();

  const like = useMutation({
    mutationFn: () => bookApi.like(bookId),
    onSuccess: (res) => {
      queryClient.setQueryData(['book', bookId], (old: BookDetail | undefined) =>
        old ? { ...old, liked: res.liked, likeCount: res.likeCount } : old,
      );
    },
  });
  const add = useMutation({
    mutationFn: (status: ReadingStatus) => libraryApi.add({ bookId, status }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onAdded(record.id);
    },
  });
  const failed =
    (like.isError && !like.isPending) || (add.isError && !add.isPending);

  return (
    <View style={styles.actionBarWrap}>
      <View style={styles.actionBar}>
        <Pressable
          disabled={like.isPending}
          onPress={() => like.mutate()}
          accessibilityRole="button"
          accessibilityLabel="좋아요"
          style={[
            styles.likeButton,
            liked
              ? { backgroundColor: colors.accent }
              : { borderWidth: 1, borderColor: colors.lineStrong },
            { opacity: like.isPending ? 0.6 : 1 },
          ]}
        >
          <Text style={[typeScale.label, { color: liked ? colors.onAccent : colors.textMuted }]}>
            {liked ? '♥' : '♡'} {likeCount}
          </Text>
        </Pressable>

        {!hasRecord ? (
          <>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('WANT_TO_READ')}
              accessibilityRole="button"
              accessibilityLabel="읽고 싶은 책으로 담기"
              style={[styles.quickAdd, { borderWidth: 1, borderColor: colors.accent, opacity: add.isPending ? 0.6 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.accent }]}>+ 읽고 싶은</Text>
            </Pressable>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('READING')}
              accessibilityRole="button"
              accessibilityLabel="읽기 시작"
              style={[styles.quickAdd, { backgroundColor: colors.accent, opacity: add.isPending ? 0.6 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>▶ 읽기 시작</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {failed ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>
          처리하지 못했어요 · 다시 시도
        </Text>
      ) : null}
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
            아직 리뷰가 없어요. 이 책의 첫 리뷰를 남겨보세요.
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
  hero: { minHeight: 300, justifyContent: 'flex-end' },
  heroContent: {
    ...layout.content,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  heroRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  heroInfo: { flex: 1, gap: spacing.xs, paddingBottom: spacing.xs },
  heroCover: {
    width: 100,
    height: 150,
    borderRadius: radius.sm,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  heroDesc: { gap: spacing.xs },
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
  actionBarWrap: { gap: spacing.xs },
  actionBar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  likeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAdd: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
