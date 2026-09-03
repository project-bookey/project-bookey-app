import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { postApi } from '@/api/endpoints';
import { myPostsKey } from '@/api/postCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { PostList } from '@/components/post/PostList';
import { Button } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 건수 — 내 글은 훑어 내리는 목록이라 광장 피드(10)보다 크게 잡는다. */
const PAGE_SIZE = 20;

/**
 * 내 독후감 — 프로필 '내 독후감'의 '전부 보기'로 들어온다.
 *
 * 광장 피드와 달리 비공개·링크 글까지 전부 걸린다(서버 `GET /api/v1/posts` 는 내 글을
 * 공개 범위와 무관하게 내려준다). 그래서 카드의 공개 범위 태그를 켠다 — 여기서만 켜는 이유는
 * 남에게 보이는 목록에서는 어차피 공개 글뿐이기 때문이다.
 * 책으로 건너뛰는 길은 두지 않는다 — 이 목록에서 궁금한 것은 '내가 뭘 썼나'이지 책이 아니다.
 * 목록의 뼈대는 광장 '독후감' 탭과 나눠 쓴다(PostList) — 여기는 쿼리와 문구만 갖는다.
 */
export default function MyPostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const mine = useInfiniteQuery({
    queryKey: myPostsKey,
    queryFn: ({ pageParam }) => postApi.mine(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  const writeAction = (
    <Pressable
      onPress={() => router.push('/post/new')}
      accessibilityRole="button"
      accessibilityLabel="독후감 쓰기"
      style={styles.write}
    >
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 쓰기</Text>
    </Pressable>
  );

  return (
    <PaperScreen>
      <SubHeader category="내 독후감" right={writeAction} />

      <PostList
        query={mine}
        showVisibility
        errorTitle="독후감을 불러오지 못했어요"
        emptyTitle="아직 독후감이 없습니다"
        emptyDescription="첫 독후감을 남겨보세요."
        emptyAction={<Button label="첫 독후감 쓰기" onPress={() => router.push('/post/new')} />}
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  // 헤더 우측 슬롯 — 웹은 hitSlop 을 무시하므로 여백으로 44px 상자를 만든다.
  write: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
});
