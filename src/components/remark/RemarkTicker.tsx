import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Remark } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { SectionHeader, formatRelative } from '@/components/ui';
import { useScreenReaderEnabled } from '@/hooks/useScreenReaderEnabled';
import { motion, pressedStyle, spacing, typeScale, useTheme } from '@/theme';
import { serif, statusLabel } from '@/theme/tokens';

import { useBookRemarks } from './queries';

/** 한 장이 머무는 시간 — 한 마디는 짧아 홈 '오늘의 글'(6초)보다 조금 빨리 넘긴다. */
const ROTATE_MS = 5000;
/** 새 한 마디가 놓일 때 아래에서 올라오는 거리(px) — 오늘의 글보다 작게, 글자만 바뀌는 느낌으로. */
const ENTER_RISE = 6;
const EASE_OUT = Easing.out(Easing.quad);

/**
 * 독자들의 한 마디 — 이 책을 다 읽었거나(완독) 내려놓으며(하차) 남긴 한 줄을 최신순으로 한 장씩 돌린다.
 *
 * 홈 '오늘의 글'과 같은 연출 — 나가는 장을 빠르게 지우고 다음 장이 살짝 올라오며 놓인다. 누르면 바로 다음 장으로
 * 넘어가고 시계도 다시 잰다. 한 장뿐이면 돌리지 않고, 0건이면 섹션을 통째로 감춘다.
 *
 * 한 마디마다 길이가 달라 그대로 바꿔 끼우면 5초마다 아래 섹션이 들썩인다. 그래서 모든 한 마디를 보이지 않게
 * 같은 폭으로 한 번씩 그려 재고, 가장 긴 것의 높이를 자리로 잡아 둔다(글자 크기를 키워도 다시 잰다).
 * 짧은 한 마디 밑이 비어 보이지 않게 글은 위에, 남긴 사람 줄은 메모 바닥에 붙인다 — 서명 자리가 장마다 같다.
 *
 * 스크린리더가 켜져 있으면 돌리지 않는다 — 읽는 도중에 글이 바뀌면 안 된다. 눌러서 넘기는 길은 그대로 둔다.
 */
export function RemarkTicker({ bookId }: { bookId: number }) {
  const { colors } = useTheme();
  const remarks = useBookRemarks(bookId);
  const items = remarks.data ?? [];
  const count = items.length;
  // 목록의 신원 — 다시 받아 온 목록이 달라지면(방금 내가 남긴 한 마디 등) 가장 최근 것부터 다시 돈다.
  const listId = items.map((remark) => `${remark.id}:${remark.writtenAt}`).join('|');

  const [turn, setTurn] = useState(0);
  const advance = useCallback(() => setTurn((t) => t + 1), []);
  useEffect(() => setTurn(0), [listId]);

  const screenReader = useScreenReaderEnabled();
  const reduceMotion = useReducedMotion();

  /** 0 → 1 로 자리를 잡고, 다음 장으로 넘어갈 땐 1 → 0 으로 지워진다. */
  const settle = useSharedValue(1);
  const rotating = count > 1 && !screenReader;

  // 장마다 시계를 새로 건다 — 눌러서 넘긴 뒤에도 그 장이 온전히 5초 머문다.
  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => {
      if (reduceMotion) { advance(); return; }
      settle.value = withTiming(0, { duration: motion.fast, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(advance)();
      });
    }, ROTATE_MS);
    return () => {
      clearTimeout(timer);
      // 나가는 페이드 도중에 정리되면 완료 콜백이 주인 없이 발화한다 — 애니메이션을 먼저 끊고 정착 상태로 되돌린다.
      cancelAnimation(settle);
      settle.value = 1;
    };
  }, [rotating, turn, listId, reduceMotion, advance, settle]);

  // 새 장이 놓이는 연출 — 넘길 때와 목록이 갈릴 때 다시 돈다.
  useEffect(() => {
    if (reduceMotion) { settle.value = 1; return; }
    settle.value = 0;
    settle.value = withTiming(1, { duration: motion.base, easing: EASE_OUT });
  }, [turn, listId, reduceMotion, settle]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateY: (1 - settle.value) * ENTER_RISE }],
  }));

  // 한 마디별 실측 높이 — 가장 긴 것이 자리 높이가 된다.
  const [heights, setHeights] = useState<Record<number, number>>({});
  const measure = (id: number, height: number) => {
    const next = Math.ceil(height);
    setHeights((prev) => (prev[id] === next ? prev : { ...prev, [id]: next }));
  };
  const slotH = items.reduce((max, remark) => Math.max(max, heights[remark.id] ?? 0), 0);

  const index = count > 0 ? turn % count : 0;
  const remark = items[index];
  if (!remark) return null;

  return (
    <View>
      <SectionHeader
        title="독자들의 한 마디"
        action={count > 1 ? (
          <Text style={[typeScale.monoNumeral, { color: colors.textFaint }]}>{index + 1} / {count}</Text>
        ) : undefined}
      />
      <Pressable
        onPress={count > 1 ? advance : undefined}
        disabled={count < 2}
        accessibilityRole={count > 1 ? 'button' : undefined}
        accessibilityLabel={`${remark.authorNickname} · ${statusLabel[remark.kind]} · ${remark.body}`}
        accessibilityHint={count > 1 ? '누르면 다음 한 마디로 넘어가요' : undefined}
        style={({ pressed }) => (pressed && count > 1 ? pressedStyle : null)}
      >
        <MemoScrap rotate={-1}>
          <View style={{ minHeight: slotH }}>
            <Animated.View style={[styles.fill, enterStyle]}>
              <RemarkLine remark={remark} fill />
            </Animated.View>

            {/* 재기만 하는 층 — 보이지도, 눌리지도, 읽히지도 않는다(세 플랫폼이 보는 속성을 모두 건다). */}
            <View
              style={styles.measurer}
              pointerEvents="none"
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {items.map((item) => (
                <View
                  key={item.id}
                  style={styles.measureItem}
                  onLayout={(e) => measure(item.id, e.nativeEvent.layout.height)}
                >
                  <RemarkLine remark={item} />
                </View>
              ))}
            </View>
          </View>
        </MemoScrap>
      </Pressable>
    </View>
  );
}

/** 한 마디 한 장 — 따옴표 친 한 줄과, 누가 다 읽고/내려놓으며 남겼는지. fill 이면 자리를 채워 서명 줄을 바닥에 붙인다. */
function RemarkLine({ remark, fill }: { remark: Remark; fill?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.line, fill && styles.lineFill]}>
      <Text style={[styles.body, { color: colors.text }]}>“{remark.body}”</Text>
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[typeScale.label, styles.author, { color: colors.textMuted }]}>
          {remark.authorNickname}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          · {statusLabel[remark.kind]} · {formatRelative(remark.writtenAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
  line: { gap: spacing.sm },
  lineFill: { flexGrow: 1, justifyContent: 'space-between' },
  body: { fontFamily: serif.regular, fontSize: 16, lineHeight: 26 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  author: { flexShrink: 1 },
  measurer: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  measureItem: { position: 'absolute', top: 0, left: 0, right: 0 },
});
