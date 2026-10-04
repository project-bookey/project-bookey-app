import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Heart } from 'lucide-react-native';

import { iconStroke, useTheme } from '@/theme';

/** 하트 아이콘(px) — 모노 메타(10/14) 한 줄 높이 안에 들어가는 크기. 옆 ViewCount 의 눈과 같다. */
const HEART_SIZE = 12;

/**
 * 메타 줄의 좋아요 수 — 하트 아이콘 + 숫자. 좋아요는 앱 어디서나 하트로 그린다(누르는 자리는 LikeAction).
 * 홈 조각·도서 상세 조각·나의 독후감 목록처럼 표시만 하는 메타 한 줄에 끼우는 작은 크기다.
 * 누를 수 없는 정보라 버튼이 아니다 — 스크린 리더는 '좋아요 N'으로 읽는다.
 */
export function LikeCount({ count, textStyle, color }: {
  count: number;
  /** 옆 메타 글자와 같은 조판 — 숫자가 메타와 같은 크기·색으로 읽힌다. */
  textStyle: StyleProp<TextStyle>;
  /** 하트 색 — 숫자 색에 맞춘다. 없으면 메타 기본색(textFaint). */
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`좋아요 ${count}`} style={styles.row}>
      <Heart size={HEART_SIZE} color={color ?? colors.textFaint} {...iconStroke} />
      <Text style={textStyle}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 아이콘과 숫자는 한 덩어리 — 광학 보정 3px 만 띄운다. 메타 줄이 좁아도 숫자는 줄어들지 않는다.
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
});
