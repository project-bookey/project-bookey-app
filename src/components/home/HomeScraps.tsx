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
import type { PlazaItem, Post } from '@/api/types';
import { TiltCover } from '@/components/collage';
import { FinishScrap } from '@/components/home/FinishScrap';
import { HomeSection } from '@/components/home/HomeSection';
import { PostScrap } from '@/components/post/PostScrap';
import { motion, spacing, typeScale, useTheme } from '@/theme';
import { TextLink } from '@/components/ui';

/** 스포트라이트에 세우는 독후감 수 — 6초마다 한 장씩 돌린다. */
const FEED_SIZE = 5;
/** 독후감 사이사이에 끼우는 완독 자랑 수 — 최근에 다 읽은 순. */
const FINISH_SIZE = 5;
/**
 * '오늘의 글' 완독 자랑 몫의 캐시 키 — ['plaza'] 아래라 한 줄평을 남기거나 지우면(remark/queries)
 * 함께 새로 받는다. 홈 당겨서 새로고침도 이 키를 본다.
 */
export const FINISH_HOME_KEY = ['plaza', 'home'] as const;
/** 회전 간격(ms). */
const ROTATE_MS = 6000;
/** 표지 스크랩 폭(px) — 시안 2a 의 78px 자리. */
const COVER_W = 72;
/** 표지 높이(px) — TiltCover 가 폭의 1.5배로 그린다. 글 조각도 이 높이에 맞춰 선다. */
const COVER_H = Math.round(COVER_W * 1.5);
// 작성자 행·글 상자 조판(AUTHOR_*·QUOTE_MAX_H)은 독후감 조각(PostScrap 의 home)이 쓰는 값이라
// scrapMetrics 한 곳에 있다.

/**
 * 행 고정 높이(px) — **표지와 같은 108**.
 *
 * 회전할 때 아래 행들이 밀리면 안 되므로 minHeight 가 아니라 높이를 못 박는다.
 * minHeight 만 주면 제목이 긴 항목에서 카드가 그 값을 넘겨 행이 커지고, 짧은 항목으로
 * 넘어가는 순간 홈 전체가 출렁인다.
 *
 * 값은 계산이 아니라 COVER_H 다 — 글 조각이 옆 표지보다 훨씬 커서 어색하다는
 * 피드백(2026-09-08)으로 표지 높이에 맞췄다. 그 108 을 안에서 이렇게 나눠 쓴다:
 *
 *   스크랩 테두리 1×2 + 안쪽 여백 12×2  = 26
 *   작성자 행 44 + 아래 간격 8          = 52
 *   글 상자(독후감 제목 1줄)            = 28
 *                                     합 = 106  (남는 2px 은 글꼴 폴백 여유)
 *
 * 작성자 행이나 글 상자를 키우려면 scrapMetrics 를 고치되 이 셈이 108 을 넘지 않아야 한다 —
 * 넘으면 조각 안에서 글이 소리 없이 잘린다(글 상자마다 overflow:hidden 이 걸려 있다).
 */
const ROW_H = COVER_H;
/** 들어오는 조각이 올라오는 거리(px) — 책상에 내려놓는 듯한 짧은 낙차. */
const ENTER_RISE = 8;
/** 카드 기울기(도) — 회전 항목마다 좌우로 엇갈린다. */
const CARD_TILT = [-1.2, 1];

const EASE_OUT = Easing.out(Easing.quad);

/** 스포트라이트 한 장 — 독후감이거나 완독 자랑이다. */
type Spot = { kind: 'post'; post: Post } | { kind: 'finish'; item: PlazaItem };

/** 신원 — 완독 자랑에는 id 가 없어 사람·책·시각 조합으로 가른다. */
function spotKey(spot: Spot): string {
  return spot.kind === 'post'
    ? `p${spot.post.id}`
    : `f${spot.item.authorId}-${spot.item.bookId}-${spot.item.occurredAt}`;
}

/** 독후감과 완독 자랑을 한 장씩 번갈아 세운다 — 한쪽이 모자라면 남은 쪽이 이어서 선다. */
function interleave(posts: Post[], finishes: PlazaItem[]): Spot[] {
  const spots: Spot[] = [];
  for (let i = 0; i < Math.max(posts.length, finishes.length); i++) {
    if (i < posts.length) spots.push({ kind: 'post', post: posts[i] });
    if (i < finishes.length) spots.push({ kind: 'finish', item: finishes[i] });
  }
  return spots;
}

/**
 * 홈 히어로 바로 아래('지금 붐비는 책' 위) '오늘의 글' — 광장의 독후감 중 핫한 것과 최근 완독 자랑을
 * 번갈아 한 장씩 스포트라이트로 세우고 6초마다 돌린다 (시안 2a: 글 카드 + 표지 스크랩 한 쌍).
 * 완독 자랑은 광장 탭에서 여기로 옮겼다 — 광장은 독후감만 보여 준다(사용자 결정 2026-10-05).
 *
 * 조각 머리에는 작성자 아바타·닉네임을 세운다(PostScrap 의 home · FinishScrap) — 누구의 글인지가 먼저 읽히게.
 * 둘 다 0건이면 섹션을 통째로 감춘다 — 홈에 빈 상자를 남기지 않는다. 그래서 섹션 틀(HomeSection: 괘선 + 위 여백)도
 * 홈이 아니라 여기서 두른다. 홈이 감싸면 조각이 없을 때 괘선과 여백만 덩그러니 남는다 —
 * HomeSection 은 자식이 null 을 그리는지 알 수 없다(자식은 늘 '있는' 엘리먼트다).
 *
 * 광장 화면의 무한 쿼리와 캐시를 나눠 쓴다(`postFeedKey` vs `POST_HOME_KEY`). 같은 글이 겹칠 수 있어
 * 좋아요 낙관 업데이트는 postCache 의 patch…Everywhere 가 두 캐시를 함께 손본다.
 *
 * 좋아요 수는 여기선 표시 전용이다. 홈에서는 누를 수 없고, 무엇이 붐비는지만 알린다.
 *
 * 광장으로 가는 이동은 push 가 아니라 navigate 다 — 구역(서가·탐색·광장·나) 사이는
 * push 하면 오갈 때마다 스택에 같은 구역이 쌓인다.
 *
 * 독후감 조각을 누르면 그 독후감의 상세(app/post/[id].tsx)로 간다 — 스포트라이트에서 잘려 보이던 글을
 * 통째로 읽는다. 완독 조각은 그 책의 상세로 간다. 헤더 '광장 →' 만 광장으로 남는다.
 */
export function HomeScraps() {
  const router = useRouter();
  const { colors } = useTheme();

  const posts = useQuery({
    queryKey: POST_HOME_KEY,
    queryFn: () => postApi.feed('HOT', 0, FEED_SIZE),
  });
  const finishes = useQuery({
    queryKey: FINISH_HOME_KEY,
    queryFn: () => plazaApi.feed('FINISH', 0, FINISH_SIZE),
  });

  /**
   * 회전 목록 — 독후감은 핫한 순(좋아요 내림차순, 동률이면 최신순), 완독 자랑은 서버가 준 최신순.
   * 한쪽 쿼리가 실패해도 다른 쪽만으로 선다.
   */
  const spotlight = useMemo<Spot[]>(() => {
    const hotPosts = [...(posts.data?.content ?? [])].sort((a, b) => {
      const hot = b.likeCount - a.likeCount;
      if (hot !== 0) return hot;
      return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
    });
    return interleave(hotPosts, finishes.data?.content ?? []);
  }, [posts.data, finishes.data]);

  /**
   * 회전 목록의 신원 — 다시 받아 온 목록이 달라지면 같은 turn 에 서 있던 조각이 다른 글로 갈린다.
   * 그 교체도 연출을 타야 해서 신원을 정착 애니메이션의 의존성으로 쓴다.
   */
  const spotlightId = useMemo(() => spotlight.map(spotKey).join('|'), [spotlight]);

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
  // 회전(turn)뿐 아니라 목록이 갈릴 때(spotlightId)도 다시 돈다 — 다시 받아 온 목록이
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

  const spot = spotlight[index];
  if (!spot) return null;

  // 표지·누를 곳·라벨 — 독후감은 그 글의 상세로, 완독 자랑은 그 책의 상세로.
  const cover = spot.kind === 'post'
    // 책 없는 독후감은 표지에 세울 책 제목이 없다 — 글 제목으로 대신 채운다.
    ? { uri: spot.post.bookCoverUrl, title: spot.post.bookTitle ?? spot.post.title }
    : { uri: spot.item.bookCoverUrl, title: spot.item.bookTitle };
  const openSpot = () => router.push(
    spot.kind === 'post' ? `/post/${spot.post.id}` : `/book/${spot.item.bookId}`,
  );
  const spotLabel = spot.kind === 'post'
    ? `${spot.post.authorNickname}의 독후감 ${spot.post.title} · 독후감 상세로`
    : `${spot.item.authorNickname}의 완독 ${spot.item.bookTitle} · 도서 상세로`;

  /** 헤더 '광장 →' — 목적지가 특정 글이 아니라 구역 자체라 navigate 로 연다. */
  const openPlaza = () => router.navigate('/plaza');

  const row = (
    <Animated.View style={[styles.row, groupStyle]}>
      <Animated.View style={[styles.cardSlot, cardStyle]}>
        {/* onPress 를 주지 않는다 — 누를 자리는 바깥 행 버튼 하나뿐이다(rowWrap 주석 참고).
            기울기는 회전 연출과 함께 움직여야 해서 바깥에서 준다. */}
        {spot.kind === 'post'
          ? <PostScrap post={spot.post} rotate={0} variant="home" />
          : <FinishScrap item={spot.item} />}
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
          uri={cover.uri}
          title={cover.title}
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
          <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>오늘의 글</Text>
          <TextLink label="광장" onPress={openPlaza} accessibilityLabel="광장으로" />
        </View>

        {/* 자동 회전은 스크린리더를 시끄럽게 하지 않는다 — liveRegion 을 걸지 않고
            라벨만 현재 항목으로 바뀐다.

            누를 자리는 **행 전체 하나**다 — 조각에만 버튼을 달면 표지·카드와 표지 사이 여백·좌우 패딩은
            눌리지 않아, 표지를 겨냥한 탭이 무반응이면 사용자에겐 앱이 먹통으로 읽힌다.
            그래서 버튼은 여기 하나로 두고(웹 중첩 <button> 없음) 조각은 onPress 없이 그림으로만 그려진다. */}
        <Pressable
          onPress={openSpot}
          accessibilityRole="button"
          accessibilityLabel={spotLabel}
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
  // 표지와 행 높이가 같다(ROW_H = COVER_H) — 그래도 가운데 걸기는 남긴다.
  // 표지가 폭의 1.5배에서 반올림되는 자리라 1px 어긋나도 위아래가 갈리지 않게.
  coverSlot: { justifyContent: 'center' },
});
