import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Mail } from 'lucide-react-native';

import type { WalletView } from '@/api/types';
// 배럴(@/components/collage)이 아니라 파일에서 바로 — 배럴의 BrandHeader 가 이 파일을 쓰므로 순환을 피한다.
import { BookmarkIcon } from '@/components/collage/BookmarkIcon';
import { StampIcon } from '@/components/collage/StampIcon';
import { freePostcardsTag } from '@/components/social/PostcardWalletLine';
import { iconStroke, spacing, typeScale, useTheme } from '@/theme';

/** 보유 칸 아이콘(px). */
const BALANCE_ICON = 18;

/**
 * 보유 세 칸 — 책갈피 · 엽서('+n 무료') · 우표를 아이콘 + 숫자로(2026-10-05 사용자 결정).
 * 지갑 화면이 쓴다(헤더 지갑 카드는 책갈피를 윗줄에 따로 두는 배치라 직접 그린다). 스크린 리더는 칸마다 원래 말로 읽는다.
 */
export function WalletBalances({ wallet, style }: { wallet: WalletView | undefined; style?: ViewStyle }) {
  const { colors } = useTheme();
  const bookmarks = wallet?.bookmarkBalance ?? 0;
  const postcards = wallet?.postcardBalance ?? 0;
  const freeToday = wallet?.freePostcardsLeftToday ?? 0;
  const stamps = wallet?.stampBalance ?? 0;
  return (
    <View style={[styles.balances, style]}>
      <Balance
        icon={<BookmarkIcon size={BALANCE_ICON} color={colors.textMuted} />}
        value={bookmarks}
        accessibilityLabel={`책갈피 ${bookmarks}개`}
      />
      <Balance
        icon={<Mail size={BALANCE_ICON} color={colors.textMuted} {...iconStroke} />}
        value={postcards}
        sub={freePostcardsTag(freeToday)}
        accessibilityLabel={`엽서 ${postcards}장, 오늘 무료 ${freeToday}장`}
      />
      <Balance
        icon={<StampIcon size={BALANCE_ICON} color={colors.textMuted} />}
        value={stamps}
        accessibilityLabel={`우표 ${stamps}개`}
      />
    </View>
  );
}

/** 보유 한 칸 — 아이콘 + 숫자, 엽서만 아래에 '+n 무료'(0장이면 없음). */
function Balance({ icon, value, sub, accessibilityLabel }: {
  icon: ReactNode;
  value: number;
  sub?: string | null;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.balance}>
      <View style={styles.balanceTop}>
        {icon}
        <Text style={[styles.balanceValue, { color: colors.text }]}>{value}</Text>
      </View>
      {sub ? <Text style={[typeScale.caption, { color: colors.textFaint }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 보유 세 칸 — 간격으로만 가른다(구분선 없음).
  balances: { flexDirection: 'row', gap: spacing.sm },
  balance: { flex: 1, gap: 2 },
  // 아이콘과 숫자는 한 덩어리 — 광학 보정 6px.
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceValue: { ...typeScale.monoNumeral, fontSize: 20, lineHeight: 26 },
});
