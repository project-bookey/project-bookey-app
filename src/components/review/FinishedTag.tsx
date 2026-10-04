import { StyleSheet, View } from 'react-native';

import { Tag } from '@/components/ui';

/**
 * '완독' 표시 — 리뷰를 쓴 사람이 이 책을 다 읽었다(회차와 상관없이 한 번이라도 완독). 리뷰 조각·리뷰 상세가 같은 모양을 쓴다.
 * 강조색을 쓰지 않는 조용한 태그다 — 리뷰 목록마다 초록이 흩어지지 않게(한 화면 강조 하나).
 */
export function FinishedTag() {
  // Tag 는 alignSelf: flex-start 라 가로 줄에서 위로 붙는다 — 감싸서 줄 가운데에 앉힌다.
  return (
    <View style={styles.wrap}>
      <Tag label="완독" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
});
