import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, libraryApi, reviewApi, sessionApi } from '@/api/endpoints';
import { bookReviewsKey, invalidateReviewLists } from '@/api/reviewCache';
import type { BookDetail, BookSummary, ReadingRecord, ReadingStatus } from '@/api/types';
import { ConfirmButton } from '@/components/ConfirmButton';
import { BookPostsTab } from '@/components/book/BookPostsTab';
import { BookQuotesTab } from '@/components/book/BookQuotesTab';
import { PaperScreen, StickyNote, SubHeader, TiltCover } from '@/components/collage';
import type { BookBand, BookNote } from '@/components/collage';
import { ReviewScrap } from '@/components/review/ReviewScrap';
import { VERIFICATION_LABEL } from '@/components/review/verification';
import {
  Button, Card, Eyebrow, KeyValue, SectionHeader, Tag, formatDuration, formatRelative, percent,
} from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { getLagStyle, hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif, statusLabel } from '@/theme/tokens';

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

  return (
    <PaperScreen>
      <SubHeader category={headerCategory(info)} />

      <ScrollView contentContainerStyle={styles.container}>
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

type RecordTab = 'REVIEW' | 'QUOTE' | 'POST';
const RECORD_TABS: { value: RecordTab; label: string }[] = [
  { value: 'REVIEW', label: '리뷰' },
  { value: 'QUOTE', label: '밑줄' },
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

/** 리뷰 | 밑줄 | 독후감 탭 섹션(A1) — 리뷰 목록·인라인 작성 폼과 책별 밑줄·독후감 탭을 한 제목줄 아래에 둔다. */
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
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  // 탭을 바꾸면 펼쳐져 있던 작성 폼은 닫는다 — 다른 탭 밑에 폼이 숨어 있지 않게.
  const switchTab = (next: RecordTab) => {
    if (next === tab) return;
    setOpen(false);
    setQuoteOpen(false);
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

  // 우측 액션은 탭별 — 리뷰는 '쓰기', 밑줄은 '오려두기', 독후감은 작성 화면으로 나가는 '쓰기'.
  // 리뷰·밑줄은 이 책의 읽기 기록이 있어야 쓸 수 있지만, 독후감은 서재에 담지 않은 책에도 쓸 수 있다.
  const action = tab === 'POST'
    ? (
        <Pressable
          onPress={() => router.push({ pathname: '/post/new', params: { bookId: String(bookId) } })}
          accessibilityRole="button" accessibilityLabel="독후감 쓰기" hitSlop={8} style={styles.tabAction}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>쓰기 →</Text>
        </Pressable>
      )
    : tab === 'REVIEW'
    ? (rid != null && !done && !open ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8} style={styles.tabAction}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>쓰기 →</Text>
        </Pressable>
      ) : null)
    : (rid != null && !quoteOpen ? (
        <Pressable onPress={() => setQuoteOpen(true)} accessibilityRole="button" hitSlop={8} style={styles.tabAction}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>오려두기 →</Text>
        </Pressable>
      ) : null);

  return (
    <View style={styles.section}>
      <TabbedSectionHeader tabs={RECORD_TABS} value={tab} onChange={switchTab} action={action} colors={colors} />

      {tab === 'POST' ? (
        <BookPostsTab bookId={bookId} />
      ) : tab === 'QUOTE' ? (
        <BookQuotesTab bookId={bookId} rid={rid} open={quoteOpen} onClose={() => setQuoteOpen(false)} />
      ) : (
        <>
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
  // 리뷰|밑줄 탭 헤더 — SectionHeader 와 같은 높이·간격, 제목은 명조 18.
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  // 탭 헤더 우측 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다(세 탭 모두 같은 자리).
  // 늘린 좌우 여백만큼 음수 마진으로 되돌려 글자는 제목줄 끝에 그대로 맞춘다(FootAction 과 같은 규율).
  tabAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  tabRow: { flexDirection: 'row', gap: 18 },
  tab: { gap: 6 },
  tabTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  tabRule: { width: 22, height: 2 },
  reviewList: { gap: spacing.md },
});
