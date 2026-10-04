import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Eye } from 'lucide-react-native';

import { iconStroke, useTheme } from '@/theme';

/** 눈 아이콘(px) — 모노 메타(10/14) 한 줄 높이 안에 들어가는 크기. */
const EYE_SIZE = 12;

/**
 * 메타 줄의 조회 수 — 눈 아이콘 + 숫자(사용자 결정, CLAUDE.md '사용자 결정으로 둔 예외').
 * 작성자 줄·조각의 모노 메타 한 줄 안에 끼우는 작은 크기다. 카드 발치는 좋아요 하트에 맞춘 큰 눈을 따로 그린다(PostCard).
 * 누를 수 없는 정보라 버튼이 아니다 — 스크린 리더는 '조회 N'으로 읽는다.
 */
export function ViewCount({ count, textStyle }: {
  count: number;
  /** 옆 메타 글자와 같은 조판 — 숫자가 메타와 같은 크기·색으로 읽힌다. */
  textStyle: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`조회 ${count}`} style={styles.row}>
      <Eye size={EYE_SIZE} color={colors.textFaint} {...iconStroke} />
      <Text style={textStyle}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 아이콘과 숫자는 한 덩어리 — 광학 보정 3px 만 띄운다.
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
