import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, FootAction } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

export type QuoteCardProps = {
  authorNickname: string;
  authorAvatarUrl?: string | null;
  bookTitle: string;
  page?: number | null;
  content: string;
  agreeCount: number;
  agreedByMe: boolean;
  commentCount?: number;
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

/** 24px 아바타(기본, size로 축소 가능 — 댓글 답글은 20px) — 사진이 없으면 닉네임 첫 글자. 밑줄 카드·완독 카드·댓글 행이 같이 쓴다. */
export function QuoteAvatar({ uri, nickname, size = 24 }: {
  uri?: string | null;
  nickname: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, backgroundColor: colors.surfaceRaised, borderColor: colors.line },
    ]}>
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
  authorNickname, authorAvatarUrl, bookTitle, page, content, agreeCount, agreedByMe,
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
        <FootAction label={`좋아요 ${agreeCount}`} onPress={onAgree} selected={agreedByMe} />
        <View style={styles.footRight}>
          {onOpenBook ? (
            <FootAction label="책 보기 →" onPress={onOpenBook} tone="accent" accessibilityLabel={`${bookTitle} 상세`} />
          ) : null}
          {mine && onDelete ? (
            <FootAction
              label={confirming ? '한 번 더' : '삭제'}
              onPress={onDelete}
              tone={confirming ? 'danger' : 'faint'}
              accessibilityLabel={confirming ? '삭제 확인' : '삭제'}
            />
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
});
