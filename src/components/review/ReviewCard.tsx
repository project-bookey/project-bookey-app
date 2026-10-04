import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card, FootAction, Tag, formatRelative } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import { FinishedTag } from './FinishedTag';
import { ReviewActions } from './ReviewActions';

export type ReviewCardProps = {
  authorNickname: string;
  rating?: number | null;
  body: string;
  tags: string[];
  commentCount?: number;
  createdAt: string;
  /** 아직 책 정보를 못 받았으면 '책'으로 대신한다. */
  bookTitle?: string;
  /** 작성자가 이 책을 완독했으면 이름 옆에 '완독'. */
  authorFinished: boolean;
  onOpenBook: () => void;
  /** 내 리뷰일 때만 — 고치기·삭제가 머리 줄 오른쪽 위에 선다. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** 삭제를 한 번 눌러 '한 번 더'를 기다리는 중. */
  deleteConfirming?: boolean;
};

/**
 * 리뷰 카드 — 리뷰 상세 위에 서는 카드.
 *
 * 리뷰는 조각이 아니라 글이라 본문을 자르지 않고 전문을 그대로 편다. 독후감의 문장 조각과 달리
 * 왼쪽 악센트 선은 두지 않는다 — 인용이 아니라 자기 글이기 때문이다.
 * 내 글을 다루는 '고치기'·'삭제'는 목록의 리뷰 조각과 같은 자리 — 머리 줄 오른쪽 위. 별점은 발치 오른쪽, 왼쪽엔 '책 보기'(사용자 결정, 2026-10-05).
 */
export function ReviewCard({
  authorNickname, rating, body, tags, createdAt,
  bookTitle, authorFinished, onOpenBook, onEdit, onDelete, deleteConfirming = false,
}: ReviewCardProps) {
  const { colors } = useTheme();
  const where = bookTitle ?? '책';

  return (
    <Card style={styles.card}>
      <View style={styles.authorRow}>
        {/* 리뷰 응답에는 작성자 사진이 없다 — 아바타는 늘 닉네임 이니셜로 선다. */}
        <Avatar nickname={authorNickname} />
        <View style={styles.authorText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
              {authorNickname}
            </Text>
            {authorFinished ? <FinishedTag /> : null}
          </View>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {where} · {formatRelative(createdAt)}
          </Text>
        </View>
        <ReviewActions onEdit={onEdit} onDelete={onDelete} deleteConfirming={deleteConfirming} />
      </View>

      <Text style={[styles.body, { color: colors.text }]}>{body}</Text>

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => <Tag key={tag} label={tag} />)}
        </View>
      ) : null}

      <View style={styles.footRow}>
        <FootAction label="책 보기" tone="accent" onPress={onOpenBook} accessibilityLabel={`${where} 상세`} />
        {rating ? (
          <Text style={[typeScale.monoNumeral, styles.rating, { color: colors.accent }]}>★ {rating}</Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)과 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nickname: { lineHeight: 20, flexShrink: 1 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: 2 },
  rating: { marginLeft: 'auto' },
  // 리뷰 본문 — 도서 상세 조각(14/23)보다 한 단 키운 읽기용 세리프. 인용이 아니라 좌측선은 없다.
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 26 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
