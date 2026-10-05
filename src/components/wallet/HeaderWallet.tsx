import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from '@/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Mail, Plus } from 'lucide-react-native';

import { walletApi } from '@/api/endpoints';
import { BookmarkIcon } from '@/components/collage/BookmarkIcon';
import { ICON_SIZE, IconButton } from '@/components/collage/IconButton';
import { StampIcon } from '@/components/collage/StampIcon';
import { WalletIcon } from '@/components/collage/WalletIcon';
import { freePostcardsTag } from '@/components/social/PostcardWalletLine';
import { useTourTarget } from '@/components/tour/TourTarget';
import { TextLink } from '@/components/ui';
import {
  controlFace, controlHeight, hairline, iconSize, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme,
} from '@/theme';

/** 카드가 커지는·접히는 시간 — 클럽 ＋ 메뉴와 같다. */
const OPEN_MS = 220;
const CLOSE_MS = 140;
/** 카드 폭 — 좁은 화면에선 좌우 여백 안으로 줄인다. */
const CARD_WIDTH = 280;
/** 다 펼치기 전 카드 크기 — 아이콘만 하던 것이 커지는 것처럼 보이게 작게 시작한다. */
const START_SCALE = 0.3;
/** 윗줄 책갈피 아이콘 · 아랫줄 엽서 · 우표 아이콘(px). */
const MAIN_ICON = 20;
const MINOR_ICON = 16;
/** 책갈피 추가 단추(32pt)를 위아래로 넓혀 44pt 터치 상자로 — 공용 작은 버튼과 같다. */
const ADD_HIT_SLOP = { top: (44 - controlHeight.sm) / 2, bottom: (44 - controlHeight.sm) / 2 };

type Anchor = { x: number; y: number; width: number; height: number };
type Destination = '/wallet' | '/bookmarks';

/**
 * 헤더 오른쪽 위 지갑 — 아이콘 하나로 두고, 누르면 그 자리에서 카드가 커지며 책갈피 · 엽서 · 우표를 보여 준다
 * (2026-10-05 사용자 결정 A안 — 책갈피 칩을 대신한다). 카드 안은 배치 시안 C안(사용자 결정): 윗줄에 책갈피 숫자와
 * 그 바로 옆 초록 '＋책갈피' 단추(글자 없이 아이콘 둘 — 무엇을 더하는지 가까이 둬서 읽히게), 아랫줄에 엽서('+n 무료'를 숫자 옆에)
 * · 우표와 그 끝의 '지갑 ›'. 제목('내가 가진 것')은 두지 않는다.
 * 화면 전체를 덮어야 하므로(하단 바까지 클럽 ＋ 메뉴와 같은 회색 덮개) RN Modal 에 그리고, 아이콘 자리는 열 때
 * measureInWindow 로 잰다. 덮개 위에 같은 자리에 아이콘을 다시 그려 '여기서 열렸다'가 보이고, 그 아이콘·덮개·뒤로 가기로 닫힌다.
 */
export function HeaderWallet() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const bookmarks = wallet.data?.bookmarkBalance ?? 0;
  const postcards = wallet.data?.postcardBalance ?? 0;
  const freeToday = wallet.data?.freePostcardsLeftToday ?? 0;
  const free = freePostcardsTag(freeToday);
  const stamps = wallet.data?.stampBalance ?? 0;

  const tourRef = useTourTarget('header-wallet');
  const anchorRef = useRef<View | null>(null);
  const setAnchorNode = useCallback((node: View | null) => {
    anchorRef.current = node;
    tourRef(node);
  }, [tourRef]);

  /** 열린 동안 아이콘 자리 — null 이면 닫혀 있다. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  const open = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    // 다른 화면에서 쓰거나 산 만큼 맞춘다 — 열면서 새로 받는다.
    void wallet.refetch();
  };
  useEffect(() => {
    if (!anchor) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anchor, anim]);
  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: CLOSE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => {
        if (finished) setAnchor(null);
      });
  };
  // 알림을 눌러 다른 화면이 덮는 등 이 구역 화면이 가려지면 열린 채 남지 않게 걷는다.
  useEffect(() => {
    if (!isFocused) setAnchor(null);
  }, [isFocused]);

  // 다른 화면으로 갈 땐 카드를 바로 걷고, 다 닫힌 뒤 넘긴다 — 모달을 띄운 채 넘기면 닫힘과 화면 전환이 엇갈린다.
  // iOS 는 Modal onDismiss 와 아래 시간 중 먼저 온 쪽, Android·웹은 다음 프레임(FinishCardSheet 와 같다).
  const leaveTo = useRef<Destination | null>(null);
  const [leaving, setLeaving] = useState(false);
  const finishLeaving = useCallback(() => {
    const destination = leaveTo.current;
    if (!destination) return;
    leaveTo.current = null;
    setLeaving(false);
    router.push(destination);
  }, [router]);
  useEffect(() => {
    if (!leaving) return undefined;
    if (Platform.OS !== 'ios') {
      const frame = requestAnimationFrame(finishLeaving);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(finishLeaving, 350);
    return () => clearTimeout(timer);
  }, [leaving, finishLeaving]);
  const go = (destination: Destination) => {
    leaveTo.current = destination;
    setAnchor(null);
    setLeaving(true);
  };

  const cardWidth = Math.min(CARD_WIDTH, windowWidth - spacing.lg * 2);
  const cardLeft = windowWidth - spacing.lg - cardWidth;
  const cardTop = anchor ? anchor.y + anchor.height + spacing.xs : 0;
  // 카드는 아이콘 가운데에서 커진다.
  const origin = anchor ? [anchor.x + anchor.width / 2 - cardLeft, anchor.y + anchor.height / 2 - cardTop, 0] : undefined;

  return (
    <>
      <View ref={setAnchorNode} collapsable={false}>
        <IconButton onPress={open} accessibilityLabel={`지갑, 책갈피 ${bookmarks}개`}>
          <WalletIcon size={ICON_SIZE} color={colors.text} />
        </IconButton>
      </View>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
        onDismiss={finishLeaving}
      >
        {anchor ? (
          <View style={styles.fill}>
            <Pressable style={styles.fill} onPress={close} accessibilityRole="button" accessibilityLabel="지갑 닫기">
              <Animated.View style={[styles.fill, { backgroundColor: colors.scrimMenu, opacity: anim }]} />
            </Pressable>
            <View style={[styles.lifted, { left: anchor.x, top: anchor.y }]}>
              <IconButton onPress={close} accessibilityLabel="지갑 닫기">
                <WalletIcon size={ICON_SIZE} color={colors.text} />
              </IconButton>
            </View>
            <Animated.View
              style={[
                styles.card,
                {
                  top: cardTop,
                  left: cardLeft,
                  width: cardWidth,
                  backgroundColor: colors.surface,
                  borderColor: colors.lineStrong,
                  opacity: anim,
                  transformOrigin: origin,
                  transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] }) }],
                },
              ]}
            >
              {wallet.isError && !wallet.data ? (
                <>
                  <View style={styles.errorRow}>
                    <Text style={[typeScale.body, { color: colors.textMuted }]}>지갑을 불러오지 못했어요.</Text>
                    <TextLink
                      label="다시 시도"
                      kind="action"
                      onPress={() => wallet.refetch()}
                      accessibilityLabel="지갑 다시 불러오기"
                      style={styles.retry}
                    />
                  </View>
                  <View style={[styles.row, styles.secondRow]}>
                    <TextLink label="지갑" onPress={() => go('/wallet')} accessibilityLabel="지갑 열기" />
                    <AddBookmarks onPress={() => go('/bookmarks')} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.row}>
                    <View accessible accessibilityLabel={`책갈피 ${bookmarks}개`} style={styles.item}>
                      <BookmarkIcon size={MAIN_ICON} color={colors.textMuted} />
                      <Text style={[styles.mainValue, { color: colors.text }]}>{bookmarks}</Text>
                    </View>
                    <AddBookmarks onPress={() => go('/bookmarks')} />
                  </View>
                  <View style={[styles.row, styles.secondRow]}>
                    <View style={styles.minors}>
                      <View
                        accessible
                        accessibilityLabel={`엽서 ${postcards}장, 오늘 무료 ${freeToday}장`}
                        style={styles.item}
                      >
                        <Mail size={MINOR_ICON} color={colors.textMuted} {...iconStroke} />
                        {/* 숫자와 '+n 무료'는 글자 바닥선을 맞춘다. */}
                        <View style={styles.valueLine}>
                          <Text style={[styles.minorValue, { color: colors.text }]}>{postcards}</Text>
                          {free ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>{free}</Text> : null}
                        </View>
                      </View>
                      <View accessible accessibilityLabel={`우표 ${stamps}개`} style={styles.item}>
                        <StampIcon size={MINOR_ICON} color={colors.textMuted} />
                        <Text style={[styles.minorValue, { color: colors.text }]}>{stamps}</Text>
                      </View>
                    </View>
                    <TextLink label="지갑" onPress={() => go('/wallet')} accessibilityLabel="지갑 열기" />
                  </View>
                </>
              )}
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

/**
 * 책갈피 추가 — 초록 작은 단추에 ＋와 책갈피 아이콘만(사용자 결정 2026-10-05, 글자 없이). 공용 Button 은 아이콘을 하나만
 * 받아서 같은 겉모습(32pt · control 모서리 · 평평한 초록 면)으로 직접 그린다. 스크린 리더는 '책갈피 추가'로 읽는다.
 */
function AddBookmarks({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={ADD_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="책갈피 추가"
      style={({ pressed }) => [styles.add, controlFace(colors.accent), pressed && pressedStyle]}
    >
      <Plus size={14} color={colors.onAccent} {...iconStroke} />
      <BookmarkIcon size={iconSize.inline} color={colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  lifted: { position: 'absolute' },
  // 시트와 같은 각진 종이 — 테두리만, 그림자 없음.
  card: {
    position: 'absolute',
    borderWidth: hairline,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondRow: { marginTop: spacing.sm },
  // 아랫줄 엽서 · 우표 — 덩어리 사이는 간격으로만 가른다.
  minors: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  // 아이콘과 숫자는 한 덩어리 — 광학 보정 6px.
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // 숫자 옆 '+n 무료'는 숫자와 한 덩어리 — 광학 보정 4px.
  valueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  mainValue: { ...typeScale.monoNumeral, fontSize: 24, lineHeight: 30 },
  minorValue: { ...typeScale.monoNumeral, fontSize: 17, lineHeight: 22 },
  // 공용 작은 버튼(buttonSm)과 같은 겉모습 — ＋와 책갈피는 한 덩어리로 붙인다(광학 보정 2px).
  add: {
    minHeight: controlHeight.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  errorRow: { gap: spacing.xs },
  retry: { alignSelf: 'flex-start' },
});
