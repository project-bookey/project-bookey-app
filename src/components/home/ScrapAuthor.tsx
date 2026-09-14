import { StyleSheet, Text, View } from 'react-native';

import { AUTHOR_AVATAR, AUTHOR_GAP, AUTHOR_H, META_LH, META_SIZE } from '@/components/home/scrapMetrics';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Tag } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 홈 '오늘의 글' 조각 머리의 작성자 행 — 아바타 옆에 두 줄.
 *
 *   닉네임 ………………… [밑줄|독후감]  ← 종류 태그
 *   책 제목 ………………… 좋아요 12    ← 핫 지표
 *
 * 광장 밑줄 카드(QuoteCard 의 authorRow)와 같은 짜임이라 눈에 익고, 오른쪽 열이 각 줄의 글자
 * 밑선에 맞아 떨어진다 — 처음엔 핫 지표를 행 세로 가운데에 하나만 뒀는데 어느 줄에도
 * 안 맞아 떠 보인다는 피드백(2026-09-08, 시안 D)으로 종류·좋아요를 두 줄에 나눠 앉혔다.
 *
 * 밑줄 조각(HomeScraps)과 독후감 조각(PostScrap 의 home)이 같은 행을 머리에 세운다 —
 * 6초마다 번갈아 서는 두 조각의 첫 줄이 같은 모양이어야 눈이 흔들리지 않는다.
 * 높이(AUTHOR_H)와 아래 간격(AUTHOR_GAP)을 여기서 못 박아 행 높이 계산(HomeScraps 의 ROW_H)에
 * 그대로 들어간다 — 쓰는 쪽이 간격을 따로 주면 두 조각이 어긋난다.
 *
 * 핫 지표는 표시 전용이라 누를 수 없고, 토글은 광장에서만. 0 이어도 쓴다 — 한쪽만 비우면
 * 회전할 때 오른쪽 열이 들쭉날쭉하다.
 * 아바타는 광장 카드의 QuoteAvatar 를 그대로 쓴다 — 사진이 없으면 닉네임 첫 글자.
 * 누를 수 없다 — 바깥 행 하나가 통째로 버튼이다(HomeScraps 의 rowWrap 주석 참고).
 */
export function ScrapAuthor({ nickname, avatarUrl, where, kind, stat }: {
  nickname: string;
  avatarUrl?: string | null;
  /** 둘째 줄 왼쪽 — 책 제목. 길면 말줄임. */
  where: string;
  /** 첫째 줄 오른쪽 태그 — 무슨 글의 조각인지. 밑줄과 독후감이 섞여 돌아가는 자리라 늘 단다. */
  kind: '밑줄' | '독후감';
  /** 둘째 줄 오른쪽 핫 지표 — `좋아요 12`. */
  stat: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <QuoteAvatar uri={avatarUrl} nickname={nickname} size={AUTHOR_AVATAR} />
      <View style={styles.text}>
        <View style={styles.line1}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {nickname}
          </Text>
          <Tag label={kind} fg={colors.accent} bg={colors.accentSoft} />
        </View>
        <View style={styles.line2}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {where}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.stat, { color: colors.accent }]}>
            {stat}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    height: AUTHOR_H,
    marginBottom: AUTHOR_GAP,
  },
  // 두 줄이 아바타 세로 가운데에 걸린다 — 20 + 2 + 14 = 36, 아바타 40 안에 든다.
  text: { flex: 1, justifyContent: 'center' },
  // 태그(패딩 3 + 글자 ≈ 20)가 닉네임 줄 높이와 같아 줄이 늘어나지 않는다.
  line1: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 20 },
  line2: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: META_LH, marginTop: 2 },
  // 닉네임은 본문 굵기 그대로(15) — 아바타(40)와 나란히 서서 누구 글인지 먼저 읽힌다.
  // 오른쪽 열(태그·좋아요)은 줄어들지 않는다 — 닉네임·책 제목이 먼저 말줄임된다.
  nickname: { flex: 1, lineHeight: 20 },
  where: { flex: 1, fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH },
  stat: { fontSize: META_SIZE, letterSpacing: 0.4, lineHeight: META_LH, flexShrink: 0 },
});
