import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import type { BookDetail, BookSummary, ReadingRecord, ReadingStatus, VerificationLevel } from '@/api/types';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FocusRing, MemoScrap, PaperScreen, StickyNote, SubHeader, TiltCover } from '@/components/collage';
import type { BookBand, BookNote } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, SectionHeader, Tag, formatDuration, formatRelative, percent,
} from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { getLagStyle, hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif, statusLabel } from '@/theme/tokens';

const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  VERIFIED_FULL: '완독 검증',
  VERIFIED_PARTIAL: '부분 검증',
  UNVERIFIED: '미검증',
  FLAGGED: '검토 중',
};

/** 시안 2c(390px) 기준 히어로 지오메트리 — 세로·표지 폭만 실제 폭에 비례 환산한다. */
const BASE_W = 390;
const H = {
  /** 표지 스택 — 화면 좌측 약 25% 지점 */
  coverW: 138,
  coverLeftRatio: 96 / BASE_W,
  coverTop: 22,
  /** 뒤장(줄거리 메모장) 부채꼴 — 홈 히어로와 같은 값으로 펼친다 */
  stack: { x: 48, y: -15, rotate: 10, scale: 0.95 },
  /** 표제 — 좌하단에서 표지와 겹친다 */
  titleTop: 150,
  titleWRatio: 212 / BASE_W,
  /** 평점 스티키 칩 */
  chipTop: 206,
  /** 콜라주 판 기본 높이 */
  height: 262,
} as const;

/** 본문 좌우 여백 — 히어로 표제도 같은 거터에 맞춰 앉힌다. */
const GUTTER = spacing.lg;

/** 찍고 온 문장 조각을 화면 위에서 얼마나 띄워 세울지(px). */
const FOCUS_TOP_GAP = 80;
/**
 * 찍고 온 조각을 따라다니는 시간(ms).
 *
 * 문장은 리뷰·세션보다 먼저 도착하므로, 한 번 뛰고 끝내면 뒤늦게 채워지는 섹션이
 * 조각을 아래로 밀어내 엉뚱한 자리에 서게 된다(실측: 목표 580 → 실제 129).
 * 그래서 이 창 동안은 자리를 다시 잴 때마다 조용히 따라붙는다. 강조 링이 살아 있는
 * 시간과 대략 맞춰, 링이 꺼진 뒤에는 화면이 저 혼자 움직이지 않게 한다.
 */
const FOCUS_SETTLE_MS = 2200;
/** 명령한 자리에서 이만큼 어긋나면 사람이 민 것으로 본다(px). */
const FOCUS_DRIFT = 24;

/** `measureLayout` 의 기준 노드 타입 — RN 타입 선언에 이름이 없어 여기서 뽑아 쓴다. */
type MeasureBase = Parameters<View['measureLayout']>[0];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 천 단위 구분 — Hermes 의 Intl 미탑재를 피해 직접 찍는다. */
function groupNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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

  /* ── 찍고 온 문장으로 뛰기 ────────────────────────────────────────────────
     이 화면은 FlatList 가 아니라 ScrollView 라 scrollToIndex 가 없다.
     대상 조각의 자리는 그때그때 `measureLayout` 으로 콘텐츠 기준 y 를 다시 재서 쓴다 —
     onLayout 으로 모아 둔 상대 y 를 더하는 방식은 웹에서 어긋난다. 위쪽 섹션(진척·검증·
     세션)이 뒤늦게 채워지면 조각은 아래로 밀리는데, 크기가 그대로면 onLayout 이 다시
     오지 않아 옛 좌표로 뛰기 때문이다(실측: 목표 580 → 실제 129).                */
  const scrollRef = useRef<ScrollView>(null);
  /** 따라다니는 중인 조각과 그 유효 시각. */
  const focus = useRef<{ node: View; until: number } | null>(null);
  /** 창을 닫는 타이머 — 시간이 지나면 조각 인스턴스를 놓아 준다. */
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 마지막으로 명령한 목적지 — 스크롤이 우리가 시킨 것인지 사람이 민 것인지 가리는 기준.
   * `arrived` 는 그 자리에 한 번이라도 닿았는지(애니메이션 중의 중간값을 손짓으로 오해하지 않게),
   * `contentH` 는 닿았을 때의 콘텐츠 높이(콘텐츠가 자라며 브라우저가 위치를 손보는 것과 구분).
   */
  const commanded = useRef<{ y: number; contentH: number; arrived: boolean } | null>(null);

  /** 따라다니기를 끝낸다 — 타이머·조각 인스턴스·목적지를 한꺼번에 놓는다. */
  const releaseFocus = useCallback(() => {
    if (focusTimer.current) {
      clearTimeout(focusTimer.current);
      focusTimer.current = null;
    }
    focus.current = null;
    commanded.current = null;
  }, []);

  // 화면을 떠날 때 타이머와 조각 참조를 남기지 않는다.
  useEffect(() => releaseFocus, [releaseFocus]);

  const alignFocus = useCallback((animated: boolean) => {
    const target = focus.current;
    const scroller = scrollRef.current;
    if (target == null || scroller == null) return;
    if (Date.now() > target.until) {
      releaseFocus();
      return;
    }
    /*
      기준 노드는 `getInnerViewRef()` 로 받는다. `getInnerViewNode()` 는
      `findNodeHandle(...)` 을 거쳐 **숫자 nativeTag** 를 돌려주는데, 새 아키텍처(Fabric)의
      `ReactNativeElement.measureLayout` 은 기준이 호스트 인스턴스가 아니면 `onFail` 조차
      부르지 않고 조용히 돌아선다 — 네이티브에서 링만 켜지고 스크롤은 안 되는 침묵 실패다.
      (웹은 react-native-web 이 호스트 노드를 돌려줘 우연히 굴러갔을 뿐이다.)
      RN 타입 선언에는 없는 메서드라 좁게 캐스팅하고, 없으면 예전 노드로 물러선다.
    */
    const inner = (scroller as { getInnerViewRef?: () => MeasureBase | null }).getInnerViewRef?.()
      ?? scroller.getInnerViewNode();
    if (inner == null) return;

    target.node.measureLayout(
      inner,
      (_x, y) => {
        const to = Math.max(0, y - FOCUS_TOP_GAP);
        commanded.current = { y: to, contentH: -1, arrived: false };
        scroller.scrollTo({ y: to, animated });
      },
      () => { /* 측정 실패(언마운트 등) — 조용히 넘어간다 */ },
    );
  }, [releaseFocus]);

  /** '오려둔 문장' 섹션이 대상 조각을 찾으면 이걸 부른다. */
  const focusOnCard = useCallback((node: View) => {
    releaseFocus();
    focus.current = { node, until: Date.now() + FOCUS_SETTLE_MS };
    focusTimer.current = setTimeout(releaseFocus, FOCUS_SETTLE_MS);
    alignFocus(true);
  }, [alignFocus, releaseFocus]);

  /**
   * 사람이 스크롤을 만졌으면 따라다니기를 그만둔다.
   *
   * `onScrollBeginDrag` 만으로는 웹을 못 잡는다 — react-native-web 은 그 핸들러를 아예
   * 전달하지 않아, 창이 열려 있는 동안 사용자가 휠로 움직여도 뒤늦게 온 섹션이 화면을
   * 도로 끌어당긴다. 그래서 보고된 위치가 우리가 명령한 자리에서 벗어났는지로 가린다.
   */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = commanded.current;
    if (at == null || focus.current == null) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    // 문서 끝에 걸려 명령값에 못 미칠 수 있으니, 실제로 닿을 수 있는 자리와 견준다.
    const reachable = Math.min(at.y, Math.max(0, contentSize.height - layoutMeasurement.height));
    if (Math.abs(contentOffset.y - reachable) <= FOCUS_DRIFT) {
      at.arrived = true;
      at.contentH = contentSize.height;
      return;
    }
    // 아직 가는 중이거나(애니메이션 중간값), 그 사이 콘텐츠가 자라 브라우저가 위치를
    // 손본 것이면 사람이 민 게 아니다 — 곧 오는 정렬이 다시 맞춘다.
    if (!at.arrived || contentSize.height !== at.contentH) return;
    releaseFocus();
  }, [releaseFocus]);

  return (
    <PaperScreen>
      <SubHeader category={headerCategory(info)} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        // 늦게 도착한 섹션이 조각을 밀어내면 곧바로 다시 붙인다 — 창이 살아 있는 동안만.
        onContentSizeChange={() => alignFocus(false)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // 손가락이 닿는 순간 따라다니기를 그만둔다(네이티브). 웹은 위 onScroll 이 받는다.
        onScrollBeginDrag={releaseFocus}
      >
        <Hero info={info} rating={rating} loading={book.isLoading} bound={bound} />

        <View style={styles.sections}>
          {book.data ? (
            <View style={styles.headBlock}>
              <ActionBar
                bookId={bookId}
                liked={book.data.liked}
                likeCount={book.data.likeCount}
                hasRecord={rid != null}
                colors={colors}
                onAdded={setAddedRid}
              />
              <StatStrip detail={book.data} rating={rating} colors={colors} />
            </View>
          ) : null}

          {description ? <Description text={description} colors={colors} /> : null}

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

              <Button label="▶ 독서 시작" onPress={() => router.push(`/timer?recordId=${rid}`)} />
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
            </Card>
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
                  신호: {verification.data.flags.join(', ')}
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

          <QuoteSection bookId={bookId} onFocusCard={focusOnCard} colors={colors} />

          <ReviewSection bookId={bookId} rid={rid} colors={colors} />
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

/**
 * 히어로 콜라주 — 표지 스택·겹쳐 앉은 세리프 표제·평점 스티키 칩.
 * 서브 화면이라 패럴랙스는 없다(정적 콜라주). 입장 정착 애니는 표지에만 건다.
 */
function Hero({ info, rating, loading, bound }: {
  info?: BookSummary;
  rating: RatingPick | null;
  /** 로딩 중에는 같은 높이의 빈 판만 그린다 — 도착할 때 아래 섹션이 튀지 않는다. */
  loading?: boolean;
  /** 장정본 표지 — 띠지(내 기록)와 뒤장 메모장(줄거리). */
  bound?: { band?: BookBand; backNote?: BookNote };
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

  // 표제는 표지 위로 겹쳐 앉는다 — 밝은 표지 사진 위에서도 읽히도록 배경색 후광을 깐다.
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

      {/* ② 표제 — 표지 좌하단에 겹쳐 앉는다 */}
      <View
        style={[
          styles.layer,
          { left: GUTTER, top: titleTop, width: Math.round(clamp(W * H.titleWRatio, 190, 268)), zIndex: 2 },
        ]}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0 && next !== titleH) setTitleH(next);
        }}
      >
        <Text numberOfLines={2} style={[styles.heroTitle, halo, { color: colors.text }]}>
          {info?.title ?? '제목 미상'}
        </Text>
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

/** 액션 바 — ♥ 좋아요(원형) + 서재에 없으면 담기 2종(아웃라인 pill · 주 CTA pill). */
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
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { borderColor: colors.lineStrong },
            { opacity: like.isPending ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.likeGlyph, { color: liked ? colors.onAccent : colors.textMuted }]}>
            {liked ? '♥' : '♡'}
          </Text>
          <Text style={[typeScale.monoNumeral, { color: liked ? colors.onAccent : colors.textMuted }]}>
            {groupNumber(likeCount)}
          </Text>
        </Pressable>

        {!hasRecord ? (
          <>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('WANT_TO_READ')}
              accessibilityRole="button"
              accessibilityLabel="읽고 싶은 책으로 담기"
              style={[styles.pill, styles.pillOutline, {
                borderColor: colors.lineStrong, opacity: add.isPending ? 0.6 : 1,
              }]}
            >
              <Text style={[typeScale.label, { color: colors.text }]}>+ 읽고 싶은</Text>
            </Pressable>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('READING')}
              accessibilityRole="button"
              accessibilityLabel="읽기 시작"
              style={[styles.pill, styles.pillPrimary, {
                backgroundColor: colors.accent, opacity: add.isPending ? 0.6 : 1,
              }]}
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

/** 스탯 스트립 — 헤어라인 세로 구분으로 나눈 실측 수치 3종(평점 없으면 2종). */
function StatStrip({ detail, rating, colors }: {
  detail: BookDetail;
  rating: RatingPick | null;
  colors: ColorTokens;
}) {
  const cells: { key: string; value: string; label: string; accent?: boolean }[] = [];
  if (rating) {
    cells.push({
      key: 'rating',
      value: `★ ${rating.average.toFixed(1)}`,
      label: rating.verified ? '검증 완독 평점' : '전체 평점',
      accent: true,
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
            <Text style={[styles.statValue, { color: cell.accent ? colors.accent : colors.text }]}>
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
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <Text style={[typeScale.monoEyebrow, styles.moreLink, { color: colors.accent }]}>
          {expanded ? '접기 ↑' : '더보기 ↓'}
        </Text>
      </Pressable>
    </View>
  );
}

/** 내 진척 수정기 — 큰 숫자 탭(정밀 입력) + 진행 바 드래그/탭(대략 조절)으로 현재 페이지를 고친다. */
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
          <Pressable
            onPress={startEdit}
            accessibilityRole="button"
            accessibilityLabel="현재 페이지 수정"
            hitSlop={8}
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

      {save.isError && !save.isPending ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>처리하지 못했어요 · 다시 시도</Text>
      ) : null}
    </>
  );
}

/**
 * 오려둔 문장 — 이 책에서 독자들이 오려 둔 문장을 메모 조각으로 붙여 둔다.
 * '나도 그럼' 수는 여기서도 표시 전용이다(토글은 광장에서만). 조각 자체엔 탭 액션이 없다.
 * 0건이면 섹션을 통째로 감춘다 — 상세에 빈 상자를 남기지 않는다.
 *
 * 홈 스포트라이트에서 조각을 누르면 `focusQuoteId` 를 달고 들어온다. 그때는 그 조각으로
 * 스크롤한 뒤 광장과 같은 FocusRing 으로 한 번만 강조하고, 파라미터는 즉시 비운다 —
 * 뒤로 갔다 돌아와도 다시 튀지 않게. 대상 조각의 자리는 화면이 직접 재므로
 * (부모의 alignFocus) 여기서는 그 조각의 ref 만 넘겨 준다.
 */
function QuoteSection({ bookId, onFocusCard, colors }: {
  bookId: number;
  /** 찍고 온 조각 — 화면이 이 노드를 재서 그 앞에 세운다. */
  onFocusCard: (node: View) => void;
  colors: ColorTokens;
}) {
  const router = useRouter();
  const { focusQuoteId } = useLocalSearchParams<{ focusQuoteId?: string }>();

  const quotes = useQuery({
    queryKey: ['book', bookId, 'quotes'],
    queryFn: () => bookApi.quotes(bookId),
    enabled: Number.isFinite(bookId),
  });
  // 렌더마다 새 배열을 만들면 아래 effect 가 매번 다시 돈다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(() => quotes.data?.content ?? [], [quotes.data]);

  /** 강조가 걸린 문장 — 페이드가 끝나면 스스로 지운다. 한 번에 한 장뿐이다. */
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const clearFocus = useCallback(() => setFocusedId(null), []);

  /** 조각 노드들 — 찍고 온 문장의 자리를 재려면 그 조각 자체가 필요하다. */
  const cardNodes = useRef(new Map<number, View>());

  /**
   * 이미 처리한 focusQuoteId — setParams 로 비우는 게 다음 렌더에 반영되므로 그 사이
   * effect 가 다시 돌아도 두 번 뛰지 않게 막는다(광장과 같은 규율). 파라미터가 비면
   * 가드도 함께 풀어 — 홈에서 같은 문장을 다시 눌렀을 때는 또 움직여야 한다.
   */
  const focusHandled = useRef<string | null>(null);

  useEffect(() => {
    const raw = typeof focusQuoteId === 'string' ? focusQuoteId.trim() : '';
    if (raw === '') {
      focusHandled.current = null;
      return;
    }
    if (focusHandled.current === raw) return;
    // 목록이 와야 그 문장이 이 책에 있는지 안다. 도착하면 이 effect 가 다시 온다.
    if (!quotes.isSuccess) return;

    focusHandled.current = raw;
    router.setParams({ focusQuoteId: '' });

    const target = Number(raw);
    if (!Number.isInteger(target)) return;
    // 그 사이 지워졌거나 첫 페이지 밖의 문장이면 조각이 없다 — 조용히 넘어간다.
    // (조각 ref 는 커밋 때 붙으므로 목록이 그려진 이 시점엔 이미 채워져 있다.)
    const node = cardNodes.current.get(target);
    if (node == null) return;

    setFocusedId(target);
    onFocusCard(node);
    // items 는 조각 ref 가 채워지는 시점을 알려 주는 신호다 — 몸통에서 직접 읽지 않는다.
  }, [focusQuoteId, quotes.isSuccess, items, router, onFocusCard]);

  if (items.length === 0) return null;

  const total = quotes.data?.totalElements;

  return (
    <View style={styles.quoteSection}>
      <View style={styles.quoteHead}>
        <Text style={[typeScale.titleSerif, styles.quoteTitle, { color: colors.text }]}>
          오려둔 문장
        </Text>
        {total != null ? (
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
            {groupNumber(total)}개
          </Text>
        ) : null}
      </View>

      {items.map((quote, index) => (
        <View
          key={quote.id}
          ref={(node) => {
            if (node) cardNodes.current.set(quote.id, node);
            else cardNodes.current.delete(quote.id);
          }}
        >
          {/* 리뷰와 같은 ±1° 교차 회전 — 오려 붙인 티를 내되 읽기를 방해하지 않는다. */}
          <MemoScrap rotate={index % 2 === 0 ? -1 : 1}>
            {focusedId === quote.id ? (
              <FocusRing onDone={clearFocus} borderRadius={radius.sm} />
            ) : null}
            {/* 상세에서는 줄을 자르지 않는다 — 문장을 보러 온 화면이다. */}
            <Text style={[styles.quoteBody, { color: colors.text }]}>{quote.content}</Text>
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.quoteMeta, { color: colors.textFaint }]}>
              {quote.authorNickname}
              {quote.page != null ? ` · ${quote.page}쪽` : ''}
            </Text>
            {/* 표시 전용 — 토글은 광장에서만 한다. */}
            {quote.agreeCount > 0 ? (
              <Text style={[typeScale.monoLabel, styles.quoteHot, { color: colors.accent }]}>
                나도 그럼 {quote.agreeCount}
              </Text>
            ) : null}
          </MemoScrap>
        </View>
      ))}
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
  const total = reviews.data ? reviews.data.totalElements ?? items.length : null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={total != null ? `리뷰 ${groupNumber(total)}` : '리뷰'}
        action={
          rid != null && !done && !open ? (
            <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>쓰기 →</Text>
            </Pressable>
          ) : null
        }
      />

      {open ? (
        <Card style={styles.formCard}>
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
            style={[styles.reviewInput, {
              backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
            }]}
          />
          {errorMessage ? (
            <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
          ) : null}
          <View style={styles.formActions}>
            <Button
              label={create.isPending ? '등록 중…' : '등록'}
              onPress={() => create.mutate()}
              disabled={body.trim().length === 0 || create.isPending}
              style={styles.formButton}
            />
            <Button
              label="취소"
              variant="outline"
              onPress={() => setOpen(false)}
              disabled={create.isPending}
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
          {items.map((review, index) => {
            const verified = review.verificationLevel === 'VERIFIED_FULL';
            return (
              // 오려 붙인 메모 조각 — 인덱스 기준 ±1° 교차 회전으로 붙인 티를 낸다
              <MemoScrap key={review.id} rotate={index % 2 === 0 ? -1 : 1}>
                <View style={styles.reviewHead}>
                  <Text numberOfLines={1} style={[typeScale.label, styles.reviewAuthor, { color: colors.text }]}>
                    {review.authorNickname}
                  </Text>
                  {review.rating ? (
                    <Text style={[typeScale.monoNumeral, { color: colors.accent }]}>★ {review.rating}</Text>
                  ) : null}
                </View>
                <Text style={[styles.reviewBody, { color: colors.textMuted }]}>{review.body}</Text>
                <Text style={[typeScale.monoEyebrow, { color: verified ? colors.accent : colors.textFaint }]}>
                  {VERIFICATION_LABEL[review.verificationLevel]}
                </Text>
              </MemoScrap>
            );
          })}
        </View>
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
    fontFamily: serif.extraBold,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -0.5,
    transform: [{ rotate: '-1.5deg' }],
  },
  heroCaption: { marginTop: spacing.sm },
  ratingNote: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  sections: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
  headBlock: { gap: spacing.lg },
  section: { gap: spacing.sm },
  cardGap: { gap: spacing.md },
  listCard: { paddingVertical: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvBlock: { gap: 0 },
  moreLink: { marginTop: spacing.xs },

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
    borderRadius: radius.pill,
    borderWidth: hairline,
  },
  likeGlyph: { fontSize: 16, lineHeight: 20 },
  pill: {
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pillOutline: { borderWidth: hairline },
  pillPrimary: { flex: 1 },

  statStrip: { flexDirection: 'row', gap: 18, borderTopWidth: hairline, paddingTop: spacing.lg },
  statCell: { gap: 3 },
  statDivider: { width: hairline },
  statValue: { fontFamily: mono.semiBold, fontSize: 19 },
  statLabel: { fontSize: 10 },

  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bigNumber: { fontFamily: mono.semiBold, fontSize: 34 },
  bigNumberInput: { padding: 0, width: 92, borderBottomWidth: hairline },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  trackTouch: { height: 32, justifyContent: 'center' },
  trackActive: { height: 10 },
  fill: { height: '100%', borderRadius: radius.pill },
  thumb: { position: 'absolute', top: '50%', width: 8, height: 22, marginTop: -11, marginLeft: -4, borderRadius: radius.sm },

  verifyHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },

  // 조각 사이 간격은 리뷰 목록과 같은 md — 헤더도 같은 흐름 안에 둔다(조각 y 계산이 단순해진다).
  quoteSection: { gap: spacing.md },
  quoteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  quoteTitle: { fontSize: 18, lineHeight: 26 },
  // 홈 스포트라이트(17/28)보다 한 단 낮춰 목록 리듬에 맞춘다.
  quoteBody: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  quoteMeta: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: spacing.sm },
  quoteHot: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: 3 },

  stars: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
  reviewList: { gap: spacing.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  reviewAuthor: { flexShrink: 1 },
  // 인용 본문 — 시안 14/1.6 세리프.
  reviewBody: { fontFamily: serif.regular, fontSize: 14, lineHeight: 23, marginTop: spacing.sm },
});
