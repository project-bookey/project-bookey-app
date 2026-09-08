import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VerificationLevel } from '@/api/types';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Card, Tag, formatRelative } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import { VERIFICATION_LABEL } from './verification';

/**
 * 푸터 액션 확장 터치 영역(네이티브 전용).
 * 웹은 hitSlop 을 무시하므로 실제 여백(styles.footAction)으로 상자를 키운다 — 밑줄 카드와 같은 규칙.
 */
const FOOT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

export type ReviewCardProps = {
  authorNickname: string;
  rating?: number | null;
  verificationLevel: VerificationLevel;
  body: string;
  tags: string[];
  commentCount?: number;
  createdAt: string;
  /** 아직 책 정보를 못 받았으면 '책'으로 대신한다. */
  bookTitle?: string;
  /** 카드 회전(도). 상세는 살짝만. */
  tilt?: number;
  onOpenBook: () => void;
};

/**
 * 리뷰 카드 — 리뷰 상세 위에 서는 카드(밑줄 카드와 같은 만듦새).
 *
 * 리뷰는 조각이 아니라 글이라 본문을 자르지 않고 전문을 그대로 편다. 밑줄과 달리
 * 왼쪽 악센트 선은 두지 않는다 — 인용이 아니라 자기 글이기 때문이다.
 * 삭제·수정은 아직 없다(서버에도 없음).
 */
export function ReviewCard({
  authorNickname, rating, verificationLevel, body, tags, createdAt,
  bookTitle, tilt = 0, onOpenBook,
}: ReviewCardProps) {
  const { colors } = useTheme();
  const where = bookTitle ?? '책';
  const verified = verificationLevel === 'VERIFIED_FULL';

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        {/* 리뷰 응답에는 작성자 사진이 없다 — 아바타는 늘 닉네임 이니셜로 선다. */}
        <QuoteAvatar nickname={authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {authorNickname}
          </Text>
          <View style={styles.whereRow}>
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
              {where} · {formatRelative(createdAt)}
            </Text>
            {/* 검증 등급 — 밑줄 카드의 완독 마크와 같은 작은 pill. 완독 검증만 민트. */}
            <Text
              style={[typeScale.monoLabel, styles.verification, {
                color: verified ? colors.accent : colors.textFaint,
                borderColor: verified ? colors.accent : colors.lineStrong,
              }]}
            >
              {VERIFICATION_LABEL[verificationLevel]}
            </Text>
          </View>
        </View>
        {rating ? (
          <Text style={[typeScale.monoNumeral, styles.rating, { color: colors.accent }]}>★ {rating}</Text>
        ) : null}
      </View>

      <Text style={[styles.body, { color: colors.text }]}>{body}</Text>

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => <Tag key={tag} label={tag} />)}
        </View>
      ) : null}

      <View style={styles.footRow}>
        <View style={styles.footRight}>
          <Pressable onPress={onOpenBook} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
            accessibilityRole="button" accessibilityLabel={`${where} 상세`}>
            <Text style={[typeScale.monoLabel, styles.footLabel, { color: colors.accent }]}>책 보기 →</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)·밑줄 카드와 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nickname: { lineHeight: 20 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, flexShrink: 1 },
  // 검증 마크 — 밑줄 카드의 완독 마크와 같은 치수.
  verification: {
    fontSize: 8,
    letterSpacing: 0.6,
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rating: { marginLeft: 'auto' },
  // 리뷰 본문 — 도서 상세 조각(14/23)보다 한 단 키운 읽기용 세리프. 인용이 아니라 좌측선은 없다.
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 26 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footLabel: { fontSize: 10, letterSpacing: 0.4 },
  // 여백으로 손가락 상자를 키우되, 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다.
  footAction: { paddingVertical: 10, paddingHorizontal: 6, marginVertical: -6, marginHorizontal: -6 },
});
