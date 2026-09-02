import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { ReadingRecord } from '@/api/types';
import { MemoScrap, StickyNote, TiltCover } from '@/components/collage';
import { useTheme } from '@/theme';
import { radius, serif, spacing, typeScale } from '@/theme/tokens';

/** 시안(390px) 기준 지오메트리 — 실제 폭에 비례 환산한다. */
const BASE_W = 390;
const G = {
  /** 표지 스택 */
  coverW: 126,
  coverLeftRatio: 100 / BASE_W,
  coverTop: 24,
  /** 스티키 노트 */
  noteLeftRatio: 20 / BASE_W,
  noteTop: 118,
  noteWRatio: 190 / BASE_W,
  /** CTA 행 */
  ctaLeftRatio: 24 / BASE_W,
  ctaTop: 220,
  /** 메모 조각 */
  memoRightRatio: 14 / BASE_W,
  memoTop: 202,
  memoWRatio: 112 / BASE_W,
  /** 콜라주 판 기본 높이 */
  height: 300,
} as const;

/** 패럴랙스 계수 — 레이어 3개로 제한한다(스크롤 성능). */
const P = { cover: 0.25, note: 0.45, paper: 0.12 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 서가 히어로 콜라주 — 도트 종이 위에 표지 스택·스티키 노트·CTA·메모 조각을 흩어 놓는다.
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
    transform: [{ translateY: scrollY.value * P.cover }],
  }));
  const noteStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * P.note }],
  }));
  const paperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * P.paper }],
  }));

  const W = boardW || Math.min(window.width, 560);
  // 표지·세로 좌표 배율 — 좁은 화면에서는 줄이고 태블릿에서는 과하게 키우지 않는다.
  const k = clamp(W / BASE_W, 0.86, 1.18);

  const coverW = Math.round(G.coverW * k);
  const noteTop = Math.round(G.noteTop * k);
  // 노트 높이를 재기 전에는 시안 좌표를 쓴다(첫 프레임 점프 방지).
  const ctaTop = Math.round(Math.max(G.ctaTop * k, noteH > 0 ? noteTop + noteH + 8 : 0));
  const boardH = Math.max(Math.round(G.height * k), ctaTop + 64);

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== boardW) setBoardW(next);
  };

  if (loading) {
    return <View style={[styles.skeleton, { height: G.height, backgroundColor: colors.surface }]} />;
  }

  if (!record) {
    return null;
  }

  const percent = Math.round((record.progress.completionRate ?? 0) * 100);
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
          entranceKey={`hero:${record.book?.id ?? record.id}`}
          onPress={() => onDetail(record)}
          accessibilityLabel={`${record.book?.title ?? '책'} 상세`}
        />
      </Animated.View>

      {/* ② 스티키 노트 — 표지 위에 겹쳐 가장 빠르게 밀린다 */}
      <Animated.View
        style={[
          styles.layer,
          { left: Math.round(W * G.noteLeftRatio), top: noteTop, width: clamp(W * G.noteWRatio, 172, 250) },
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

      {/* ③ CTA + 메모 조각 — 한 레이어로 묶어 가장 적게 밀린다(레이어 3개 제한) */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, paperStyle]}>
        <View style={[styles.ctaRow, { left: Math.round(W * G.ctaLeftRatio), top: ctaTop }]}>
          <Pressable
            onPress={() => onContinue(record)}
            style={[styles.cta, cardShadow, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="이어서 읽기"
          >
            <Text style={[typeScale.label, { color: colors.onAccent }]}>▶ 이어서 읽기</Text>
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
            {
              right: Math.round(W * G.memoRightRatio),
              top: Math.round(G.memoTop * k),
              width: clamp(W * G.memoWRatio, 104, 136),
            },
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
  skeleton: { marginHorizontal: spacing.lg, borderRadius: radius.md },
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
    maxWidth: '92%',
  },
  cta: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.md - 2,
  },
  // 한글이 섞이는 캡션이라 모노 아이브로우의 넓은 자간은 덜어낸다.
  streak: { flexShrink: 1, letterSpacing: 0.3, transform: [{ rotate: '-3deg' }] },
  memo: { paddingVertical: 9, paddingHorizontal: 11 },
  memoQuote: { fontFamily: serif.regular, fontSize: 12, lineHeight: 18 },
  memoSign: { fontSize: 8, letterSpacing: 0.5, marginTop: 5 },
});
