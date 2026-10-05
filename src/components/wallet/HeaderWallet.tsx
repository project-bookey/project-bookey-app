import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Plus } from 'lucide-react-native';

import { walletApi } from '@/api/endpoints';
import { ICON_SIZE, IconButton } from '@/components/collage/IconButton';
import { WalletIcon } from '@/components/collage/WalletIcon';
import { useTourTarget } from '@/components/tour/TourTarget';
import { Button, Eyebrow, TextLink } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

import { WalletBalances } from './WalletBalances';

/** 카드가 커지는·접히는 시간 — 클럽 ＋ 메뉴와 같다. */
const OPEN_MS = 220;
const CLOSE_MS = 140;
/** 카드 폭 — 좁은 화면에선 좌우 여백 안으로 줄인다. */
const CARD_WIDTH = 280;
/** 다 펼치기 전 카드 크기 — 아이콘만 하던 것이 커지는 것처럼 보이게 작게 시작한다. */
const START_SCALE = 0.3;

type Anchor = { x: number; y: number; width: number; height: number };
type Destination = '/wallet' | '/bookmarks';

/**
 * 헤더 오른쪽 위 지갑 — 아이콘 하나로 두고, 누르면 그 자리에서 카드가 커지며 책갈피 · 엽서 · 우표를 보여 준다
 * (2026-10-05 사용자 결정 A안 — 책갈피 칩을 대신한다). 카드에는 '지갑 ›'과 '책갈피 구매'를 둔다.
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
              <Eyebrow>내가 가진 것</Eyebrow>
              {wallet.isError && !wallet.data ? (
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
              ) : (
                <WalletBalances wallet={wallet.data} style={styles.balances} />
              )}
              <View style={styles.foot}>
                <TextLink label="지갑" onPress={() => go('/wallet')} accessibilityLabel="지갑 열기" />
                <Button label="책갈피 구매" icon={Plus} variant="outline" size="sm" onPress={() => go('/bookmarks')} />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  balances: { marginTop: spacing.md },
  errorRow: { marginTop: spacing.sm, gap: spacing.xs },
  retry: { alignSelf: 'flex-start' },
  foot: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
