import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { plazaApi } from '@/api/endpoints';
import { MemoScrap, TiltCover } from '@/components/collage';
import { motion, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 광장에서 받아 오는 후보 수 — 이 안에서 '핫한 순'으로 다시 추린다. */
const FEED_SIZE = 10;
/** 스포트라이트에 세우는 문장 수 — 6초마다 한 장씩 돌아간다. */
const SPOTLIGHT_N = 5;
/** 회전 간격(ms). */
const ROTATE_MS = 6000;
/** 표지 스크랩 폭(px) — 시안 2a 의 78px 자리. 높이는 1.5배(108). */
const COVER_W = 72;
/**
 * 행 고정 높이(px).
 *
 * 회전할 때 아래 행들이 밀리면 안 되므로 minHeight 가 아니라 **높이를 못 박는다**.
 * minHeight 만 주면 문장이 3줄인 항목에서 카드가 그 값을 넘겨 행이 커지고,
 * 1줄짜리로 넘어가는 순간 홈 전체가 출렁인다.
 * 값은 인용 3줄(21×3) + 메타·핫 지표 두 줄 + 스크랩 안쪽 여백(12×2)을 더한 최댓값 기준.
 */
const ROW_H = 132;
/** 들어오는 조각이 올라오는 거리(px) — 책상에 내려놓는 듯한 짧은 낙차. */
const ENTER_RISE = 8;
/** 카드 기울기(도) — 회전 항목마다 좌우로 엇갈린다. */
const CARD_TILT = [-1.2, 1];

const EASE_OUT = Easing.out(Easing.quad);

/**
 * 홈 '지금 붐비는 책' 바로 아래 '오려둔 문장' — 광장 밑줄 중 핫한 것 한 장을
 * 스포트라이트로 세우고 6초마다 돌린다 (시안 2a: 인용 카드 + 표지 스크랩 한 쌍).
 *
 * 광장 화면의 무한 쿼리와 캐시를 나눠 쓴다(['plaza','QUOTE'] vs 여기 ['plaza','QUOTE','home']).
 * 서로 다른 항목을 담지만 같은 문장이 겹칠 수 있어, '나도 그럼' 낙관 업데이트는
 * src/api/quoteCache.ts 의 patchQuoteEverywhere 가 두 캐시를 함께 손본다 —
 * **이 키를 바꾸면 그쪽 PLAZA_HOME_KEY 도 같이 바꿔야 한다**.
 *
 * '나도 그럼' 수는 여기선 표시 전용이다. 홈에서는 누를 수 없고, 무엇이 붐비는지만 알린다.
 *
 * 0건이면 섹션을 통째로 감춘다 — 홈에 빈 상자를 남기지 않는다.
 *
 * 광장으로 가는 이동은 push 가 아니라 navigate 다 — 구역(서가·탐색·광장·나) 사이는
 * push 하면 오갈 때마다 스택에 같은 구역이 쌓인다.
 */
export function QuoteScraps() {
  const router = useRouter();
  const { colors } = useTheme();

  const quotes = useQuery({
    queryKey: ['plaza', 'QUOTE', 'home'],
    queryFn: () => plazaApi.feed('QUOTE', 0, FEED_SIZE),
  });

  /** 핫한 순(나도 그럼 내림차순, 동률이면 최신순) 상위 몇 건이 회전 목록이 된다. */
  const spotlight = useMemo(() => {
    const list = quotes.data?.content ?? [];
    return [...list]
      .sort((a, b) => {
        const hot = (b.agreeCount ?? 0) - (a.agreeCount ?? 0);
        if (hot !== 0) return hot;
        return b.occurredAt.localeCompare(a.occurredAt);
      })
      .slice(0, SPOTLIGHT_N);
  }, [quotes.data]);

  // 계속 증가하는 카운터를 목록 길이로 나눠 쓴다 — 목록이 줄어도 범위를 벗어나지 않는다.
  const [turn, setTurn] = useState(0);
  const advance = useCallback(() => setTurn((t) => t + 1), []);

  /** 0 → 1 로 자리를 잡고, 다음 장으로 넘어갈 땐 1 → 0 으로 지워진다. */
  const settle = useSharedValue(1);

  const count = spotlight.length;
  // 한 장뿐이면 돌릴 이유가 없다 — 타이머도 걸지 않는다.
  const rotating = count > 1;

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => {
      // 나가는 조각을 먼저 빠르게 지우고, 다 지워진 순간에 다음 장으로 바꾼다.
      settle.value = withTiming(0, { duration: motion.fast, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(advance)();
      });
    }, ROTATE_MS);
    return () => {
      clearInterval(timer);
      // 나가는 페이드가 떠 있는 150ms 창에서 정리되면, 완료 콜백의 runOnJS(advance) 가
      // 주인 없는 상태로 발화한다 — 애니메이션을 먼저 끊어 콜백 자체를 없앤다.
      cancelAnimation(settle);
      // 끊긴 자리에 반투명하게 굳지 않도록 정착 상태로 되돌린다
      // (항목이 2건 → 1건으로 줄어 회전이 꺼지는 경우, 이 카드는 계속 화면에 남는다).
      settle.value = 1;
    };
  }, [rotating, advance, settle]);

  // 새 조각이 책상에 놓이는 연출 — 살짝 아래에서 올라오며 기울기가 정착한다.
  useEffect(() => {
    settle.value = 0;
    settle.value = withTiming(1, { duration: motion.base, easing: EASE_OUT });
  }, [turn, settle]);

  const index = count > 0 ? turn % count : 0;
  const tilt = CARD_TILT[index % CARD_TILT.length];

  // 카드와 표지가 한 몸으로 사라졌다 나타난다 — 조각 한 쌍을 통째로 바꾸는 느낌.
  const groupStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateY: (1 - settle.value) * ENTER_RISE }],
  }));
  // 기울기만 카드 몫 — 표지는 제 각도(2도)를 그대로 지킨다.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${settle.value * tilt}deg` }],
  }));

  const item = spotlight[index];
  if (!item) return null;

  const openPlaza = () => router.navigate('/plaza');
  const agreeCount = item.agreeCount ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>오려둔 문장</Text>
        <Pressable
          onPress={openPlaza}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="광장으로"
        >
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>광장 →</Text>
        </Pressable>
      </View>

      {/* 자동 회전은 스크린리더를 시끄럽게 하지 않는다 — liveRegion 을 걸지 않고
          라벨만 현재 항목으로 바뀐다. */}
      <Pressable
        onPress={openPlaza}
        accessibilityRole="button"
        accessibilityLabel={`${item.authorNickname}가 오려둔 ${item.bookTitle}의 문장`}
        style={styles.rowWrap}
      >
        <Animated.View style={[styles.row, groupStyle]}>
          <Animated.View style={[styles.cardSlot, cardStyle]}>
            {/* 기울기는 회전 연출과 함께 움직여야 해서 바깥에서 준다. */}
            <MemoScrap rotate={0} style={styles.card}>
              <Text numberOfLines={3} style={[styles.quote, { color: colors.text }]}>
                {item.content}
              </Text>
              <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
                {item.authorNickname} · {item.bookTitle}
              </Text>
              {/* 표시 전용 — 홈에서는 누를 수 없다. 토글은 광장에서만. */}
              {agreeCount > 0 ? (
                <Text style={[typeScale.monoLabel, styles.hot, { color: colors.accent }]}>
                  나도 그럼 {agreeCount}
                </Text>
              ) : null}
            </MemoScrap>
          </Animated.View>

          {/*
            표지에도 onPress 를 달지 않는다 — 웹에서 accessibilityRole="button" 은 진짜
            <button> 으로 나가므로 행 버튼 안에 표지 버튼이 겹치면 중첩 버튼(잘못된 HTML)이 된다.
            표지 탭은 행 버튼이 그대로 받아 광장으로 보낸다.

            pointerEvents 는 터치만 막고 접근성 트리는 그대로 둔다 — 네이티브 스크린리더가
            표지에서 한 번 더 멈춰 책 제목을 되풀이한다. 세 플랫폼이 각각 다른 속성을 보므로
            (iOS accessibilityElementsHidden · 안드로이드 importantForAccessibility · 웹 aria-hidden)
            셋 다 걸어 가지째 숨긴다. 행 라벨이 이미 책 제목을 읽어 준다.
          */}
          <View
            style={styles.coverSlot}
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <TiltCover
              uri={item.bookCoverUrl}
              title={item.bookTitle}
              width={COVER_W}
              tilt={2}
              entering={false}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  title: { fontSize: 18, lineHeight: 26 },
  rowWrap: { paddingHorizontal: spacing.lg },
  // 높이를 못 박아 문장 길이·회전과 무관하게 아래 행이 그대로 있게 한다.
  row: { flexDirection: 'row', gap: spacing.md, height: ROW_H },
  cardSlot: { flex: 1 },
  // numberOfLines 는 줄 수만 자를 뿐 글자 상자는 못 자른다 — 시스템 글꼴을 크게 키우면
  // 3줄이 132px 를 넘겨 아래 '추천' 행 위로 번진다. 조각 밖으로는 한 픽셀도 내보내지 않는다.
  card: { flex: 1, overflow: 'hidden' },
  // 인용이 남은 자리를 차지하고, 메타·핫 지표는 조각 아래쪽에 앉는다.
  quote: { flex: 1, fontFamily: serif.regular, fontSize: 13, lineHeight: 21 },
  meta: { fontSize: 9, letterSpacing: 0.4, lineHeight: 13, marginTop: spacing.sm },
  hot: { fontSize: 9, letterSpacing: 0.4, lineHeight: 13, marginTop: 3 },
  // 표지(108)는 행(132)보다 낮다 — 가운데에 걸어 위아래 여백을 맞춘다.
  coverSlot: { justifyContent: 'center' },
});
