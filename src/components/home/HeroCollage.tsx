import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { ReadingRecord } from '@/api/types';
import { MemoScrap, StickyNote, TiltCover } from '@/components/collage';
import { useTheme } from '@/theme';
import { radius, serif, spacing, typeScale } from '@/theme/tokens';

/**
 * 시안(390px) 기준 지오메트리 — 실제 폭에 비례 환산한다.
 * 시안 HTML은 content-box 라 노트·메모 폭은 패딩·테두리를 더한 바깥 폭으로 옮겼다.
 */
const BASE_W = 390;
const G = {
  /** 표지 스택 */
  coverW: 126,
  coverLeftRatio: 100 / BASE_W,
  coverTop: 24,
  /**
   * 뒤장 — 시안은 (150,10)·120×176·+6° 로 오른쪽 위에 부채꼴로 펼쳐져 있다.
   * 본 표지 중심 대비 (+47,-18) 을 -4° 프레임 좌표로 환산한 값이고, 회전은 프레임 안 상대값.
   */
  stack: { x: 48, y: -15, rotate: 10, scale: 0.95 },
  /** 시작한 달 캡션 — 표지 왼쪽 위 빈 종이에, 표지 윗변(y≈20~29)과 겹치지 않는 높이 */
  shelfTop: 8,
  /** 스티키 노트 */
  noteLeftRatio: 20 / BASE_W,
  noteTop: 118,
  noteWRatio: 218 / BASE_W,
  /** CTA 행 */
  ctaLeftRatio: 24 / BASE_W,
  ctaTop: 220,
  /** 메모 조각 */
  memoRightRatio: 14 / BASE_W,
  memoTop: 202,
  memoWRatio: 136 / BASE_W,
  /** 콜라주 판 기본 높이 — 시안 336 에서 다음 섹션 gap(24) 몫을 덜어낸 값 */
  height: 316,
} as const;

/** 패럴랙스 계수 — 레이어 3개로 제한한다(스크롤 성능). */
const P = { cover: 0.25, note: 0.45, paper: 0.12 } as const;

/**
 * 패럴랙스 입력 상한(px).
 *
 * 계수를 스크롤 전 구간에 곱하면 레이어가 히어로 판을 벗어나 무한히 밀린다 —
 * 가장 많이 밀리는 노트(0.45)가 스크롤 222px 부근에서 아래 '지금 붐비는 책'
 * 헤더와 표지를 덮었다. 입력을 여기서 끊으면 노트 드리프트가 160×0.45=72px 에서
 * 멈춘다 — 390px 기준 실측으로 인기 행 헤더와 약 21px, 행 표지와 약 71px 간격을
 * 유지하며 스크롤을 아무리 더 내려도 그대로다. 캡 지점이면 히어로가 이미 화면
 * 상단으로 밀려난 뒤라 눈에 보이는 차등 손실은 없다.
 */
const HERO_PARALLAX_RANGE = 160;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 읽기 시작한 달 캡션 — `— 9월의 서가`. 해가 다르면 연도를 앞에 붙이고, 시작일이 없으면 null. */
function shelfLabel(startedAt: string | undefined, now = new Date()): string | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return null;
  const month = `${d.getMonth() + 1}월의 서가`;
  return d.getFullYear() === now.getFullYear() ? `— ${month}` : `— ${d.getFullYear()}년 ${month}`;
}

/** 스크롤 오프셋을 패럴랙스 유효 구간으로 가둔다 — iOS 바운스의 음수도 막는다. */
function parallaxOffset(y: number) {
  'worklet';
  return Math.min(Math.max(0, y), HERO_PARALLAX_RANGE);
}

/**
 * 서가 히어로 콜라주 — 도트 종이 위에 표지 스택·스티키 노트·CTA·메모 조각·시작한 달 캡션을 흩어 놓는다.
 *
 * 레이어마다 스크롤 오프셋에 다른 계수를 곱해(패럴랙스) 종이들이 각각 다른
 * 속도로 밀린다. 읽는 중 기록이 없으면 렌더하지 않는다 — 검색 진입은 상단 검색 바가 담당.
 */
export function HeroCollage({ record, streakLine, loading, scrollY, onContinue, onDetail }: {
  record: ReadingRecord | null;
  /** `N일 연속 · 오늘 M분` — CTA 옆 모노 캡션 */
  streakLine?: string;
  loading?: boolean;
  /** 홈 스크롤 오프셋(px) */
  scrollY: SharedValue<number>;
  onContinue: (record: ReadingRecord) => void;
  onDetail: (record: ReadingRecord) => void;
}) {
  const { colors, cardShadow } = useTheme();
  const window = useWindowDimensions();
  // 실제 콜라주 판 폭. 레이아웃 전 첫 프레임은 화면 폭으로 근사한다.
  const [boardW, setBoardW] = useState(0);
  // 스티키 노트 실제 높이 — 긴 제목으로 노트가 커져도 CTA를 밀어낸다.
  const [noteH, setNoteH] = useState(0);

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: parallaxOffset(scrollY.value) * P.cover }],
  }));
  const noteStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: parallaxOffset(scrollY.value) * P.note }],
  }));
  const paperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: parallaxOffset(scrollY.value) * P.paper }],
  }));

  const W = boardW || Math.min(window.width, 560);
  // 표지·세로 좌표 배율 — 좁은 화면에서는 줄이고 태블릿에서는 과하게 키우지 않는다.
  const k = clamp(W / BASE_W, 0.86, 1.18);

  const coverW = Math.round(G.coverW * k);
  const noteTop = Math.round(G.noteTop * k);
  // 노트 높이를 재기 전에는 시안 좌표를 쓴다(첫 프레임 점프 방지).
  const ctaTop = Math.round(Math.max(G.ctaTop * k, noteH > 0 ? noteTop + noteH + 8 : 0));
  const boardH = Math.max(Math.round(G.height * k), ctaTop + 64);

  const memoRight = Math.round(W * G.memoRightRatio);
  const memoW = Math.round(clamp(W * G.memoWRatio, 126, 164));
  // CTA 행은 메모 조각 왼쪽 엣지 8px 앞에서 끊는다 — 긴 스트릭 문구가 메모 밑으로
  // 깔리는 대신 말줄임되게 한다(둘은 같은 세로 띠에 있다).
  const ctaRight = memoRight + memoW + 8;

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== boardW) setBoardW(next);
  };

  if (loading) {
    // 실제 판과 같은 높이·같은 풀블리드 — 로딩이 끝날 때 아래 섹션이 튀지 않는다.
    return (
      <View
        onLayout={onBoardLayout}
        style={[styles.board, { height: boardH, backgroundColor: colors.surface }]}
      />
    );
  }

  if (!record) {
    return null;
  }

  const percent = Math.round((record.progress.completionRate ?? 0) * 100);
  const shelf = shelfLabel(record.startedAt);
  const hasPages = record.progress.totalPages > 0;
  const pageLine = [
    record.book?.author ?? '저자 미상',
    hasPages ? `${record.progress.currentPage}/${record.progress.totalPages}쪽` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.board, { height: boardH }]} onLayout={onBoardLayout}>
      {/* ① 표지 스택 — 가장 느리게 밀린다 */}
      <Animated.View
        style={[styles.layer, { left: Math.round(W * G.coverLeftRatio), top: Math.round(G.coverTop * k) }, coverStyle]}
      >
        <TiltCover
          uri={record.book?.coverUrl}
          title={record.book?.title}
          width={coverW}
          tilt={-4}
          stacked
          stackOffset={G.stack}
          entranceKey={`hero:${record.book?.id ?? record.id}`}
          onPress={() => onDetail(record)}
          accessibilityLabel={`${record.book?.title ?? '책'} 상세`}
        />
      </Animated.View>

      {/* ② 스티키 노트 — 표지 위에 겹쳐 가장 빠르게 밀린다 */}
      <Animated.View
        style={[
          styles.layer,
          { left: Math.round(W * G.noteLeftRatio), top: noteTop, width: clamp(W * G.noteWRatio, 196, 280) },
          noteStyle,
        ]}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0 && next !== noteH) setNoteH(next);
        }}
      >
        <StickyNote rotate={-2}>
          <Text style={[typeScale.monoEyebrow, styles.noteEyebrow, { color: colors.onNote }]}>
            읽는 중 · {percent}%
          </Text>
          <Text numberOfLines={2} style={[styles.noteTitle, { color: colors.onNote }]}>
            {record.book?.title ?? '제목 미상'}
          </Text>
          <Text numberOfLines={1} style={[typeScale.caption, styles.noteMeta, { color: colors.onNote }]}>
            {pageLine}
          </Text>
        </StickyNote>
      </Animated.View>

      {/* ③ 시작한 달 캡션 + CTA + 메모 조각 — 한 레이어로 묶어 가장 적게 밀린다(레이어 3개 제한) */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, paperStyle]}>
        {shelf ? (
          <Text
            numberOfLines={1}
            style={[
              typeScale.monoEyebrow,
              styles.handCaption,
              styles.shelf,
              // 오른쪽 경계는 판 절반 — 연도가 붙어도 표지 위로 넘어가지 않게.
              { left: Math.round(W * G.ctaLeftRatio), top: Math.round(G.shelfTop * k), right: Math.round(W / 2), color: colors.textMuted },
            ]}
          >
            {shelf}
          </Text>
        ) : null}
        <View style={[styles.ctaRow, { left: Math.round(W * G.ctaLeftRatio), right: ctaRight, top: ctaTop }]}>
          <Pressable
            onPress={() => onContinue(record)}
            style={[styles.cta, cardShadow, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="이어서 읽기"
          >
            {/* 시안 라벨 — '읽기'를 붙이면 스트릭 캡션이 메모 조각에 닿아 말줄임된다. */}
            <Text style={[typeScale.label, { color: colors.onAccent }]}>▶ 이어서</Text>
          </Pressable>
          {streakLine ? (
            <Text
              numberOfLines={1}
              style={[typeScale.monoEyebrow, styles.handCaption, styles.streak, { color: colors.textMuted }]}
            >
              {streakLine}
            </Text>
          ) : null}
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.layer,
            { right: memoRight, top: Math.round(G.memoTop * k), width: memoW },
          ]}
        >
          {/* 고정 카피 — 데이터 연동 없음(책상에 붙여둔 지난 주의 쪽지) */}
          <MemoScrap rotate={3} style={styles.memo}>
            <Text style={[styles.memoQuote, { color: colors.text }]}>{'“여기서 멈추면\n영영 안 읽음”'}</Text>
            <Text style={[typeScale.monoEyebrow, styles.memoSign, { color: colors.textFaint }]}>
              — 지난 주의 나
            </Text>
          </MemoScrap>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { position: 'relative' },
  layer: { position: 'absolute' },
  noteEyebrow: { opacity: 0.7 },
  // 시안 21px 세리프 — 두 줄까지만 두고 넘치면 말줄임한다(긴 제목 대비).
  noteTitle: { fontFamily: serif.extraBold, fontSize: 21, lineHeight: 25, marginTop: spacing.xs },
  noteMeta: { marginTop: spacing.xs, opacity: 0.75 },
  ctaRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cta: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.md - 2,
  },
  // 손으로 적은 캡션 — 한글이 섞여 모노 아이브로우의 넓은 자간은 덜어내고 살짝 기울인다.
  handCaption: { letterSpacing: 0.3, transform: [{ rotate: '-3deg' }] },
  shelf: { position: 'absolute' },
  streak: { flexShrink: 1 },
  memo: { paddingVertical: 9, paddingHorizontal: 11 },
  memoQuote: { fontFamily: serif.regular, fontSize: 12, lineHeight: 18 },
  memoSign: { fontSize: 8, letterSpacing: 0.5, marginTop: 5 },
});
