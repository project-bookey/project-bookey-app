import { StyleSheet, View } from 'react-native';
import { CachedImage as Image } from '@/components/CachedImage';
import { useTheme } from '@/theme';

const artwork = {
  light: {
    closed: require('../../../assets/optimized/postcard-envelopes/light-closed.webp'),
    open: require('../../../assets/optimized/postcard-envelopes/light-open.webp'),
  },
  dark: {
    closed: require('../../../assets/optimized/postcard-envelopes/dark-closed.webp'),
    open: require('../../../assets/optimized/postcard-envelopes/dark-open.webp'),
  },
};

/** 본문 없이 테마와 열람 상태에 맞는 봉투 그림 전체를 표시한다. */
export function PostcardEnvelope({ opened }: { opened: boolean }) {
  const { mode } = useTheme();
  return (
    <View style={styles.frame}>
      <Image
        source={artwork[mode][opened ? 'open' : 'closed']}
        style={styles.art}
        contentFit="contain"
        recyclingKey={`${mode}-${opened ? 'open' : 'closed'}`}
        accessible={false}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  // 원본의 intrinsic height가 목록 높이를 밀어내지 않도록 별도 프레임에 격리한다.
  frame: { width: '100%', aspectRatio: 3 / 2, overflow: 'hidden' },
  art: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
