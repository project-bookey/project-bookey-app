import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MemoScrap, TiltCover } from '@/components/collage';
import { ScrapAuthor } from '@/components/home/ScrapAuthor';
import { useAuth } from '@/store/auth';
import { spacing } from '@/theme';

/** 카드 옆 표지 폭 — 홈 '오늘의 글'의 표지 스크랩(HomeScraps 의 COVER_W)과 같다. */
const COVER_W = 72;

/**
 * 내 완독 카드의 얼굴 — 홈 '오늘의 글'이 다른 독자에게 보여 주는 완독 조각(FinishScrap)과 같은 짜임이다.
 * 작성자 행(내 닉네임 · 완독 · 책 제목 · 다 읽은 때) 밑에 한 줄평 자리(children)를 두고, 오른쪽에 표지를 붙인다.
 *
 * 완독 카드 시트는 한 줄평 자리에 입력칸을, 도서 상세 '내 진도' 카드는 남긴 한 줄평을 넣는다.
 * 카드는 기울이지 않는다 — 입력칸이 들면 커서·선택 핸들이 비뚤어진다. 콜라주 맛은 옆 표지의 기울기가 낸다.
 */
export function FinishCardFace({ title, coverUrl, when, children }: {
  title: string;
  coverUrl?: string | null;
  /** 작성자 행 오른쪽 — '방금' · '3일 전'. */
  when: string;
  children: ReactNode;
}) {
  const me = useAuth((state) => state.user);
  return (
    <View style={styles.row}>
      <MemoScrap rotate={0} style={styles.card}>
        <ScrapAuthor nickname={me?.nickname ?? ''} avatarUrl={me?.avatarUrl} where={title} kind="완독" when={when} />
        {children}
      </MemoScrap>
      {/* 표지는 그림일 뿐 — 작성자 행이 이미 책 제목을 읽어 준다. 세 플랫폼 모두 가지째 숨긴다. */}
      <View
        style={styles.coverSlot}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TiltCover uri={coverUrl} title={title} width={COVER_W} tilt={2} entering={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 홈 '오늘의 글' 한 쌍과 같다 — 카드가 남는 폭을 쓰고 표지는 오른쪽에 붙는다.
  row: { flexDirection: 'row', gap: spacing.md },
  card: { flex: 1 },
  coverSlot: { justifyContent: 'center' },
});
