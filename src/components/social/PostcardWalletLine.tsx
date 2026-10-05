import { StyleSheet, Text, View } from 'react-native';
import { Mail } from 'lucide-react-native';

import { StampIcon } from '@/components/collage';
import { iconSize, iconStroke, spacing, typeScale, useTheme } from '@/theme';

/**
 * 오늘 남은 무료 엽서 — 보유 엽서 숫자 옆·아래에 붙이는 '+n 무료'(2026-10-05 사용자 결정, 무료 엽서 표시 A안).
 * 무료 엽서는 따로 칸을 두지 않고 엽서에 합친다. 0장이면 붙이지 않는다(null). 나 화면 지갑 카드·지갑 화면·이 줄이 같은 말을 쓴다.
 */
export function freePostcardsTag(freeToday: number): string | null {
  return freeToday > 0 ? `+${freeToday} 무료` : null;
}

/**
 * 엽서 잔액 한 줄 — 봉투 + 보유 엽서 수 + '+n 무료' · 우표 + 우표 수(2026-10-05 사용자 결정 — 단어 + 숫자를 아이콘 + 숫자로).
 * 엽서 목록 머리와 엽서 쓰기 칸 아래가 같이 쓴다(쓰기 칸은 우표를 빼고).
 * 누를 수 없는 정보라 한 덩어리로 읽힌다 — 스크린 리더는 원래 문장('보유 엽서 12장, 오늘 무료 엽서 5장, 우표 23개')으로 읽는다.
 */
export function PostcardWalletLine({ freeToday, postcards, stamps }: {
  freeToday: number;
  postcards: number;
  /** 없으면 우표 칸을 그리지 않는다. */
  stamps?: number;
}) {
  const { colors } = useTheme();
  const tint = colors.textFaint;
  const free = freePostcardsTag(freeToday);
  const label = `보유 엽서 ${postcards}장, 오늘 무료 엽서 ${freeToday}장${stamps != null ? `, 우표 ${stamps}개` : ''}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.row}>
      <View style={styles.item}>
        <Mail size={iconSize.meta + 1} color={tint} {...iconStroke} />
        <Text style={[typeScale.caption, { color: tint }]}>{postcards}</Text>
        {free ? <Text style={[typeScale.caption, styles.free, { color: tint }]}>{free}</Text> : null}
      </View>
      {stamps != null ? (
        <View style={styles.item}>
          <StampIcon size={iconSize.meta + 2} color={tint} />
          <Text style={[typeScale.caption, { color: tint }]}>{stamps}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 덩어리 사이는 간격으로만 가른다(가운뎃점 없음). 좁으면 다음 줄로 넘어간다.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xs },
  // 아이콘과 숫자는 한 덩어리 — 광학 보정 3px.
  item: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // '+n 무료'는 보유 숫자와 한 칸 띄운다.
  free: { marginLeft: 3 },
});
