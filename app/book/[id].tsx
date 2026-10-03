import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Keyboard, KeyboardAvoidingView, LayoutChangeEvent, Linking, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import { bookReviewsKey, invalidateReviewLists } from '@/api/reviewCache';
import type { BookDetail, BookSummary, ReadingRecord, ReadingStatus } from '@/api/types';
import { ConfirmButton } from '@/components/ConfirmButton';
import { BookPostsTab } from '@/components/book/BookPostsTab';
import { PaperScreen, StickyNote, SubHeader, TiltCover } from '@/components/collage';
import type { BookBand, BookNote } from '@/components/collage';
import { ReviewScrap } from '@/components/review/ReviewScrap';
import { VERIFICATION_LABEL } from '@/components/review/verification';
import { Button, Card, Eyebrow, KeyValue, SectionHeader, Tag, formatDuration, formatRelative, linkLabel, percent, playLabel } from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { getLagStyle, hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif, statusLabel } from '@/theme/tokens';

/** 시안 2c(390px) 기준 히어로 지오메트리 — 세로·표지 폭만 실제 폭에 비례 환산한다. */
const BASE_W = 390;
const H = {
  /** 표지 스택 — 화면 좌측 약 25% 지점 */
  coverW: 138,
  coverLeftRatio: 96 / BASE_W,
  /** 표지는 상단에 붙여 아래의 제목 영역과 시각적으로 분리한다. */
  coverTop: 22,
  /** 뒤장(줄거리 메모장) 부채꼴 — 홈 히어로와 같은 값으로 펼친다 */
  stack: { x: 48, y: -15, rotate: 10, scale: 0.95 },
  /** 표제 — 표지 아래에서 본문 폭을 넉넉히 사용한다. */
  titleTop: 252,
  titleWRatio: 342 / BASE_W,
  /** 평점 스티키 칩 */
  chipTop: 326,
  /** 콜라주 판 기본 높이 */
  height: 352,
} as const;

/** 본문 좌우 여백 — 히어로 표제도 같은 거터에 맞춰 앉힌다. */
const GUTTER = spacing.lg;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 천 단위 구분 — Hermes 의 Intl 미탑재를 피해 직접 찍는다. */
function groupNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const VERIFICATION_FLAG_LABEL: Record<string, string> = {
  instant_finish: '독서시간이 너무 짧아 완독 기록을 확인하기 어려워요',
  abnormal_speed: '짧은 시간에 기록된 쪽수가 너무 많아요',
  bulk_finish: '하루 동안 완독 처리된 책이 너무 많아요',
  idle_timer: '타이머 실행 중 앱 사용 기록이 부족해요',
  suspect_idle: '장시간 활동 없이 타이머가 실행됐어요',
};

type RatingPick = { average: number; count: number; verified: boolean };

/** 평점은 검증 완독 평점 우선, 없으면 전체 평점. 둘 다 없으면 null(칩·스탯 미렌더). */
function pickRating(detail?: BookDetail): RatingPick | null {
  const verified = detail?.verifiedRating;
  if (verified?.average != null) {
    return { average: verified.average, count: verified.count, verified: true };
  }
  const overall = detail?.overallRating;
  if (overall?.average != null) {
    return { average: overall.average, count: overall.count, verified: false };
  }
  return null;
}

/** SubHeader 카테고리 — BookSummary.category(장르) + publishedAt(출간연도). 둘 다 선택 필드다. */
function headerCategory(info?: BookSummary): string {
  const genre = info?.category?.trim();
  const year = info?.publishedAt?.match(/^\d{4}/)?.[0];
  return [genre || '도서', year].filter(Boolean).join(' · ');
}

/** 도서 상세 — 헤더리스 종이 셸 + 히어로 콜라주 + 진척·소개·검증·세션·리뷰. */
export default function BookDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  // 장정본 표지 — 띠지엔 내 기록의 상태·진행, 뒤장 메모장엔 줄거리(홈 히어로와 같은 연출).
  const bound = {
    band: record.data
      ? {
          title: statusLabel[record.data.status] ?? record.data.status,
          meta: progress && progress.totalPages > 0
            ? `${progress.currentPage} / ${progress.totalPages} · ${percent(progress.completionRate ?? 0)}`
            : undefined,
        }
      : undefined,
    backNote: description ? { title: '줄거리', body: description } : {},
  };
  const lag = progress ? getLagStyle(colors)[progress.lagLevel] : null;
  const actionFailed = (finish.isError && !finish.isPending) || (abandon.isError && !abandon.isPending);
  const rating = pickRating(book.data);
  // 내 기록이 있으면 '독서 시작'을 화면 하단에 붙여 둔다 — 진척 카드 안에 두면 소개·목차를 한참
  // 내려야 닿는다(UX 철칙 Fitts). 누르면 타이머가 바로 측정을 시작한다.
  // 키보드가 떠 있는 동안(리뷰 쓰기)은 숨긴다 — 안드로이드는 창이 줄어들어 CTA 가 입력창을 덮는다.
  const keyboardOpen = useKeyboardOpen();
  const hasStartCta = record.data != null && progress != null;
  const ctaBottom = Math.max(insets.bottom, spacing.lg);

  return (
    <PaperScreen>
      <SubHeader category={headerCategory(info)} />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          // 고정 CTA(버튼 46 + 위아래 여백)에 마지막 섹션이 가리지 않게 그만큼 더 띄운다.
          hasStartCta ? { paddingBottom: spacing.xxl + 46 + spacing.lg + ctaBottom } : null,
        ]}
      >
        <Hero
          info={info}
          rating={rating}
          loading={book.isLoading}
          bound={bound}
          bookId={bookId}
          liked={book.data?.liked ?? false}
          likeCount={book.data?.likeCount ?? 0}
        />

        <View style={styles.sections}>
          {book.data ? (
            <View style={styles.headBlock}>
              <ActionBar
                bookId={bookId}
                hasRecord={rid != null}
                colors={colors}
                onAdded={setAddedRid}
              />
              <StatStrip detail={book.data} rating={rating} colors={colors} />
            </View>
          ) : null}

          {description ? <Description text={description} colors={colors} /> : null}

          {book.data?.tableOfContents ? (
            <TableOfContents text={book.data.tableOfContents} colors={colors} />
          ) : null}

          {record.data && progress ? (
            <Card style={styles.cardGap}>
              <View style={styles.cardHead}>
                <Eyebrow>내 진척</Eyebrow>
                {lag && progress.lagLevel !== 'L0_NORMAL' ? (
                  <Tag label={lag.label} fg={lag.fg} bg={lag.bg} />
                ) : null}
              </View>

              <ProgressEditor rid={rid!} progress={progress} colors={colors} />

              <View style={styles.kvBlock}>
                <KeyValue label="누적 독서시간" value={formatDuration(progress.totalDurationSec)} />
                <KeyValue label="최근 7일 페이스" value={`${(progress.actualDailyPace ?? 0).toFixed(1)}쪽/일`} />
                {progress.requiredDailyPace != null ? (
                  <KeyValue label="필요 페이스" value={`${progress.requiredDailyPace.toFixed(1)}쪽/일`} />
                ) : null}
                {progress.estimatedFinishDate ? (
                  <KeyValue label="예상 완독일" value={progress.estimatedFinishDate} />
                ) : null}
              </View>

              {record.data.status !== 'FINISHED' ? (
                <ConfirmButton
                  label="완독 처리"
                  question="완독으로 기록할까요?"
                  tone="ink"
                  pending={finish.isPending}
                  onConfirm={() => finish.mutate()}
                />
              ) : null}
              {record.data.status === 'READING' ? (
                // 되돌리기 어려운 하차는 완독 처리와 떨어뜨린다 — 카드 간격(md)에 md 를 더해 xl.
                <View style={styles.dangerGap}>
                  <ConfirmButton
                    label="하차하기"
                    question="정말 하차할까요?"
                    tone="danger"
                    variant="ghost"
                    pending={abandon.isPending}
                    onConfirm={() => abandon.mutate()}
                  />
                </View>
              ) : null}
              {actionFailed ? (
                <RetryLine
                  colors={colors}
                  onRetry={() => (finish.isError ? finish.mutate() : abandon.mutate())}
                />
              ) : null}
            </Card>
          ) : null}

          {book.data?.addonLink || book.data?.purchaseLink ? (
            <View style={styles.section}>
              <Button
                label="YES24에서 구매하기"
                variant="outline"
                onPress={() => {
                  const url = book.data?.addonLink ?? book.data?.purchaseLink;
                  if (url) Linking.openURL(url).catch(() => {});
                }}
              />
            </View>
          ) : null}

          {verification.data ? (
            <Card style={styles.cardGap}>
              <Eyebrow>리뷰 검증 상태</Eyebrow>
              <View style={styles.verifyHead}>
                <Text style={[typeScale.titleSerif, { color: colors.text }]}>
                  {VERIFICATION_LABEL[verification.data.expectedLevel]}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  지금 리뷰를 쓰면 받게 될 배지
                </Text>
              </View>
              <View style={styles.kvBlock}>
                <KeyValue label="읽은 범위" value={percent(verification.data.coverage)} />
                <KeyValue label="타이머 세션" value={`${verification.data.timerSessionCount}회`} />
                <KeyValue
                  label="인정 독서시간"
                  value={`${verification.data.verifiedMinutes}분 / 최소 ${verification.data.requiredMinutes}분`}
                />
              </View>
              {verification.data.flags.length > 0 ? (
                <Text style={[typeScale.caption, { color: colors.warn }]}>
                  {verification.data.flags
                    .map((flag) => VERIFICATION_FLAG_LABEL[flag] ?? '독서 기록을 추가로 확인해야 해요')
                    .join(', ')}{' '}
                  <Text
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(
                      'mailto:support@bookey.site?subject=%EC%99%84%EB%8F%85%20%EA%B8%B0%EB%A1%9D%20%EC%A6%9D%EB%AA%85%20%EB%AC%B8%EC%9D%98',
                    ).catch(() => {})}
                    style={{ color: colors.accent, textDecorationLine: 'underline' }}
                  >
                    관리자에게 문의하기
                  </Text>
                  를 통해 완독 기록을 증명해 주세요.
                </Text>
              ) : null}
            </Card>
          ) : null}

          {sessions.data && sessions.data.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="세션 기록" />
              <Card style={styles.listCard}>
                {sessions.data.slice(0, 8).map((session, index) => (
                  <View
                    key={session.id}
                    style={[
                      styles.sessionRow,
                      index > 0 && { borderTopWidth: hairline, borderTopColor: colors.line },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typeScale.monoNumeral, { color: colors.text }]}>
                        {session.startPage ?? 0} → {session.endPage ?? session.startPage ?? 0}쪽
                      </Text>
                      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                        {formatRelative(session.startedAt)} · {session.source === 'TIMER' ? '타이머' : '수동'}
                        {!session.countedForVerification ? ' · 검증 제외' : ''}
                      </Text>
                    </View>
                    <Text style={[typeScale.monoNumeral, { color: colors.textMuted }]}>
                      {formatDuration(session.durationSec)}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <ReviewSection bookId={bookId} rid={rid} colors={colors} />
        </View>
      </ScrollView>

      {hasStartCta && !keyboardOpen ? (
        // 종이가 CTA 뒤로 흐려지며 사라지게 — 클럽 홈 '한 조각 남기기'와 같은 만듦새.
        <LinearGradient
          colors={[`${colors.bg}00`, colors.bg]}
          locations={[0, 0.45]}
          style={[styles.cta, { paddingBottom: ctaBottom }]}
        >
          <View style={styles.ctaInner}>
            <Button
              label={playLabel('독서 시작')}
              onPress={() => router.push(`/timer?recordId=${rid}&autoStart=1`)}
            />
          </View>
        </LinearGradient>
      ) : null}
    </PaperScreen>
  );
}

/** 키보드가 떠 있는지 — 하단 고정 CTA 를 잠시 거둘 때 쓴다. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * 히어로 콜라주 — 표지 스택·겹쳐 앉은 세리프 표제·평점 스티키 칩.
 * 서브 화면이라 패럴랙스는 없다(정적 콜라주). 입장 정착 애니는 표지에만 건다.
 */
function Hero({ info, rating, loading, bound, bookId, liked, likeCount }: {
  info?: BookSummary;
  rating: RatingPick | null;
  /** 로딩 중에는 같은 높이의 빈 판만 그린다 — 도착할 때 아래 섹션이 튀지 않는다. */
  loading?: boolean;
  /** 장정본 표지 — 띠지(내 기록)와 뒤장 메모장(줄거리). */
  bound?: { band?: BookBand; backNote?: BookNote };
  bookId: number;
  liked: boolean;
  likeCount: number;
}) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  // 실제 판 폭. 레이아웃 전 첫 프레임은 화면 폭(최대 560)으로 근사한다.
  const [boardW, setBoardW] = useState(0);
  // 표제·칩 실측 높이 — 두 줄 표제나 큰 글꼴에서도 판이 잘리지 않게 한다.
  const [titleH, setTitleH] = useState(0);
  const [chipH, setChipH] = useState(0);

  const W = boardW || Math.min(window.width, 560);
  const k = clamp(W / BASE_W, 0.86, 1.18);

  const coverW = Math.round(H.coverW * k);
  const coverTop = Math.round(H.coverTop * k);
  const titleTop = Math.round(H.titleTop * k);
  const chipTop = Math.round(H.chipTop * k);
  const boardH = Math.max(
    Math.round(H.height * k),
    coverTop + Math.round(coverW * 1.5) + spacing.sm,
    titleTop + titleH + spacing.md,
    chipTop + chipH + spacing.md,
  );

  const caption = [info?.author ?? '저자 미상', info?.totalPages ? `${info.totalPages}쪽` : null]
    .filter(Boolean)
    .join(' · ');

  // 표제의 은은한 후광은 배경 패턴 위에서도 글자 윤곽을 또렷하게 유지한다.
  const halo = {
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  };

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== boardW) setBoardW(next);
  };

  if (loading) {
    return <View style={[styles.board, { height: boardH }]} onLayout={onBoardLayout} />;
  }

  return (
    <View style={[styles.board, { height: boardH }]} onLayout={onBoardLayout}>
      {/* ① 표지 스택 — 장정본(사진판·띠지·책갈피) + 부채꼴로 펼친 줄거리 메모장. 무표지면 사진판에 세리프 폴백 */}
      <View style={[styles.layer, { left: Math.round(W * H.coverLeftRatio), top: coverTop, zIndex: 1 }]}>
        <TiltCover
          uri={info?.coverUrl}
          title={info?.title}
          width={coverW}
          tilt={-3}
          stacked
          stackOffset={H.stack}
          bound={bound}
        />
      </View>

      {/* ② 표제 — 표지 아래에서 가로 폭을 넉넉히 쓴다 */}
      <View
        style={[
          styles.layer,
          { left: GUTTER, top: titleTop, width: Math.round(clamp(W * H.titleWRatio, 280, W - GUTTER * 2)), zIndex: 2 },
        ]}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0 && next !== titleH) setTitleH(next);
        }}
      >
        <View style={styles.heroTitleRow}>
          <Text
            numberOfLines={2}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="balanced"
            style={[styles.heroTitle, halo, { color: colors.text }]}
          >
            {info?.title ?? '제목 미상'}
          </Text>
          <BookLikeButton bookId={bookId} liked={liked} likeCount={likeCount} colors={colors} />
        </View>
        <Text numberOfLines={1} style={[typeScale.caption, styles.heroCaption, halo, { color: colors.textMuted }]}>
          {caption}
        </Text>
      </View>

      {/* ③ 평점 스티키 칩 — 평점 데이터가 없으면 붙이지 않는다 */}
      {rating ? (
        <View
          style={[styles.layer, { right: GUTTER, top: chipTop, zIndex: 3 }]}
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.height);
            if (next > 0 && next !== chipH) setChipH(next);
          }}
        >
          <StickyNote rotate={2.5} style={styles.ratingNote}>
            <Text style={[typeScale.monoNumeral, { color: colors.onNote }]}>
              ★ {rating.average.toFixed(1)} · {groupNumber(rating.count)}명
            </Text>
          </StickyNote>
        </View>
      ) : null}
    </View>
  );
}

function BookLikeButton({ bookId, liked, likeCount, colors }: {
  bookId: number;
  liked: boolean;
  likeCount: number;
  colors: ColorTokens;
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
  return (
    <Pressable
      disabled={like.isPending}
      onPress={() => like.mutate()}
      accessibilityRole="button"
      accessibilityLabel="좋아요"
      style={[
        styles.likeButton,
        // 켜짐은 잉크로 뒤집는다 — 악센트는 화면의 '독서 시작' 몫.
        liked
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { borderColor: colors.lineStrong },
        { opacity: like.isPending ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.likeGlyph, { color: liked ? colors.onInk : colors.textMuted }]}>
        {liked ? '♥' : '♡'}
      </Text>
      <Text style={[typeScale.monoNumeral, { color: liked ? colors.onInk : colors.textMuted }]}>
        {groupNumber(likeCount)}
      </Text>
    </Pressable>
  );
}

/** 액션 바 — 서재에 없으면 담기 2종(아웃라인 · 주 CTA). */
function ActionBar({ bookId, hasRecord, colors, onAdded }: {
  bookId: number;
  hasRecord: boolean;
  colors: ColorTokens;
  onAdded: (recordId: number) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [commitment, setCommitment] = useState('');

  const add = useMutation({
    mutationFn: ({ status, commitment }: { status: ReadingStatus; commitment?: string }) =>
      libraryApi.add({ bookId, status, commitment }),
    onSuccess: (record, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setCommitmentOpen(false);
      setCommitment('');
      onAdded(record.id);
      // '독서 시작'은 말 그대로 지금 읽기 시작하는 것 — 타이머로 넘겨 바로 측정을 켠다(UX 철칙 Hick).
      if (status === 'READING') router.push(`/timer?recordId=${record.id}&autoStart=1`);
    },
  });
  const failed = add.isError && !add.isPending;

  if (hasRecord && !failed) return null;

  return (
    <>
    <View style={styles.actionBarWrap}>
      <View style={styles.actionBar}>
        {!hasRecord ? (
          <>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate({ status: 'WANT_TO_READ' })}
              accessibilityRole="button"
              accessibilityLabel="읽고 싶은 책으로 담기"
              style={[styles.actionButton, styles.actionOutline, {
                borderColor: colors.lineStrong, opacity: add.isPending ? 0.6 : 1,
              }]}
            >
              <Text style={[typeScale.label, { color: colors.text }]}>+ 읽고 싶은</Text>
            </Pressable>
            <Pressable
              disabled={add.isPending}
              onPress={() => setCommitmentOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="독서 시작"
              style={[styles.actionButton, styles.actionPrimary, {
                backgroundColor: colors.accent, opacity: add.isPending ? 0.6 : 1,
              }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>{playLabel('독서 시작')}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {failed && add.variables ? (
        <RetryLine colors={colors} onRetry={() => add.mutate(add.variables!)} />
      ) : null}
    </View>
      <Modal
        visible={commitmentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommitmentOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.commitmentBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCommitmentOpen(false)} />
          <View style={[styles.commitmentDialog, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
            <Text maxFontSizeMultiplier={1.15} style={[styles.commitmentTitle, { color: colors.text }]}>
              완독을 위한 다짐을 남겨 보세요.
            </Text>
            <Text maxFontSizeMultiplier={1.15} style={[styles.commitmentDescription, { color: colors.textMuted }]}>
              홈 화면의 책 옆 메모에 표시돼요. 비워 두고 바로 시작해도 돼요.
            </Text>
            {/* 다짐은 선택이라 키보드를 먼저 띄우지 않는다 — 바로 '독서 시작'을 누를 수 있게. */}
            <TextInput
              value={commitment}
              onChangeText={setCommitment}
              maxLength={200}
              multiline
              maxFontSizeMultiplier={1.15}
              placeholder="(선택) 예: 매일 10쪽씩 끝까지 읽기"
              placeholderTextColor={colors.textFaint}
              style={[styles.commitmentInput, { color: colors.text, borderColor: colors.lineStrong }]}
            />
            <View style={styles.commitmentActions}>
              <Button label="취소" variant="outline" onPress={() => setCommitmentOpen(false)} />
              <Button
                label={playLabel('독서 시작')}
                loading={add.isPending}
                disabled={add.isPending}
                onPress={() => add.mutate({ status: 'READING', commitment: commitment.trim() || undefined })}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

/** 스탯 스트립 — 헤어라인 세로 구분으로 나눈 실측 수치 3종(평점 없으면 2종). */
function StatStrip({ detail, rating, colors }: {
  detail: BookDetail;
  rating: RatingPick | null;
  colors: ColorTokens;
}) {
  const cells: { key: string; value: string; label: string }[] = [];
  if (rating) {
    cells.push({
      key: 'rating',
      value: `★ ${rating.average.toFixed(1)}`,
      label: rating.verified ? '검증 완독 평점' : '전체 평점',
    });
  }
  cells.push({ key: 'reviews', value: groupNumber(detail.verifiedReviewCount), label: '끝까지 읽은 리뷰' });
  cells.push({ key: 'likes', value: groupNumber(detail.likeCount), label: '좋아요' });

  return (
    <View style={[styles.statStrip, { borderTopColor: colors.line }]}>
      {cells.map((cell, index) => (
        <Fragment key={cell.key}>
          {index > 0 ? <View style={[styles.statDivider, { backgroundColor: colors.line }]} /> : null}
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {cell.value}
            </Text>
            <Text style={[typeScale.caption, styles.statLabel, { color: colors.textFaint }]}>
              {cell.label}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** 책 소개 — 세리프 인용 활자 + 더보기/접기. */
function Description({ text, colors }: { text: string; colors: ColorTokens }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <SectionHeader title="책 소개" />
      <Text numberOfLines={expanded ? undefined : 4} style={[typeScale.quote, { color: colors.textMuted }]}>
        {text}
      </Text>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" style={styles.moreLink}>
        <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>
          {expanded ? '접기 ↑' : '더보기 ↓'}
        </Text>
      </Pressable>
    </View>
  );
}

/** 목차 — YES24 제공. <b> 태그·연속 개행만 걷어내고 그대로 보여준다. */
function TableOfContents({ text, colors }: { text: string; colors: ColorTokens }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = useMemo(
    () => text.replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    [text],
  );
  return (
    <View style={styles.section}>
      <SectionHeader title="목차" />
      <Text numberOfLines={expanded ? undefined : 8} style={[typeScale.caption, { color: colors.textMuted, lineHeight: 20 }]}>
        {cleaned}
      </Text>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" style={styles.moreLink}>
        <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>
          {expanded ? '접기 ↑' : '더보기 ↓'}
        </Text>
      </Pressable>
    </View>
  );
}

/** 내 진척 수정기 — 큰 숫자 탭(정밀 입력) + 진행 바 드래그/탭(대략 조절)으로 현재 페이지를 고친다. */
/** 실패 안내 + 다시 시도 — 글자만 '다시 시도'라고 쓰고 눌리지 않던 것을 실제 버튼(44pt)으로. */
function RetryLine({ colors, onRetry }: { colors: ColorTokens; onRetry: () => void }) {
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="다시 시도"
      style={({ pressed }) => [styles.retryLine, pressed && pressedStyle]}
    >
      <Text style={[typeScale.caption, { color: colors.warn }]}>
        처리하지 못했어요 · <Text style={{ textDecorationLine: 'underline' }}>{linkLabel('다시 시도', 'action')}</Text>
      </Text>
    </Pressable>
  );
}

function ProgressEditor({ rid, progress, colors }: {
  rid: number;
  progress: NonNullable<ReadingRecord['progress']>;
  colors: ColorTokens;
}) {
  const queryClient = useQueryClient();
  const total = progress.totalPages ?? 0;
  const serverPage = progress.currentPage ?? 0;

  // 드래그·저장 중 로컬 값 — null이면 서버 값 표시. ref는 PanResponder 핸들러(최초 렌더 클로저)용.
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const setDraftBoth = (v: number | null) => { draftRef.current = v; setDraft(v); };

  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [text, setText] = useState('');

  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const totalRef = useRef(total);
  totalRef.current = total;

  const save = useMutation({
    mutationFn: (page: number) => libraryApi.updateProgress(rid, page),
    onSuccess: (updated) => {
      // 응답이 갱신된 기록 전체 — 바로 캐시에 넣어 재조회 사이 깜빡임을 막는다
      queryClient.setQueryData(['library', 'record', rid], updated);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'preview', rid] });
      setDraftBoth(null);
    },
    onError: () => setDraftBoth(null),
  });

  const commit = (page: number | null) => {
    if (page == null || page === serverPage) { setDraftBoth(null); return; }
    setDraftBoth(page);
    save.mutate(page);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const pageAtX = (x: number) => {
    if (widthRef.current <= 0 || totalRef.current <= 0) return null;
    const ratio = Math.min(1, Math.max(0, x / widthRef.current));
    return Math.round(ratio * totalRef.current);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => totalRef.current > 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      startXRef.current = evt.nativeEvent.locationX;
      setDragging(true);
      setDraftBoth(pageAtX(startXRef.current));
    },
    onPanResponderMove: (_evt, gesture) => {
      setDraftBoth(pageAtX(startXRef.current + gesture.dx));
    },
    onPanResponderRelease: () => {
      setDragging(false);
      commitRef.current(draftRef.current);
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      setDraftBoth(null);
    },
  })).current;

  const page = draft ?? serverPage;
  const ratio = total > 0
    ? Math.min(1, Math.max(0, page / total))
    : Math.min(1, Math.max(0, progress.completionRate ?? 0));

  const startEdit = () => {
    editingRef.current = true;
    setEditing(true);
    setText(String(page));
  };
  // onSubmitEditing과 onBlur가 연달아 와도 ref 가드로 한 번만 저장한다
  const confirmEdit = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const parsed = Number.parseInt(text, 10);
    if (!Number.isFinite(parsed)) return;
    commit(Math.max(0, total > 0 ? Math.min(parsed, total) : parsed));
  };

  return (
    <>
      <View style={styles.progressNumbers}>
        {editing ? (
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirmEdit}
            onBlur={confirmEdit}
            accessibilityLabel="현재 페이지 입력"
            style={[styles.bigNumber, styles.bigNumberInput, {
              color: colors.text, borderBottomColor: colors.accent,
            }]}
          />
        ) : (
          // 고칠 수 있는 칸이라는 걸 겉모습으로 알린다 — 입력 중과 같은 밑줄(뮤트)을 늘 그어 둔다(UX 철칙 Jakob).
          <Pressable
            onPress={startEdit}
            accessibilityRole="button"
            accessibilityLabel="현재 페이지 수정"
            hitSlop={8}
            style={({ pressed }) => [styles.bigNumberEditable, { borderBottomColor: colors.lineStrong }, pressed && pressedStyle]}
          >
            <Text style={[styles.bigNumber, { color: colors.text }]}>{page}</Text>
          </Pressable>
        )}
        <Text style={[typeScale.monoNumeral, { color: colors.textFaint }]}>
          {total > 0 ? ` / ${total}쪽` : '쪽'}
        </Text>
        <Text style={[typeScale.monoNumeral, { color: colors.accent, marginLeft: 'auto' }]}>
          {percent(ratio)}
        </Text>
      </View>

      <View
        {...pan.panHandlers}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        accessibilityRole="adjustable"
        accessibilityLabel="진척도 조절"
        accessibilityValue={{ min: 0, max: total, now: page }}
        style={styles.trackTouch}
      >
        <View
          pointerEvents="none"
          style={[styles.track, dragging && styles.trackActive, { backgroundColor: colors.surfaceRaised }]}
        >
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
        {total > 0 ? (
          <View pointerEvents="none" style={[styles.thumb, { left: `${ratio * 100}%`, backgroundColor: colors.accent }]} />
        ) : null}
      </View>

      {/* 막대 끌기는 숫자 고치기와 같은 일 — 제스처만으로 되는 기능처럼 보이지 않게 두 길을 함께 알린다. */}
      {total > 0 ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>숫자를 누르거나 막대를 밀어 쪽수를 고쳐요</Text>
      ) : null}
      {save.isError && !save.isPending && save.variables != null ? (
        <RetryLine colors={colors} onRetry={() => save.mutate(save.variables!)} />
      ) : null}
    </>
  );
}

type RecordTab = 'REVIEW' | 'POST';
const RECORD_TABS: { value: RecordTab; label: string }[] = [
  { value: 'REVIEW', label: '리뷰' },
  { value: 'POST', label: '독후감' },
];

/** 섹션 제목 자리에 놓는 두 글자 탭 — 켜진 쪽만 밝고 아래 민트 밑줄 토막(A1). 개수는 적지 않는다. */
function TabbedSectionHeader<T extends string>({ tabs, value, onChange, action, colors }: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  action?: ReactNode;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabRow}>
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <Pressable key={t.value} onPress={() => onChange(t.value)} hitSlop={8}
              accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab}>
              <Text style={[styles.tabTitle, { color: active ? colors.text : colors.textFaint }]}>{t.label}</Text>
              <View style={[styles.tabRule, { backgroundColor: active ? colors.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      {action}
    </View>
  );
}

/** 리뷰 | 독후감 탭 섹션(A1) — 리뷰 목록·인라인 작성 폼과 책별 독후감 탭을 한 제목줄 아래에 둔다. */
function ReviewSection({ bookId, rid, colors }: { bookId: number; rid: number | null; colors: ColorTokens }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: bookReviewsKey(bookId),
    queryFn: () => bookApi.reviews(bookId),
    enabled: Number.isFinite(bookId),
  });

  const [tab, setTab] = useState<RecordTab>('REVIEW');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  // 탭을 바꾸면 펼쳐져 있던 작성 폼은 닫는다 — 다른 탭 밑에 폼이 숨어 있지 않게.
  const switchTab = (next: RecordTab) => {
    if (next === tab) return;
    setOpen(false);
    setTab(next);
  };

  const create = useMutation({
    mutationFn: () =>
      reviewApi.create({ readingRecordId: rid!, rating: rating || undefined, body: body.trim() }),
    onSuccess: () => {
      // 리뷰 목록 캐시는 도서 상세·리뷰 상세 두 곳에 흩어져 있어 공용 무효화 함수로 한 번에 정리한다.
      invalidateReviewLists(queryClient);
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

  // 우측 액션은 탭별 — 리뷰는 '쓰기', 독후감은 작성 화면으로 나가는 '쓰기'.
  // 리뷰는 이 책의 읽기 기록이 있어야 쓸 수 있지만, 독후감은 서재에 담지 않은 책에도 쓸 수 있다.
  const action = tab === 'POST'
    ? (
        <Pressable
          onPress={() => router.push({ pathname: '/post/new', params: { bookId: String(bookId) } })}
          accessibilityRole="button" accessibilityLabel="독후감 쓰기" hitSlop={8} style={styles.tabAction}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>{linkLabel('쓰기')}</Text>
        </Pressable>
      )
    : (rid != null && !done && !open ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8} style={styles.tabAction}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>{linkLabel('쓰기', 'action')}</Text>
        </Pressable>
      ) : null);

  return (
    <View style={styles.section}>
      <TabbedSectionHeader tabs={RECORD_TABS} value={tab} onChange={switchTab} action={action} colors={colors} />

      {tab === 'POST' ? (
        <BookPostsTab bookId={bookId} />
      ) : (
        <>
          {open ? (
            <Card style={styles.formCard}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n === rating ? 0 : n)} style={styles.star}
                    accessibilityRole="button" accessibilityLabel={`별점 ${n}`}>
                    <Text style={{ fontSize: 24, color: n <= rating ? colors.accent : colors.lineStrong }}>★</Text>
                  </Pressable>
                ))}
                <Text style={[typeScale.caption, { flex: 1, color: colors.textFaint, marginLeft: spacing.xs }]}>
                  {rating > 0 ? `${rating}점` : '별점 선택 (선택 사항)'}
                </Text>
              </View>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="이 책은 어땠나요?"
                placeholderTextColor={colors.textFaint}
                multiline
                style={[styles.reviewInput, {
                  backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
                }]}
              />
              {errorMessage ? (
                <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
              ) : null}
              {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글은 '남기기'(댓글·한 마디와 같은 말). */}
              <View style={styles.formActions}>
                <Button
                  label="취소"
                  variant="outline"
                  onPress={() => setOpen(false)}
                  disabled={create.isPending}
                  style={styles.formButton}
                />
                <Button
                  label="남기기"
                  onPress={() => create.mutate()}
                  loading={create.isPending}
                  disabled={body.trim().length === 0}
                  style={styles.formButton}
                />
              </View>
            </Card>
          ) : null}

          {items.length === 0 ? (
            <Card>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                아직 리뷰가 없어요. 이 책의 첫 리뷰를 남겨보세요.
              </Text>
            </Card>
          ) : (
            <View style={styles.reviewList}>
              {/* 오려 붙인 메모 조각 — 인덱스 기준 ±1° 교차 회전으로 붙인 티를 낸다. 눌러서 전문을 읽는다. */}
              {items.map((review, index) => (
                <ReviewScrap
                  key={review.id}
                  review={review}
                  rotate={index % 2 === 0 ? -1 : 1}
                  onPress={() => router.push(`/review/${review.id}`)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  board: { ...layout.content, position: 'relative' },
  layer: { position: 'absolute' },
  // 시안 27px 세리프 — 두 줄까지만 두고 살짝 기울여 종이에 앉힌 인상을 준다.
  heroTitle: {
    flex: 1,
    fontFamily: serif.extraBold,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -1.1,
    transform: [{ rotate: '-1.5deg' }],
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCaption: { marginTop: spacing.sm },
  ratingNote: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  sections: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
  headBlock: { gap: spacing.lg },
  section: { gap: spacing.sm },
  cardGap: { gap: spacing.md },
  listCard: { paddingVertical: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvBlock: { gap: 0 },
  // 10px 글자만으로는 손가락이 닿지 않는다 — 44pt 상자를 주고, 늘어난 높이만큼 위 여백은 뺀다.
  moreLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: -spacing.sm },
  dangerGap: { marginTop: spacing.md },
  retryLine: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  ctaInner: { ...layout.content, width: '100%' },

  actionBarWrap: { gap: spacing.sm },
  actionBar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  likeButton: {
    minWidth: 46,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: hairline,
  },
  likeGlyph: { fontSize: 16, lineHeight: 20 },
  actionButton: {
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionOutline: { borderWidth: hairline },
  actionPrimary: { flex: 1 },
  commitmentBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  commitmentDialog: { borderWidth: hairline, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  commitmentTitle: { fontFamily: serif.extraBold, fontSize: 19, lineHeight: 25, letterSpacing: -0.5 },
  commitmentDescription: { ...typeScale.caption, fontSize: 14, lineHeight: 20, marginBottom: spacing.xs },
  commitmentInput: {
    minHeight: 78,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  commitmentActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },

  statStrip: { flexDirection: 'row', gap: 18, borderTopWidth: hairline, paddingTop: spacing.lg },
  statCell: { gap: 3 },
  statDivider: { width: hairline },
  statValue: { fontFamily: mono.semiBold, fontSize: 19 },
  statLabel: { fontSize: 10 },

  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bigNumber: { fontFamily: mono.semiBold, fontSize: 34 },
  bigNumberInput: { padding: 0, width: 92, borderBottomWidth: hairline },
  bigNumberEditable: { borderBottomWidth: hairline },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  trackTouch: { height: 32, justifyContent: 'center' },
  trackActive: { height: 10 },
  fill: { height: '100%', borderRadius: radius.sm },
  thumb: { position: 'absolute', top: '50%', width: 8, height: 22, marginTop: -11, marginLeft: -spacing.xs, borderRadius: radius.sm },

  verifyHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },

  // 별마다 44pt 상자 — 이웃 별끼리 터치 영역이 겹치지 않게 간격 대신 상자로 띄운다.
  stars: { flexDirection: 'row', alignItems: 'center' },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formCard: { gap: spacing.md },
  reviewInput: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formButton: { flex: 1 },
  // 리뷰|독후감 탭 헤더 — SectionHeader 와 같은 높이·간격, 제목은 명조 18.
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  // 탭 헤더 우측 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다(두 탭 모두 같은 자리).
  // 늘린 좌우 여백만큼 음수 마진으로 되돌려 글자는 제목줄 끝에 그대로 맞춘다(FootAction 과 같은 규율).
  tabAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  tabRow: { flexDirection: 'row', gap: 18 },
  tab: { gap: 6 },
  tabTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  tabRule: { width: 22, height: 2 },
  reviewList: { gap: spacing.md },
});
