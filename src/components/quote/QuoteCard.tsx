import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 푸터 액션 확장 터치 영역(네이티브 전용).
 * 웹은 hitSlop 을 무시하므로 실제 여백(styles.footAction)으로 상자를 키우고,
 * 네이티브는 그 위에 hitSlop 을 더 얹어 넉넉하게 잡는다.
 */
const FOOT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

export type QuoteCardProps = {
  authorNickname: string;
  authorAvatarUrl?: string | null;
  bookTitle: string;
  page?: number | null;
  content: string;
  agreeCount: number;
  agreedByMe: boolean;
  commentCount: number;
  /**
   * 작성자가 그 책을 완독했는지 — 광장 응답(`PlazaItemView`)에만 있는 값이다.
   * 밑줄 상세·책별 목록이 쓰는 `BookQuoteView` 에는 이 필드가 없어 그쪽 카드에는 마크가 서지 않는다.
   */
  authorFinished?: boolean;
  mine: boolean;
  /** 삭제 재확인 상태 — 라벨이 '한 번 더'로 바뀐다. */
  confirming?: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  /** 카드 회전(도). 광장은 교차 회전, 상세는 살짝만. */
  tilt?: number;
  onAgree: () => void;
  /** 본인 카드에서만 넘긴다. */
  onDelete?: () => void;
  /** 있으면 문장 본문을 눌러 상세로 간다(광장). */
  onOpen?: () => void;
  /** 있으면 푸터 오른쪽에 '책 보기 →'(상세). */
  onOpenBook?: () => void;
};

/** 24px 아바타 — 사진이 없으면 닉네임 첫 글자. 밑줄 카드·완독 카드·댓글 행이 같이 쓴다. */
export function QuoteAvatar({ uri, nickname }: { uri?: string | null; nickname: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{nickname.slice(0, 1)}</Text>
      )}
    </View>
  );
}

/** 밑줄 카드 — 광장 피드와 밑줄 상세가 같은 카드를 쓴다(시안 2d · D1). */
export function QuoteCard({
  authorNickname, authorAvatarUrl, bookTitle, page, content, agreeCount, agreedByMe, commentCount,
  authorFinished = false, mine, confirming = false, error, tilt = 0,
  onAgree, onDelete, onOpen, onOpenBook,
}: QuoteCardProps) {
  const { colors } = useTheme();

  const body = (
    <Text style={[styles.quote, { color: colors.text, borderLeftColor: colors.accent }]}>
      {content}
    </Text>
  );

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        <QuoteAvatar uri={authorAvatarUrl} nickname={authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {authorNickname}
          </Text>
          <View style={styles.whereRow}>
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
              {bookTitle}
              {page != null ? ` · ${page}쪽` : ''}
            </Text>
            {/* 작성자가 그 책을 완독했으면 인증 마크 — 서버가 기록으로 판정한다(광장에서만 온다). */}
            {authorFinished ? (
              <Text
                accessibilityLabel="완독 인증"
                style={[typeScale.monoLabel, styles.finishedMark, { color: colors.accent, borderColor: colors.accent }]}
              >
                완독 ✓
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="밑줄 상세">
          {body}
        </Pressable>
      ) : body}

      <View style={styles.footRow}>
        {/* 10px 활자라 글자 상자(16px)만으로는 손가락이 닿지 않는다 — 여백으로 36px 까지 넓힌다. */}
        <Pressable onPress={onAgree} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
          accessibilityRole="button"
          accessibilityState={{ selected: agreedByMe }}
          accessibilityLabel={`나도 그럼 ${agreeCount}`}>
          <Text style={[typeScale.monoLabel, styles.footLabel, {
            color: agreedByMe ? colors.accent : colors.textMuted,
          }]}>
            나도 그럼 {agreeCount}
          </Text>
        </Pressable>
        {onOpen ? (
          <Pressable onPress={onOpen} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
            accessibilityRole="button" accessibilityLabel={`댓글 ${commentCount}`}>
            <Text style={[typeScale.monoLabel, styles.footLabel, { color: colors.textMuted }]}>
              댓글 {commentCount}
            </Text>
          </Pressable>
        ) : (
          <Text style={[typeScale.monoLabel, styles.footLabel, styles.footAction, { color: colors.textMuted }]}>
            댓글 {commentCount}
          </Text>
        )}
        <View style={styles.footRight}>
          {onOpenBook ? (
            <Pressable onPress={onOpenBook} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
              accessibilityRole="button" accessibilityLabel={`${bookTitle} 상세`}>
              <Text style={[typeScale.monoLabel, styles.footLabel, { color: colors.accent }]}>책 보기 →</Text>
            </Pressable>
          ) : null}
          {mine && onDelete ? (
            <Pressable onPress={onDelete} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
              accessibilityRole="button" accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
              <Text style={[typeScale.monoLabel, styles.footLabel, {
                color: confirming ? colors.danger : colors.textFaint,
              }]}>
                {confirming ? '한 번 더' : '삭제'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  authorText: { flex: 1 },
  nickname: { fontSize: 12 },
  // 제목과 완독 마크 사이 — 4는 붙어 보인다는 피드백으로 8.
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  where: { fontSize: 9, letterSpacing: 0.4, flexShrink: 1 },
  // 완독 인증 마크 — 민트 테두리의 작은 pill.
  finishedMark: {
    fontSize: 8,
    letterSpacing: 0.6,
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  // 시안 2d 의 인용 본문 — quote 토큰을 15/1.65 로 줄이고 왼쪽에 악센트 선을 세운다.
  quote: { ...typeScale.quote, fontSize: 15, lineHeight: 25, borderLeftWidth: 2, paddingLeft: 11 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footLabel: { fontSize: 10, letterSpacing: 0.4 },
  // 여백으로 손가락 상자를 키우되, 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다.
  footAction: { paddingVertical: 10, paddingHorizontal: 6, marginVertical: -6, marginHorizontal: -6 },
});
