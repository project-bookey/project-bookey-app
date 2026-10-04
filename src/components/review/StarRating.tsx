import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconStroke, pressedStyle, useTheme } from '@/theme';

/** 별 수 → 한마디. 고른 별 밑에 띄워 숫자보다 먼저 마음이 읽히게 한다. 0 은 아직 고르지 않음. */
export const RATING_WORDS = ['', '아쉬웠어요', '그저 그랬어요', '괜찮았어요', '좋았어요', '최고였어요'] as const;

/** 별점에 맞춘 글 칸 안내 — 빈 칸 앞에서 무엇부터 쓸지 실마리를 준다. */
export function ratingPrompt(rating: number): string {
  if (rating >= 4) return '어떤 점이 좋았나요?';
  if (rating === 3) return '한 줄로 남긴다면?';
  if (rating > 0) return '어떤 점이 아쉬웠나요?';
  return '이 책은 어땠나요?';
}

/** 별 크기 — md 는 인라인 리뷰 폼, lg 는 완독 시트처럼 별점이 화면의 주인공일 때. */
const SIZES = { md: { icon: 24, box: 44 }, lg: { icon: 36, box: 52 } } as const;

/**
 * 별점 고르기 — 선 별 다섯 개, 고른 데까지 잉크로 채운다(고른 상태는 잉크 반전 — Design system).
 * 같은 별을 한 번 더 누르면 비운다(별점은 선택 사항). 별마다 44pt 이상 상자라 이웃 별을 잘못 누르지 않는다.
 */
export function StarRating({ value, onChange, size = 'md' }: {
  value: number;
  onChange: (rating: number) => void;
  size?: keyof typeof SIZES;
}) {
  const { colors } = useTheme();
  const { icon, box } = SIZES[size];
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="별점">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n === value ? 0 : n)}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === value }}
            accessibilityLabel={`별점 ${n}점`}
            style={({ pressed }) => [{ width: box, height: box }, styles.star, pressed ? pressedStyle : null]}
          >
            <Star
              size={icon}
              color={filled ? colors.ink : colors.lineStrong}
              fill={filled ? colors.ink : 'transparent'}
              {...iconStroke}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
});
