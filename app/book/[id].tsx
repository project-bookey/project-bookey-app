import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutChangeEvent, Linking, Modal, PanResponder, Pressable,
  StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Plus } from 'lucide-react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import { bookReviewsKey, invalidateReviewLists } from '@/api/reviewCache';
import type { BookDetail, BookSummary, ReadingRecord, ReadingStatus } from '@/api/types';
import { ConfirmButton } from '@/components/ConfirmButton';
import { BookPostsTab } from '@/components/book/BookPostsTab';
import { LikeAction } from '@/components/post/LikeAction';
import { MemoScrap, PaperScreen, StickyNote, SubHeader, TiltCover } from '@/components/collage';
import type { BookBand, BookNote } from '@/components/collage';
import { KeyboardArea, KeyboardScroll, useKeyboardOpen, useKeyboardReveal } from '@/components/keyboard';
import { MyRemark } from '@/components/remark/MyRemark';
import { RemarkTicker } from '@/components/remark/RemarkTicker';
import { useMyRemark, useSaveRemark } from '@/components/remark/queries';
import { FinishReviewSheet, type FinishedBook } from '@/components/review/FinishReviewSheet';
import { ReviewScrap } from '@/components/review/ReviewScrap';
import { RATING_WORDS, StarRating, ratingPrompt } from '@/components/review/StarRating';
import { Button, Card, Eyebrow, FootAction, KeyValue, SectionHeader, Tag, formatDuration, formatRelative, linkLabel, percent, playLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import type { ColorTokens } from '@/theme';
import { getLagStyle, hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
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

type RatingPick = { average: number; count: number };

/** 별점을 남긴 모든 리뷰의 평균. 아직 없으면 null(칩·스탯 미렌더). */
function pickRating(detail?: BookDetail): RatingPick | null {
  const overall = detail?.overallRating;
  return overall?.average != null ? { average: overall.average, count: overall.count } : null;
}

/** SubHeader 카테고리 — BookSummary.category(장르) + publishedAt(출간연도). 둘 다 선택 필드다. */
function headerCategory(info?: BookSummary): string {
  const genre = info?.category?.trim();
  const year = info?.publishedAt?.match(/^\d{4}/)?.[0];
  return [genre || '책', year].filter(Boolean).join(' · ');
}

/** '9.12' — 해가 다르면 '2025.12.30'. 읽은 기간 줄에 쓴다. */
function shortDate(date: Date, withYear: boolean): string {
  const md = `${date.getMonth() + 1}.${date.getDate()}`;
  return withYear ? `${date.getFullYear()}.${md}` : md;
}

/** 완독 시트의 한 줄 — '9.12 → 10.4 · 6시간 20분'. 모르는 쪽은 뺀다. */
function finishMeta(record: ReadingRecord): string | undefined {
  const parts: string[] = [];
  if (record.startedAt) {
    const start = new Date(record.startedAt);
    const end = record.finishedAt ? new Date(record.finishedAt) : new Date();
    const withYear = start.getFullYear() !== end.getFullYear();
    parts.push(`${shortDate(start, withYear)} → ${shortDate(end, withYear)}`);
  }
  if (record.progress.totalDurationSec > 0) parts.push(formatDuration(record.progress.totalDurationSec));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** 도서 상세 — 헤더리스 종이 셸 + 히어로 콜라주 + 진척·소개·세션·리뷰. */
export default function BookDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // finished=1 — 타이머에서 방금 완독하고 넘어왔다. 완독 리뷰 시트를 띄운다.
  const { id, recordId, finished } = useLocalSearchParams<{ id: string; recordId?: string; finished?: string }>();
  const bookId = Number(id);
  const paramRid = recordId ? Number(recordId) : null;
  const [addedRid, setAddedRid] = useState<number | null>(null);
  // 이 화면에서 '완독 처리'를 눌렀는지 — 타이머에서 넘어온 완독과 같은 시트를 띄운다. 한 번 닫으면 다시 띄우지 않는다.
  const [justFinished, setJustFinished] = useState(false);
  const [finishPromptClosed, setFinishPromptClosed] = useState(false);
  // 리뷰를 쓰는 중인지 — 그동안은 하단 '독서 시작'을 숨겨 초록 버튼을 '남기기' 하나로 둔다(UX 철칙 Von Restorff).
  const [reviewComposing, setReviewComposing] = useState(false);
  // 한 마디 시트 — 하차한 그 순간에 올라오고, 내 진척 카드의 '한 마디 남기기'·'고치기'도 같은 시트를 연다.
  const [remarkSheetOpen, setRemarkSheetOpen] = useState(false);

  const book = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => bookApi.detail(bookId),
    enabled: Number.isFinite(bookId),
  });

  // 이 화면에서 서재에서 뺀 기록 — 라우트 파라미터·책 상세가 아직 그 id 를 들고 있어도 없는 것으로 본다.
  // 읽고 싶음은 켰다 껐다 하므로 뺀 id 를 모두 기억한다.
  const [removedRids, setRemovedRids] = useState<number[]>([]);
  const live = (id?: number | null) => (id != null && !removedRids.includes(id) ? id : null);

  // 라우트 파라미터 → 이 세션에서 담은 기록 → 서버가 알려준 내 기록 순으로 채택
  const rid = live(paramRid) ?? live(addedRid) ?? live(book.data?.myRecordId);

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
  const invalidateRecord = () => {
    queryClient.invalidateQueries({ queryKey: ['library'] });
    queryClient.invalidateQueries({ queryKey: ['library', 'record', rid] });
  };
  const finish = useMutation({
    mutationFn: () => libraryApi.finish(rid!),
    onSuccess: (updated) => {
      // 받은 기록을 바로 앉혀 시트가 다시 받기를 기다리지 않고 올라오게 한다.
      queryClient.setQueryData(['library', 'record', rid], updated);
      invalidateRecord();
      setJustFinished(true);
    },
  });
  const abandon = useMutation({
    mutationFn: () => libraryApi.abandon(rid!, 'NOT_MY_TASTE'),
    onSuccess: (updated) => {
      queryClient.setQueryData(['library', 'record', rid], updated);
      invalidateRecord();
      // 내려놓는 순간에 한 마디를 묻는다 — 완독 시트와 같은 자리, 비워 두고 닫아도 된다.
      setRemarkSheetOpen(true);
    },
  });
  // 읽고 싶음을 끈 뒤 — 내 진도 카드가 사라지고 서재·홈 목록도 다시 받는다.
  const onRemoved = (id: number) => {
    setRemovedRids((prev) => [...prev, id]);
    queryClient.removeQueries({ queryKey: ['library', 'record', id] });
    queryClient.invalidateQueries({ queryKey: ['library'] });
    queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  };

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
  // 방금 다 읽은 책 — 완독 리뷰 시트에 띄울 표지·제목·기간. 기록이 완독으로 바뀐 걸 확인한 뒤에만 만든다.
  const finishedBook: FinishedBook | null =
    (finished === '1' || justFinished) && !finishPromptClosed && info && record.data?.status === 'FINISHED'
      ? { title: info.title, coverUrl: info.coverUrl, meta: finishMeta(record.data) }
      : null;
  // 다 읽었거나 내려놓은 기록 — 진척 카드에 내 한 마디 줄을 둔다.
  const closedKind = record.data?.status === 'FINISHED' || record.data?.status === 'ABANDONED'
    ? record.data.status
    : null;
  // 내 기록이 있으면 '독서 시작'을 화면 하단에 붙여 둔다 — 진척 카드 안에 두면 소개·목차를 한참
  // 내려야 닿는다(UX 철칙 Fitts). 누르면 타이머가 바로 측정을 시작한다.
  // 키보드가 떠 있는 동안과 리뷰를 쓰는 동안은 숨긴다 — 리뷰 폼이 키보드 위로 올라오면 그 자리를 CTA 가 덮고,
  // 폼의 '남기기'와 초록 버튼이 둘이 된다.
  // 읽고 싶음일 땐 위 액션 바에 '독서 시작'이 남아 있으니 하단에는 두지 않는다 — 초록 버튼은 하나.
  const keyboardOpen = useKeyboardOpen();
  const hasStartCta = record.data != null && progress != null && record.data.status !== 'WANT_TO_READ';
  const ctaBottom = Math.max(insets.bottom, spacing.lg);

  return (
    <PaperScreen>
      <SubHeader category={headerCategory(info)} />

      {/* 리뷰 쓰기 폼이 키보드에 묻히지 않게 — 입력을 누르면 '남기기'까지 키보드 위로 올라온다. */}
      <KeyboardScroll
        contentContainerStyle={[
          styles.container,
          // 고정 CTA(버튼 46 + 위아래 여백)에 마지막 섹션이 가리지 않게 그만큼 더 띄운다.
          hasStartCta ? { paddingBottom: spacing.xxl + 46 + spacing.lg + ctaBottom } : null,
        ]}
      >
        <Hero
          info={info}
          loading={book.isLoading}
          bound={bound}
          rating={rating}
          like={book.data ? { bookId, liked: book.data.liked, count: book.data.likeCount } : undefined}
        />

        <View style={styles.sections}>
          {book.data ? (
            <ActionBar
              bookId={bookId}
              rid={rid}
              status={record.data?.status}
              colors={colors}
              onAdded={setAddedRid}
              onRemoved={onRemoved}
            />
          ) : null}

          {/* 다 읽거나 내려놓은 사람들이 남긴 한 줄 — 최신순으로 한 장씩 돈다. 머리 묶음보다 먼저 서지 않게 책이 온 뒤에 그린다. */}
          {book.data ? <RemarkTicker bookId={bookId} /> : null}

          {description ? <Description text={description} colors={colors} /> : null}

          {book.data?.tableOfContents ? (
            <TableOfContents text={book.data.tableOfContents} colors={colors} />
          ) : null}

          {record.data && progress ? (
            <Card style={styles.cardGap}>
              <View style={styles.cardHead}>
                <Eyebrow>내 진도</Eyebrow>
                {lag && progress.lagLevel !== 'L0_NORMAL' ? (
                  <Tag label={lag.label} fg={lag.fg} bg={lag.bg} />
                ) : null}
              </View>

              <ProgressEditor rid={rid!} progress={progress} colors={colors} />

              <View style={styles.kvBlock}>
                <KeyValue label="누적 독서시간" value={formatDuration(progress.totalDurationSec)} />
                <KeyValue label="최근 7일 하루 평균" value={`${(progress.actualDailyPace ?? 0).toFixed(1)}쪽`} />
                {progress.requiredDailyPace != null ? (
                  <KeyValue label="하루에 읽어야 할 양" value={`${progress.requiredDailyPace.toFixed(1)}쪽`} />
                ) : null}
                {progress.estimatedFinishDate ? (
                  <KeyValue label="예상 완독일" value={progress.estimatedFinishDate} />
                ) : null}
              </View>

              {closedKind ? (
                <MyRemark
                  rid={rid!}
                  bookId={bookId}
                  book={{ title: info?.title ?? '', coverUrl: info?.coverUrl, meta: finishMeta(record.data) }}
                  kind={closedKind}
                  sheetOpen={remarkSheetOpen}
                  onSheetOpenChange={setRemarkSheetOpen}
                />
              ) : null}

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

          {sessions.data && sessions.data.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="읽은 기록" />
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
                        {formatRelative(session.startedAt)} · {session.source === 'TIMER' ? '타이머' : '직접 입력'}
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

          <ReviewSection
            bookId={bookId}
            rid={rid}
            colors={colors}
            finishedBook={finishedBook}
            roundStartedAt={record.data?.startedAt}
            onFinishPromptClose={() => setFinishPromptClosed(true)}
            composing={reviewComposing}
            onComposingChange={setReviewComposing}
          />
        </View>
      </KeyboardScroll>

      {hasStartCta && !keyboardOpen && !reviewComposing ? (
        // 종이가 CTA 뒤로 흐려지며 사라지게 — 클럽 홈 '메모 남기기'와 같은 만듦새.
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

/**
 * 히어로 콜라주 — 표지 스택·겹쳐 앉은 세리프 표제, 그 아래 줄 오른쪽에 좋아요 하트와 평점 스티키 메모.
 * 책의 평점·좋아요는 여기 한 곳에만 둔다(2026-10-05 사용자 결정 — 아래 현황 줄은 없앴다).
 * 서브 화면이라 패럴랙스는 없다(정적 콜라주). 입장 정착 애니는 표지에만 건다.
 */
function Hero({ info, loading, bound, rating, like }: {
  info?: BookSummary;
  /** 로딩 중에는 같은 높이의 빈 판만 그린다 — 도착할 때 아래 섹션이 튀지 않는다. */
  loading?: boolean;
  /** 장정본 표지 — 띠지(내 기록)와 뒤장 메모장(줄거리). */
  bound?: { band?: BookBand; backNote?: BookNote };
  /** 리뷰 평균 별점 — 없으면 메모를 붙이지 않는다. */
  rating: RatingPick | null;
  /** 책 상세가 오기 전엔 undefined — 하트를 그리지 않는다. */
  like?: { bookId: number; liked: boolean; count: number };
}) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  // 실제 판 폭. 레이아웃 전 첫 프레임은 화면 폭(최대 560)으로 근사한다.
  const [boardW, setBoardW] = useState(0);
  // 표제 실측 높이 — 두 줄 표제나 큰 글꼴에서도 판이 잘리지 않게 한다.
  const [titleH, setTitleH] = useState(0);

  const W = boardW || Math.min(window.width, 560);
  const k = clamp(W / BASE_W, 0.86, 1.18);

  const coverW = Math.round(H.coverW * k);
  const coverTop = Math.round(H.coverTop * k);
  const titleTop = Math.round(H.titleTop * k);
  const boardH = Math.max(
    Math.round(H.height * k),
    coverTop + Math.round(coverW * 1.5) + spacing.sm,
    titleTop + titleH + spacing.md,
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

      {/* ② 표제 — 표지 아래에서 가로 폭을 넉넉히 쓴다. 저자 줄 오른쪽 빈자리에 좋아요·평점을 앉힌다. */}
      <View
        style={[styles.layer, { left: GUTTER, top: titleTop, width: W - GUTTER * 2, zIndex: 2 }]}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0 && next !== titleH) setTitleH(next);
        }}
      >
        <Text
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
          style={[
            styles.heroTitle,
            halo,
            { color: colors.text, maxWidth: Math.round(clamp(W * H.titleWRatio, 280, W - GUTTER * 2)) },
          ]}
        >
          {info?.title ?? '제목 미상'}
        </Text>
        <View style={styles.heroMetaRow}>
          <Text
            numberOfLines={1}
            style={[typeScale.caption, styles.heroCaption, halo, { color: colors.textMuted }]}
          >
            {caption}
          </Text>
          {like ? <BookLike {...like} /> : null}
          {rating ? (
            <StickyNote rotate={2.5} style={styles.ratingNote}>
              <Text
                accessibilityLabel={`리뷰 평균 별점 ${rating.average.toFixed(1)}점, ${rating.count}명`}
                style={[typeScale.monoNumeral, { color: colors.onNote }]}
              >
                ★ {rating.average.toFixed(1)} · {groupNumber(rating.count)}명
              </Text>
            </StickyNote>
          ) : null}
        </View>
      </View>

    </View>
  );
}

/** 책 좋아요 — 앱 어디서나 같은 하트(LikeAction). 누를 때마다 켜고 끄며, 켜지면 하트를 초록으로 채운다. */
function BookLike({ bookId, liked, count }: { bookId: number; liked: boolean; count: number }) {
  const queryClient = useQueryClient();
  const like = useMutation({
    mutationFn: () => bookApi.like(bookId),
    onSuccess: (res) => {
      queryClient.setQueryData(['book', bookId], (old: BookDetail | undefined) =>
        old ? { ...old, liked: res.liked, likeCount: res.likeCount } : old,
      );
    },
  });
  return <LikeAction count={count} liked={liked} onPress={() => { if (!like.isPending) like.mutate(); }} />;
}

/**
 * 액션 바 — 서재에 없거나 읽고 싶음일 때 [읽고 싶음 토글][독서 시작].
 * 읽고 싶음은 누를 때마다 켜지고(담기) 꺼진다(서재에서 빼기) — 켜지면 잉크로 뒤집고 체크 아이콘을 단다.
 * 두 상태 모두 버튼 자리가 같아 켰다 껐다 해도 화면이 움직이지 않는다.
 */
function ActionBar({ bookId, rid, status, colors, onAdded, onRemoved }: {
  bookId: number;
  /** 화면이 보는 내 기록 — 없으면 null */
  rid: number | null;
  /** 그 기록의 상태 — 아직 받는 중이면 undefined */
  status?: ReadingStatus;
  colors: ColorTokens;
  onAdded: (recordId: number) => void;
  onRemoved: (recordId: number) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [commitment, setCommitment] = useState('');

  const add = useMutation({
    mutationFn: ({ status, commitment }: { status: ReadingStatus; commitment?: string }) =>
      libraryApi.add({ bookId, status, commitment }),
    onSuccess: (record, { status }) => {
      // 받은 기록을 바로 앉혀 둔다 — 상태를 다시 받는 동안 토글이 사라졌다 돌아오지 않게.
      queryClient.setQueryData(['library', 'record', record.id], record);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setCommitmentOpen(false);
      setCommitment('');
      onAdded(record.id);
      // '독서 시작'은 말 그대로 지금 읽기 시작하는 것 — 타이머로 넘겨 바로 측정을 켠다(UX 철칙 Hick).
      if (status === 'READING') router.push(`/timer?recordId=${record.id}&autoStart=1`);
    },
  });
  // 읽고 싶음 끄기 — 기록에 쌓인 것이 없는 상태라 묻지 않고 바로 뺀다. 다시 누르면 다시 담긴다.
  const remove = useMutation({
    mutationFn: (id: number) => libraryApi.remove(id),
    onSuccess: (_, id) => onRemoved(id),
  });
  const wanted = rid != null && status === 'WANT_TO_READ';
  const busy = add.isPending || remove.isPending;
  const addFailed = add.isError && !add.isPending;
  const removeFailed = remove.isError && !remove.isPending;

  if (rid != null && !wanted) return null;

  const toggleWant = () => {
    add.reset();
    remove.reset();
    if (wanted && rid != null) remove.mutate(rid);
    else add.mutate({ status: 'WANT_TO_READ' });
  };
  const ToggleIcon = wanted ? Check : Plus;
  const toggleColor = wanted ? colors.onInk : colors.text;

  return (
    <>
    <View style={styles.actionBarWrap}>
      <View style={styles.actionBar}>
        <Pressable
          disabled={busy}
          onPress={toggleWant}
          accessibilityRole="button"
          accessibilityLabel="읽고 싶음"
          accessibilityState={{ selected: wanted, disabled: busy }}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionOutline,
            styles.wantToggle,
            wanted
              ? { backgroundColor: colors.ink, borderColor: colors.ink }
              : { borderColor: colors.control },
            { opacity: busy ? 0.6 : 1 },
            pressed && !busy ? pressedStyle : null,
          ]}
        >
          <ToggleIcon size={16} color={toggleColor} {...iconStroke} />
          <Text style={[typeScale.label, { color: toggleColor }]}>읽고 싶음</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          // 서재에 없으면 다짐을 묻고 담으며 시작, 읽고 싶음이면 그 기록으로 타이머를 바로 켠다.
          onPress={() =>
            wanted ? router.push(`/timer?recordId=${rid}&autoStart=1`) : setCommitmentOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="독서 시작"
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionPrimary,
            { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 },
            pressed && !busy ? pressedStyle : null,
          ]}
        >
          <Text style={[typeScale.label, { color: colors.onAccent }]}>{playLabel('독서 시작')}</Text>
        </Pressable>
      </View>
      {addFailed && add.variables ? (
        <RetryLine colors={colors} onRetry={() => add.mutate(add.variables!)} />
      ) : removeFailed && remove.variables != null ? (
        <RetryLine colors={colors} onRetry={() => remove.mutate(remove.variables!)} />
      ) : null}
    </View>
      <Modal
        visible={commitmentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommitmentOpen(false)}
      >
        <KeyboardArea style={styles.commitmentBackdrop}>
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
        </KeyboardArea>
      </Modal>
    </>
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
          {expanded ? '접기' : '더 보기'}
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
          {expanded ? '접기' : '더 보기'}
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
            style={({ pressed }) => [styles.bigNumberEditable, { borderBottomColor: colors.control }, pressed && pressedStyle]}
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
        accessibilityLabel="진도 조절"
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

/**
 * 섹션 제목 자리에 놓는 두 글자 탭 — 켜진 쪽만 밝고 아래 민트 밑줄 토막(A1).
 * 개수는 count 를 준 탭에만 작게 단다 — 리뷰 수는 현황 줄을 없애며 여기로 옮겼다(2026-10-05).
 * 독후감 목록은 서버가 총수를 주지 않아 수를 달지 않는다.
 */
function TabbedSectionHeader<T extends string>({ tabs, value, onChange, action, colors }: {
  tabs: { value: T; label: string; count?: number }[];
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
              <Text style={[styles.tabTitle, { color: active ? colors.text : colors.textFaint }]}>
                {t.label}
                {t.count != null ? (
                  <Text style={[styles.tabCount, { color: colors.textFaint }]}> {groupNumber(t.count)}</Text>
                ) : null}
              </Text>
              <View style={[styles.tabRule, { backgroundColor: active ? colors.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      {action}
    </View>
  );
}

/** 책별 리뷰 목록 — 리뷰 섹션의 목록과 탭의 리뷰 수가 같은 캐시를 쓴다. */
function useBookReviews(bookId: number) {
  return useQuery({
    queryKey: bookReviewsKey(bookId),
    queryFn: () => bookApi.reviews(bookId),
    enabled: Number.isFinite(bookId),
  });
}

/**
 * 리뷰 | 독후감 탭 섹션(A1) — 리뷰 목록·인라인 작성 폼과 책별 독후감 탭을 한 제목줄 아래에 둔다.
 * 방금 완독한 책(finishedBook)이면 완독 리뷰 시트도 여기서 띄운다 — 리뷰 목록·작성 상태를 이 섹션이 쥐고 있어서
 * 시트와 인라인 폼이 같은 별점·글을 나눠 쓴다.
 */
function ReviewSection({
  bookId, rid, colors, finishedBook, roundStartedAt, onFinishPromptClose, composing, onComposingChange,
}: {
  bookId: number;
  rid: number | null;
  colors: ColorTokens;
  finishedBook: FinishedBook | null;
  /** 이번 회차를 시작한 때 — 그 뒤에 쓴 내 리뷰가 있으면 완독 시트로 또 묻지 않는다(리뷰는 몇 개든 더 쓸 수 있다). */
  roundStartedAt?: string;
  onFinishPromptClose: () => void;
  /** 작성 폼이 펼쳐져 있는지 — 화면이 하단 CTA 를 숨기려고 쥔다. */
  composing: boolean;
  onComposingChange: (composing: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useAuth((state) => state.user);
  const myId = me?.id;
  const reviews = useBookReviews(bookId);

  const [tab, setTab] = useState<RecordTab>('REVIEW');
  const open = composing;
  const setOpen = onComposingChange;
  // 방금 리뷰를 남겼는지 — 목록이 다시 오기 전에 완독 시트가 또 뜨지 않게 한다.
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  // 완독 시트의 첫 단계 — 책을 덮으며 한 마디. 남기거나 건너뛰면 다시 묻지 않는다.
  // 방금 다 읽었을 때만 묻는다 — 읽는 중인 책을 열 때마다 받을 까닭이 없다.
  const myRemark = useMyRemark(finishedBook ? rid : null);
  const saveRemark = useSaveRemark(rid, bookId);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkPassed, setRemarkPassed] = useState(false);
  // 리뷰 칸을 누르면 그 밑 '남기기'까지 키보드 위로 올린다.
  const reveal = useKeyboardReveal();
  const formActionsRef = useRef<View>(null);

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
      setOpen(false);
      setDone(true);
      // 리뷰는 한 사람이 여러 개 쓸 수 있다 — 다음에 '쓰기'를 누르면 빈 칸에서 시작한다.
      setRating(0);
      setBody('');
      if (finishedBook) onFinishPromptClose();
    },
  });

  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError
        ? create.error.message
        : '등록하지 못했어요 · 다시 시도'
      : null;

  const items = reviews.data?.content ?? [];

  // 이번 회차에 이미 남긴 리뷰가 보이면 완독 시트로 또 묻지 않는다. 첫 쪽에 없어 놓치면 시트가 뜨지만, 리뷰는 여러 개 쓸 수 있어 그대로 하나 더 남는다.
  const roundStart = roundStartedAt ? new Date(roundStartedAt).getTime() : 0;
  const reviewedThisRound = items.some(
    (review) => review.authorId === myId && new Date(review.createdAt).getTime() >= roundStart,
  );
  // 이번 완독의 한 마디가 아직 없으면 리뷰보다 먼저 묻는다. 하차 때 남긴 한 마디(ABANDONED)는 완독의 말로 다시 받는다.
  const needsRemark = !remarkPassed && myRemark.isSuccess && myRemark.data?.kind !== 'FINISHED';
  const needsReview = !reviewedThisRound && !done;
  // 목록을 받은 뒤에만 띄운다 — 이미 쓴 리뷰·한 마디가 늦게 도착해 시트가 떴다 사라지지 않게.
  // 한 마디를 받지 못했으면(서버 오류 등) 그 단계만 건너뛰고 리뷰는 그대로 묻는다.
  const showFinishSheet = finishedBook != null && rid != null && reviews.isSuccess
    && (myRemark.isSuccess || myRemark.isError) && (needsRemark || needsReview);

  // 한 마디 단계를 마친다 — 리뷰까지 받을 게 없으면 시트를 닫는다.
  const passRemark = () => {
    setRemarkPassed(true);
    if (!needsReview) onFinishPromptClose();
  };
  const remarkError = saveRemark.isError && !saveRemark.isPending
    ? saveRemark.error instanceof ApiError ? saveRemark.error.message : '남기지 못했어요 · 다시 시도'
    : null;

  // 시트를 닫아도 쓰던 글은 버리지 않는다 — 리뷰 탭의 인라인 폼으로 펼쳐 이어 쓰게 한다.
  const closeFinishSheet = () => {
    if (body.trim().length > 0) {
      setTab('REVIEW');
      setOpen(true);
    }
    create.reset();
    onFinishPromptClose();
  };

  // 우측 액션은 탭별 — 리뷰는 '쓰기', 독후감은 작성 화면으로 나가는 '쓰기'.
  // 리뷰는 이 책의 읽기 기록이 있어야 쓸 수 있지만, 독후감은 서재에 담지 않은 책에도 쓸 수 있다.
  // 작은 테두리 버튼(FootAction) — 10px 글자뿐이던 때는 이 책에 글을 쓰는 유일한 입구가 눈에 띄지 않았다.
  const action = tab === 'POST'
    ? (
        <FootAction
          label="쓰기"
          tone="accent"
          onPress={() => router.push({ pathname: '/post/new', params: { bookId: String(bookId) } })}
          accessibilityLabel="독후감 쓰기"
        />
      )
    : (rid != null && !open ? (
        <FootAction label="쓰기" tone="accent" onPress={() => setOpen(true)} accessibilityLabel="리뷰 쓰기" />
      ) : null);

  return (
    <View style={styles.section}>
      <TabbedSectionHeader
        tabs={RECORD_TABS.map((t) => (t.value === 'REVIEW' ? { ...t, count: reviews.data?.totalElements } : t))}
        value={tab}
        onChange={switchTab}
        action={action}
        colors={colors}
      />

      {tab === 'POST' ? (
        <BookPostsTab bookId={bookId} />
      ) : (
        <>
          {open ? (
            <View style={styles.formBlock}>
              {/*
                쓰는 칸도 목록의 리뷰 조각과 같은 모양 — 내 이름·별·글·받게 될 배지가 목록 조각과 같은 자리에 선다.
                안쪽 입력 상자는 두지 않는다(이중 테두리). 쓰는 중인 조각만 테두리를 한 단 짙게 해 구분한다.
              */}
              <MemoScrap rotate={0} style={{ borderColor: colors.textFaint }}>
                <View style={styles.scrapHead}>
                  <Text numberOfLines={1} style={[typeScale.label, styles.scrapAuthor, { color: colors.text }]}>
                    {me?.nickname ?? '나'}
                  </Text>
                  <View style={styles.scrapStars}>
                    <StarRating value={rating} onChange={setRating} />
                  </View>
                </View>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={ratingPrompt(rating)}
                  placeholderTextColor={colors.textFaint}
                  multiline
                  accessibilityLabel="리뷰"
                  onFocus={() => reveal(formActionsRef)}
                  onContentSizeChange={() => reveal(formActionsRef, { onlyIfOpen: true })}
                  style={[styles.scrapInput, { color: colors.text }]}
                />
                <Text style={[typeScale.caption, styles.scrapMeta, { color: rating > 0 ? colors.text : colors.textFaint }]}>
                  {rating > 0 ? RATING_WORDS[rating] : '별점은 선택이에요'}
                </Text>
              </MemoScrap>
              {errorMessage ? (
                <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
              ) : null}
              {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글은 '남기기'(댓글·한 마디와 같은 말). */}
              <View ref={formActionsRef} style={styles.formActions}>
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
            </View>
          ) : null}

          {items.length === 0 ? (
            <Card>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                아직 리뷰가 없어요. 이 책의 첫 리뷰를 남겨보세요.
              </Text>
            </Card>
          ) : (
            <View style={styles.reviewList}>
              {/* 붙인 메모 조각 — 반듯하게 쌓는다. 눌러서 전문을 읽는다. */}
              {items.map((review) => (
                <ReviewScrap
                  key={review.id}
                  review={review}
                  onPress={() => router.push(`/review/${review.id}`)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {showFinishSheet ? (
        <FinishReviewSheet
          book={finishedBook}
          rating={rating}
          onRating={setRating}
          body={body}
          onBody={setBody}
          onSubmit={() => create.mutate()}
          onClose={closeFinishSheet}
          pending={create.isPending}
          error={errorMessage}
          remarkStep={needsRemark ? {
            value: remarkDraft,
            onChange: setRemarkDraft,
            onSubmit: () => saveRemark.mutate(remarkDraft.trim(), {
              onSuccess: () => { setRemarkDraft(''); passRemark(); },
            }),
            onSkip: passRemark,
            skipLabel: needsReview ? '건너뛰기' : '나중에',
            pending: saveRemark.isPending,
            error: remarkError,
          } : null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  board: { ...layout.content, position: 'relative' },
  layer: { position: 'absolute' },
  // 시안 27px 세리프 — 두 줄까지만 두고 살짝 기울여 종이에 앉힌 인상을 준다.
  heroTitle: {
    fontFamily: serif.extraBold,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -1.1,
    transform: [{ rotate: '-1.5deg' }],
  },
  // 저자 줄 — 왼쪽 저자·쪽수가 남는 폭을 쓰고, 오른쪽에 하트와 평점 메모가 붙는다.
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  heroCaption: { flex: 1 },
  ratingNote: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  sections: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
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
  actionButton: {
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionOutline: { borderWidth: hairline },
  wantToggle: { flexDirection: 'row', gap: spacing.xs },
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
    maxHeight: 160, // 길어져도 '독서 시작'이 키보드 위 대화상자 안에 남게
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  commitmentActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },


  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bigNumber: { fontFamily: mono.semiBold, fontSize: 34 },
  bigNumberInput: { padding: 0, width: 92, borderBottomWidth: hairline },
  bigNumberEditable: { borderBottomWidth: hairline },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  trackTouch: { height: 32, justifyContent: 'center' },
  trackActive: { height: 10 },
  fill: { height: '100%', borderRadius: radius.sm },
  thumb: { position: 'absolute', top: '50%', width: 8, height: 22, marginTop: -11, marginLeft: -spacing.xs, borderRadius: radius.sm },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },

  // 작성 조각 — 리뷰 조각(ReviewScrap)과 같은 머리·본문·메타 줄. 버튼 줄은 조각 밖 바로 아래.
  formBlock: { gap: spacing.md },
  scrapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  scrapAuthor: { flexShrink: 1 },
  // 별 상자(44pt)의 오른쪽 여백만큼 당겨 별이 조각 안쪽 가장자리에 맞게 — 위아래도 상자만큼 되돌려 머리 줄 높이는 그대로.
  scrapStars: { marginRight: -spacing.sm, marginVertical: -spacing.sm },
  scrapInput: {
    minHeight: 72,
    maxHeight: 160, // 길어지면 칸 안에서 스크롤 — '남기기'가 키보드 밑으로 밀려나지 않게
    marginTop: spacing.sm,
    padding: 0,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  scrapMeta: { alignSelf: 'flex-end', marginTop: spacing.sm },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formButton: { flex: 1 },
  // 리뷰|독후감 탭 헤더 — SectionHeader 와 같은 높이·간격, 제목은 명조 18.
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', gap: spacing.lg },
  tab: { gap: 6 },
  tabTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  tabCount: { fontFamily: mono.semiBold, fontSize: 13 },
  tabRule: { width: 22, height: 2 },
  reviewList: { gap: spacing.md },
});
