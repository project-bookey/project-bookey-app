import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaperScreen } from '@/components/collage';
import { PostFeed } from '@/components/post/PostFeed';
import { TourTarget } from '@/components/tour/TourTarget';
import { hairline, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 구역 3. 광장 — 다른 독자들의 독후감이 모이는 곳 (시안 2d).
 * 클럽은 상단 구역 탭으로 올라가 여기엔 없다.
 *
 * 광장은 독후감만 보여 준다 — '완독 자랑' 탭은 걷어내고 홈 '오늘의 글'(HomeScraps)에서
 * 독후감과 번갈아 돌린다(사용자 결정 2026-10-05). 탭이 하나뿐이라 탭 줄 자리에는 제목을 둔다.
 */
export default function PlazaScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const header = (
    <View style={styles.header}>
      <TourTarget id="plaza-actions" style={styles.titleRow}>
        <Text accessibilityRole="header" style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>
          독후감
        </Text>
        {/* 독후감은 길게 쓰는 글이라 접히는 패널이 아니라 제 화면으로 보낸다. */}
        <Pressable
          onPress={() => router.push('/post/new')}
          accessibilityRole="button"
          accessibilityLabel="독후감 쓰기"
          style={({ pressed }) => [styles.composeButton, { borderColor: colors.accent }, pressed && pressedStyle]}
        >
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 독후감</Text>
        </Pressable>
      </TourTarget>
    </View>
  );

  return (
    <PaperScreen>
      <PostFeed ListHeaderComponent={header} />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // 좌우 여백은 여기서 준다 — 안쪽 줄(둘러보기 대상)이 여백까지 감싸면 강조 테두리가 화면 끝에 붙는다.
  header: { paddingTop: spacing.lg, paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  // 제목과 쓰기 버튼은 한 줄 — 제목이 남는 폭을 채워 버튼은 오른쪽 끝에 붙는다.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: 18, lineHeight: 26 },
  composeButton: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
});
