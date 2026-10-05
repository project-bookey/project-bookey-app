import { StyleSheet, Text, View } from 'react-native';

import type { PlazaItem } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { ScrapAuthor } from '@/components/home/ScrapAuthor';
import { QUOTE_MAX_H } from '@/components/home/scrapMetrics';
import { formatRelative } from '@/components/ui';
import { useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/**
 * 완독 자랑 조각 — 홈 '오늘의 글' 스포트라이트에서 독후감 조각(PostScrap 의 home)과 번갈아 선다.
 *
 * 광장은 독후감만 보여 주고(사용자 결정 2026-10-05), 누가 무슨 책을 끝냈는지는 여기로 옮겼다.
 * 짜임은 독후감 조각과 같다 — 머리에 작성자 행(태그 `완독`, 오른쪽엔 좋아요 대신 다 읽은 때),
 * 그 아래 한 줄 글 상자. 행 높이가 표지에 못 박혀 있어(HomeScraps 의 ROW_H) 글 상자는 한 줄이고,
 * 그 회차의 완독 한 줄평을 따옴표로 둔다. 한 줄평이 없으면 다 읽었다는 말로 채워 행이 비지 않게 한다.
 *
 * 누를 수 없다 — 바깥 행 하나가 통째로 버튼이다(HomeScraps 의 rowWrap 주석 참고).
 */
export function FinishScrap({ item }: { item: PlazaItem }) {
  const { colors } = useTheme();

  return (
    <MemoScrap rotate={0} style={styles.card}>
      <ScrapAuthor
        nickname={item.authorNickname}
        avatarUrl={item.authorAvatarUrl}
        where={item.bookTitle}
        kind="완독"
        when={formatRelative(item.occurredAt)}
      />
      <View style={styles.textBox}>
        {item.remark ? (
          <Text numberOfLines={1} style={[styles.line, { color: colors.text }]}>“{item.remark}”</Text>
        ) : (
          <Text numberOfLines={1} style={[styles.line, { color: colors.textMuted }]}>마지막 장까지 다 읽었어요</Text>
        )}
      </View>
    </MemoScrap>
  );
}

const styles = StyleSheet.create({
  // 높이가 못 박힌 행을 꽉 채운다 — 독후감 조각의 homeCard 와 같다.
  card: { flex: 1, overflow: 'hidden' },
  // 한 줄 글 상자 — 독후감 조각의 제목 상자와 같은 높이라 회전해도 조각 모양이 같다.
  textBox: { maxHeight: QUOTE_MAX_H, overflow: 'hidden' },
  line: { fontFamily: serif.regular, fontSize: 15, lineHeight: QUOTE_MAX_H, maxHeight: QUOTE_MAX_H, overflow: 'hidden' },
});
