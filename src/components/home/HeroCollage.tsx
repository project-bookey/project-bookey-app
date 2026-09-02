import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { ReadingRecord } from '@/api/types';
import { MemoScrap, StickyNote, TiltCover } from '@/components/collage';
import { useTheme } from '@/theme';
import { radius, serif, spacing, statusLabel, typeScale } from '@/theme/tokens';

/**
 * 시안(390px) 기준 지오메트리 — 실제 폭에 비례 환산한다.
 * 시안 HTML은 content-box 라 노트·메모 폭은 패딩·테두리를 더한 바깥 폭으로 옮겼다.
 */
const BASE_W = 390;
const G = {
  /** 표지 스택 */
  coverW: 126,
  /** 시안은 100 — 왼쪽 표제 캡션에 숨통을 주려고 46px 오른쪽으로(사용자 조정 3회) */
  coverLeftRatio: 146 / BASE_W,
  coverTop: 24,
  /**
   * 뒤장 — 시안은 (150,10)·120×176·+6° 로 오른쪽 위에 부채꼴로 펼쳐져 있다.
   * 본 표지 중심 대비 (+47,-18) 을 -4° 프레임 좌표로 환산한 값이고, 회전은 프레임 안 상대값.
   */
  stack: { x: 48, y: -15, rotate: 10, scale: 0.95 },
  /** 시작한 달 표제 — 표지 왼쪽 위 빈 종이. 아이브로우+두 줄 표제+밑줄이 노트(118) 위에서 끝난다 */
  shelfTop: 14,
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

/**
 * 패럴랙스 계수 — 움직이는 레이어는 표지·종이 둘뿐이다(스크롤 성능).
 * 스티키 노트는 처음 0.45 로 가장 빠르게 밀었지만 스크롤을 내릴 때 노트만 따라 내려오는 것처럼
 * 보여(사용자 피드백) 판에 고정했다 — 종이에 붙인 메모는 종이와 함께 움직여야 자연스럽다.
 */
const P = { cover: 0.25, paper: 0.12 } as const;

/**
 * 패럴랙스 입력 상한(px).
 *
 * 계수를 스크롤 전 구간에 곱하면 레이어가 히어로 판을 벗어나 무한히 밀린다.
 * 입력을 여기서 끊으면 가장 많이 밀리는 표지(0.25)의 드리프트가 160×0.25=40px 에서
 * 멈춰 아래 '지금 붐비는 책' 행을 넘보지 않는다. 캡 지점이면 히어로가 이미 화면
 * 상단으로 밀려난 뒤라 눈에 보이는 차등 손실은 없다.
 */
const HERO_PARALLAX_RANGE = 160;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 읽기 시작한 달 표제 — 아이브로우 `SINCE 08.12` + 두 줄 표제 `8월의 / 서가`.
 * 해가 다르면 아이브로우에만 연도를 붙인다(`SINCE 2025.12.03`). 시작일이 없으면 null.
 */
function shelfCaption(startedAt: string | undefined, now = new Date()): { eyebrow: string; title: string } | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}.`;
  return { eyebrow: `SINCE ${year}${mm}.${dd}`, title: `${d.getMonth() + 1}월의
서가` };
}

/** 스크롤 오프셋을 패럴랙스 유효 구간으로 가둔다 — iOS 바운스의 음수도 막는다. */
function parallaxOffset(y: number) {
  'worklet';
  return Math.min(Math.max(0, y), HERO_PARALLAX_RANGE);
}

/**
 * 서가 히어로 콜라주 — 도트 종이 위에 표지 스택·스티키 노트·CTA·메모 조각·시작한 달 캡션을 흩어 놓는다.
 *
 * 표지와 종이(CTA·메모·표제) 레이어가 스크롤 오프셋에 다른 계수를 곱해(패럴랙스) 서로 다른
 * 속도로 밀리고, 스티키 노트는 판에 고정이다. 읽는 중 기록이 없으면 렌더하지 않는다 — 검색 진입은 상단 검색 바가 담당.
 */
export function HeroCollage({ record, synopsis, streakLine, loading, scrollY, onContinue, onDetail }: {
  record: ReadingRecord | null;
  /** 책 소개(줄거리) — 뒤에 끼운 메모장에 적힌다. 없으면 빈 괘선 메모장. */
  synopsis?: string;
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
  const shelf = shelfCaption(record.startedAt);
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
          // 장정본 — 띠지에 상태와 진행을 적고(노트와 겹치지만 표지 자체가 말하게), 뒤장은 줄거리 메모장.
          bound={{
            band: {
              title: statusLabel[record.status] ?? '읽는 중',
              meta: hasPages
                ? `${record.progress.currentPage} / ${record.progress.totalPages} · ${percent}%`
                : `${percent}%`,
            },
            backNote: synopsis ? { title: '줄거리', body: synopsis } : {},
          }}
          entranceKey={`hero:${record.book?.id ?? record.id}`}
          onPress={() => onDetail(record)}
          accessibilityLabel={`${record.book?.title ?? '책'} 상세`}
        />
      </Animated.View>

      {/* ② 스티키 노트 — 표지 위에 겹쳐 붙어 있고 판에 고정(패럴랙스 없음) */}
      <View
        style={[
          styles.layer,
          { left: Math.round(W * G.noteLeftRatio), top: noteTop, width: clamp(W * G.noteWRatio, 196, 280) },
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
      </View>

      {/* ③ 시작한 달 표제 + CTA + 메모 조각 — 한 레이어로 묶어 가장 적게 밀린다(레이어 3개 제한) */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, paperStyle]}>
        {shelf ? (
          // 잡지 챕터 표제 — 민트 아이브로우, 세리프 두 줄, 구역 네비와 같은 민트 밑줄 토막.
          <View
            pointerEvents="none"
            style={[styles.shelf, { left: Math.round(W * G.ctaLeftRatio), top: Math.round(G.shelfTop * k) }]}
          >
            <Text style={[typeScale.monoEyebrow, styles.shelfEyebrow, { color: colors.accent }]}>{shelf.eyebrow}</Text>
            <Text style={[styles.shelfTitle, { color: colors.text }]}>{shelf.title}</Text>
            <View style={[styles.shelfRule, { backgroundColor: colors.accent }]} />
          </View>
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
              style={[typeScale.monoEyebrow, styles.streak, { color: colors.textMuted }]}
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
  shelf: { position: 'absolute', transform: [{ rotate: '-2deg' }] },
  shelfEyebrow: { fontSize: 9 },
  // 시안 23px 세리프 두 줄 — 노트 표제(21)보다 한 단 크게, 자간은 살짝 조인다.
  shelfTitle: { fontFamily: serif.extraBold, fontSize: 23, lineHeight: 26, marginTop: 5, letterSpacing: -0.2 },
  shelfRule: { width: 26, height: 2, marginTop: 7 },
  // 한글이 섞이는 캡션이라 모노 아이브로우의 넓은 자간은 덜어낸다.
  streak: { flexShrink: 1, letterSpacing: 0.3, transform: [{ rotate: '-3deg' }] },
  memo: { paddingVertical: 9, paddingHorizontal: 11 },
  memoQuote: { fontFamily: serif.regular, fontSize: 12, lineHeight: 18 },
  memoSign: { fontSize: 8, letterSpacing: 0.5, marginTop: 5 },
});
