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

import { plazaApi, postApi } from '@/api/endpoints';
import { POST_HOME_KEY } from '@/api/postCache';
import { PLAZA_HOME_KEY } from '@/api/quoteCache';
import type { PlazaItem, Post } from '@/api/types';
import { MemoScrap, TiltCover } from '@/components/collage';
import { HomeSection } from '@/components/home/HomeSection';
import { HOT_GAP, META_LH, META_SIZE, QUOTE_LINES, QUOTE_MAX_H } from '@/components/home/scrapMetrics';
import { PostScrap } from '@/components/post/PostScrap';
import { motion, spacing, typeScale, useTheme } from '@/theme';

/** 광장에서 받아 오는 밑줄 후보 수 — 이 안에서 '핫한 순'으로 다시 추린다. */
const FEED_SIZE = 10;
/** 독후감 후보 수 — 스포트라이트에는 두 장까지만 서므로 다섯이면 넉넉하다. */
const POST_FEED_SIZE = 5;
/**
 * 스포트라이트 자리 배분 — 밑줄 셋·독후감 둘을 번갈아 세운다(6초마다 한 장씩, 모두 다섯 장).
 * 한쪽이 모자라면 그 자리를 다른 쪽 다음 후보가 메운다(독후감이 0건이면 밑줄 다섯 장).
 */
const SLOTS = ['quote', 'post', 'quote', 'post', 'quote'] as const;
/** 회전 간격(ms). */
const ROTATE_MS = 6000;
/** 표지 스크랩 폭(px) — 시안 2a 의 78px 자리. 높이는 1.5배(108). */
const COVER_W = 72;
// 인용·메타 조판(QUOTE_LINES·QUOTE_MAX_H·META_*·HOT_GAP)은 독후감 조각과 나눠 쓰는 값이라
// scrapMetrics 한 곳에 있다 — 스포트라이트는 인용 토큰(`typeScale.quote`, 세리프 17/28)을 그대로 세운다.

/**
 * 행 고정 높이(px).
 *
 * 회전할 때 아래 행들이 밀리면 안 되므로 minHeight 가 아니라 **높이를 못 박는다**.
 * minHeight 만 주면 문장이 3줄인 항목에서 카드가 그 값을 넘겨 행이 커지고,
 * 1줄짜리로 넘어가는 순간 홈 전체가 출렁인다.
 *
 * 인용 3줄 최악의 경우 필요한 높이:
 *
 *   스크랩 테두리 1×2 + 안쪽 여백 12×2  = 26
 *   인용 28 × 3                         = 84
 *   메타 lineHeight 14                  = 14
 *   핫   간격 3 + lineHeight 14         = 17
 *                                     합 = 141
 *
 * 여기에 인용과 메타 사이 숨 쉴 자리 겸, 글꼴 폴백으로 줄상자가 두꺼워질 때를 위한
 * 여유 15px 을 얹어 156 (인용을 15/24 로 쓰던 종전엔 같은 셈으로 144 였다).
 * 남는 자리는 메타의 `marginTop:'auto'` 가 인용 아래로 몰아 준다 —
 * 메타·핫 지표는 문장 길이와 무관하게 늘 조각 바닥에 붙는다.
 * 독후감 조각도 같은 짜임(글 상자 84 + 메타 + 핫)이라 어느 쪽이 서도 행 높이가 같다.
 */
const ROW_SLACK = 15;
const ROW_H = 2 + spacing.md * 2 + QUOTE_MAX_H + META_LH + HOT_GAP + META_LH + ROW_SLACK;
/** 들어오는 조각이 올라오는 거리(px) — 책상에 내려놓는 듯한 짧은 낙차. */
const ENTER_RISE = 8;
/** 카드 기울기(도) — 회전 항목마다 좌우로 엇갈린다. */
const CARD_TILT = [-1.2, 1];

const EASE_OUT = Easing.out(Easing.quad);

/** 스포트라이트에 서는 조각 — 밑줄 한 장이거나 독후감 한 장이다. */
type Scrap = { kind: 'quote'; item: PlazaItem } | { kind: 'post'; item: Post };

/**
 * 홈 '지금 붐비는 책' 바로 아래 '오려둔 글' — 광장의 밑줄과 독후감 중 핫한 것을
 * 한 장씩 스포트라이트로 세우고 6초마다 돌린다 (시안 2a: 글 카드 + 표지 스크랩 한 쌍).
 *
 * 밑줄 셋·독후감 둘을 번갈아 세워 광장에 두 종류의 글이 있다는 것을 홈에서부터 알린다.
 * 한쪽이 모자라면 다른 쪽이 그 자리를 메우고, 둘 다 0건이면 섹션을 통째로 감춘다 —
 * 홈에 빈 상자를 남기지 않는다. 그래서 섹션 틀(HomeSection: 괘선 + 위 여백)도 홈이 아니라
 * 여기서 두른다. 홈이 감싸면 조각이 없을 때 괘선과 여백만 덩그러니 남는다 —
 * HomeSection 은 자식이 null 을 그리는지 알 수 없다(자식은 늘 '있는' 엘리먼트다).
 *
 * 광장 화면의 무한 쿼리와 캐시를 나눠 쓴다(밑줄 `plazaFeedKey('QUOTE')` vs `PLAZA_HOME_KEY`,
 * 독후감 `postFeedKey` vs `POST_HOME_KEY`). 서로 다른 항목을 담지만 같은 글이 겹칠 수 있어,
 * 좋아요 낙관 업데이트는 quoteCache·postCache 의 patch…Everywhere 가 두 캐시를 함께 손본다.
 *
 * 좋아요·댓글 수는 여기선 표시 전용이다. 홈에서는 누를 수 없고, 무엇이 붐비는지만 알린다.
 *
 * 광장으로 가는 이동은 push 가 아니라 navigate 다 — 구역(서가·탐색·광장·나) 사이는
 * push 하면 오갈 때마다 스택에 같은 구역이 쌓인다.
 *
 * 조각을 누르면 그 글의 상세(app/quote/[id].tsx · app/post/[id].tsx)로 간다 —
 * 스포트라이트에서 잘려 보이던 글을 통째로 읽고 댓글까지 그 자리에서 잇는다.
 * 헤더 '광장 →' 만 광장으로 남는다.
 */
export function HomeScraps() {
  const router = useRouter();
  const { colors } = useTheme();

  const quotes = useQuery({
    queryKey: PLAZA_HOME_KEY,
    queryFn: () => plazaApi.feed('QUOTE', 0, FEED_SIZE),
  });
  const posts = useQuery({
    queryKey: POST_HOME_KEY,
    queryFn: () => postApi.feed('HOT', 0, POST_FEED_SIZE),
  });

  /**
   * 회전 목록 — 양쪽을 각자 핫한 순(좋아요 내림차순, 동률이면 최신순)으로 세운 뒤
   * SLOTS 차례대로 한 장씩 꺼내 끼운다. 제 차례 쪽 후보가 떨어지면 다른 쪽 다음 후보를 당겨 쓴다.
   */
  const spotlight = useMemo<Scrap[]>(() => {
    const hotQuotes = [...(quotes.data?.content ?? [])].sort((a, b) => {
      const hot = (b.agreeCount ?? 0) - (a.agreeCount ?? 0);
      if (hot !== 0) return hot;
      return b.occurredAt.localeCompare(a.occurredAt);
    });
    const hotPosts = [...(posts.data?.content ?? [])].sort((a, b) => {
      const hot = b.likeCount - a.likeCount;
      if (hot !== 0) return hot;
      return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
    });

    let qi = 0;
    let pi = 0;
    const picked: Scrap[] = [];
    for (const slot of SLOTS) {
      // 제 차례 쪽을 먼저 보고, 그쪽이 비었으면 다른 쪽 다음 후보로 자리를 메운다.
      const quoteFirst = slot === 'quote' ? qi < hotQuotes.length : pi >= hotPosts.length;
      if (quoteFirst && qi < hotQuotes.length) picked.push({ kind: 'quote', item: hotQuotes[qi++] });
      else if (pi < hotPosts.length) picked.push({ kind: 'post', item: hotPosts[pi++] });
    }
    return picked;
  }, [quotes.data, posts.data]);

  /**
   * 회전 목록의 신원 — 밑줄·독후감 두 쿼리가 시차를 두고 도착하므로, 같은 turn 에 서 있던
   * 조각이 목록이 바뀌면서 다른 글로 갈린다. 그 교체도 연출을 타야 해서 신원을 정착 애니메이션의
   * 의존성으로 쓴다(quoteId 가 빈 항목은 발생 시각으로 가른다).
   */
  const spotlightId = useMemo(
    () => spotlight
      .map((s) => (s.kind === 'post' ? `post:${s.item.id}` : `quote:${s.item.quoteId ?? s.item.occurredAt}`))
      .join('|'),
    [spotlight],
  );

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
  // 회전(turn)뿐 아니라 목록이 갈릴 때(spotlightId)도 다시 돈다 — 늦게 도착한 쿼리가
  // 화면의 조각을 바꿔 치우는데 연출만 없으면 글자가 툭 튄다. turn 은 그대로 둔다(순서 유지).
  useEffect(() => {
    settle.value = 0;
    settle.value = withTiming(1, { duration: motion.base, easing: EASE_OUT });
  }, [turn, spotlightId, settle]);

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

  const scrap = spotlight[index];
  if (!scrap) return null;

  /** 헤더 '광장 →' — 목적지가 특정 글이 아니라 구역 자체라 navigate 로 연다. */
  const openPlaza = () => router.navigate('/plaza');

  /** 지금 서 있는 조각의 상세로. 종류만 갈리고 누를 자리는 행 하나로 같다. */
  const openScrap = () => {
    if (scrap.kind === 'post') {
      router.push(`/post/${scrap.item.id}`);
      return;
    }
    // 문장 id 가 없는 항목(있어서는 안 되지만 응답이 비었을 때)은 갈 곳이 없으므로
    // 광장으로 보낸다 — 구역 사이라 navigate.
    if (scrap.item.quoteId == null) router.navigate('/plaza');
    else router.push(`/quote/${scrap.item.quoteId}`);
  };

  const scrapLabel =
    scrap.kind === 'post'
      ? `${scrap.item.authorNickname}의 독후감 ${scrap.item.title} · 독후감 상세로`
      : `${scrap.item.authorNickname}가 오려둔 ${scrap.item.bookTitle}의 문장 · 밑줄 상세로`;

  const row = (
    <Animated.View style={[styles.row, groupStyle]}>
      <Animated.View style={[styles.cardSlot, cardStyle]}>
        {scrap.kind === 'quote' ? (
          /* 기울기는 회전 연출과 함께 움직여야 해서 바깥에서 준다. */
          <MemoScrap rotate={0} style={styles.card}>
            <Text numberOfLines={QUOTE_LINES} style={[styles.quote, { color: colors.text }]}>
              {scrap.item.content}
            </Text>
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
              {scrap.item.authorNickname} · {scrap.item.bookTitle}
            </Text>
            {/* 표시 전용 — 홈에서는 누를 수 없다. 토글은 광장에서만.
                0 이어도 그린다: 독후감 조각도 핫 줄을 늘 세우므로, 여기서만 줄을 빼면
                6초마다 조각의 줄 수가 달라져 같은 자리에 선 글의 y 가 흔들린다. */}
            <Text style={[typeScale.monoLabel, styles.hot, { color: colors.accent }]}>
              좋아요 {scrap.item.agreeCount ?? 0}
            </Text>
          </MemoScrap>
        ) : (
          /* onPress 를 주지 않는다 — 누를 자리는 바깥 행 버튼 하나뿐이다(rowWrap 주석 참고). */
          <PostScrap post={scrap.item} rotate={0} variant="home" />
        )}
      </Animated.View>

      {/*
        표지에는 onPress 를 달지 않는다 — 웹에서 accessibilityRole="button" 은 진짜
        <button> 으로 나가므로 조각 버튼과 겹치면 중첩 버튼(잘못된 HTML)이 된다.
        표지를 겨냥한 탭은 바깥 행 버튼이 그대로 받아 그 글의 상세로 보낸다.

        pointerEvents 는 터치만 막고 접근성 트리는 그대로 둔다 — 네이티브 스크린리더가
        표지에서 한 번 더 멈춰 책 제목을 되풀이한다. 세 플랫폼이 각각 다른 속성을 보므로
        (iOS accessibilityElementsHidden · 안드로이드 importantForAccessibility · 웹 aria-hidden)
        셋 다 걸어 가지째 숨긴다. 조각 라벨이 이미 무슨 글인지 읽어 준다.
      */}
      <View
        style={styles.coverSlot}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TiltCover
          uri={scrap.item.bookCoverUrl}
          // 책 없는 독후감은 표지에 세울 책 제목이 없다 — 글 제목으로 대신 채운다.
          title={scrap.kind === 'quote' ? scrap.item.bookTitle : scrap.item.bookTitle ?? scrap.item.title}
          width={COVER_W}
          tilt={2}
          entering={false}
        />
      </View>
    </Animated.View>
  );

  return (
    <HomeSection>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>오려둔 글</Text>
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
            라벨만 현재 항목으로 바뀐다.

            누를 자리는 종류와 무관하게 **행 전체 하나**다. 6초마다 같은 자리에 밑줄과 독후감이
            번갈아 서므로, 한쪽만 카드에 버튼을 달면 표지·카드와 표지 사이 여백·좌우 패딩이
            차례에 따라 눌리기도 하고 안 눌리기도 한다 — 표지를 겨냥한 탭이 무반응이면
            사용자에겐 앱이 먹통으로 읽힌다. 그래서 버튼은 여기 하나로 두고(웹 중첩 <button> 없음)
            목적지와 라벨만 kind 로 가른다. 독후감 조각은 onPress 없이 그림으로만 그려진다. */}
        <Pressable
          onPress={openScrap}
          accessibilityRole="button"
          accessibilityLabel={scrapLabel}
          style={styles.rowWrap}
        >
          {row}
        </Pressable>
      </View>
    </HomeSection>
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
  // 높이를 못 박아 글 길이·회전과 무관하게 아래 행이 그대로 있게 한다.
  row: { flexDirection: 'row', gap: spacing.md, height: ROW_H },
  cardSlot: { flex: 1 },
  // numberOfLines 는 줄 수만 자를 뿐 글자 상자는 못 자른다 — 시스템 글꼴을 크게 키우면
  // 3줄이 ROW_H 를 넘겨 아래 '추천' 행 위로 번진다. 조각 밖으로는 한 픽셀도 내보내지 않는다.
  card: { flex: 1, overflow: 'hidden' },
  // 인용은 제 줄 수만큼만 차지하고 3줄에서 끊긴다(QUOTE_MAX_H 주석 참고).
  quote: { ...typeScale.quote, maxHeight: QUOTE_MAX_H, overflow: 'hidden' },
  // 남는 자리를 인용 아래로 몰아 메타·핫 지표를 조각 바닥에 붙인다 —
  // 문장이 1줄이든 3줄이든 두 줄의 y 가 같아 회전해도 눈이 흔들리지 않는다.
  meta: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: 'auto' },
  hot: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, marginTop: HOT_GAP },
  // 표지(108)는 행(156)보다 낮다 — 가운데에 걸어 위아래 여백을 맞춘다.
  coverSlot: { justifyContent: 'center' },
});
