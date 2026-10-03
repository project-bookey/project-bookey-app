import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { inquiryApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { FaqList } from '@/components/inquiry/FaqList';
import { MyInquiryList } from '@/components/inquiry/MyInquiryList';
import { inquiryCategoriesKey } from '@/components/inquiry/queries';
import { Button, Segmented } from '@/components/ui';
import { hairline, layout, spacing, useTheme } from '@/theme';

type Pane = 'faq' | 'mine';

const PANES: { value: Pane; label: string }[] = [
  { value: 'faq', label: '자주 묻는 질문' },
  { value: 'mine', label: '내 문의' },
];

/**
 * 고객문의 — 설정의 '고객문의'에서 들어온다. 자주 묻는 질문 | 내 문의 두 칸에 주요 버튼 '문의하기' 하나.
 * 처음엔 FAQ 를 먼저 보여 흔한 질문은 여기서 풀리게 하고(`?pane=mine` 이면 내 문의부터),
 * '문의하기'를 누르면 칸을 내 문의로 돌려 둔다 — 보내고 돌아오면 방금 쓴 문의가 맨 위에 '답변 대기'로 보인다.
 */
export default function InquiryHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pane?: string }>();
  const [pane, setPane] = useState<Pane>(params.pane === 'mine' ? 'mine' : 'faq');

  // 작성 화면의 유형 칩이 바로 뜨게 미리 받아 둔다.
  useEffect(() => {
    void queryClient.prefetchQuery({ queryKey: inquiryCategoriesKey, queryFn: inquiryApi.categories, staleTime: Infinity });
  }, [queryClient]);

  return (
    <PaperScreen>
      <SubHeader category="고객문의" />
      <View style={styles.segment}>
        <Segmented options={PANES} value={pane} onChange={setPane} />
      </View>

      <View style={styles.body}>{pane === 'faq' ? <FaqList /> : <MyInquiryList />}</View>

      {/* 주요 버튼 하나를 엄지가 닿는 아래에 넓게(UX 철칙 Fitts) — 두 칸 어디서나 같은 자리. */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <Button
          label="문의하기"
          onPress={() => {
            setPane('mine');
            router.push('/inquiry/new');
          }}
        />
      </View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  segment: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  body: { flex: 1 },
  bottomBar: {
    ...layout.content,
    width: '100%',
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
