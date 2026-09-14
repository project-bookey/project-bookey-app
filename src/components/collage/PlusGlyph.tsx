import { StyleSheet, View } from 'react-native';

type Props = {
  /** 십자 한 변의 길이. */
  size?: number;
  /** 막대 굵기. */
  stroke?: number;
  color: string;
};

/**
 * 가로·세로 막대 두 개로 그리는 '+' — 글자 '+' 는 폰트 메트릭 때문에 원 안에서 위·왼쪽으로
 * 치우치므로, 버튼·배지 안에 넣을 때는 이걸 써서 정확히 가운데에 놓는다.
 */
export function PlusGlyph({ size = 12, stroke = 2, color }: Props) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View
        style={[
          styles.bar,
          { width: size, height: stroke, top: (size - stroke) / 2, left: 0, backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.bar,
          { width: stroke, height: size, left: (size - stroke) / 2, top: 0, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', borderRadius: 1 },
});
