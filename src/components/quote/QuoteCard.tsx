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

/**
 * 작성자 아바타 지름(px) — 앱 어디서나 같은 크기다.
 * 홈 '오늘의 글'에서 누가 썼는지가 먼저 보여야 한다는 피드백으로 40 까지 키운 뒤(2026-09-08),
 * 광장·상세·댓글·방문자 등 다른 자리도 여기에 맞췄다 — 화면마다 사람 크기가 다르면 같은 사람이
 * 다른 사람처럼 보인다. 옆에 닉네임(15/20) + 메타 한 줄(10/14) = 36 이 서면 위아래가 딱 맞는다.
 */
export const AVATAR_SIZE = 40;

/**
 * 사진 없는 사람의 기본 그림 — 원(머리)과 위가 둥근 판(어깨)으로 그린 실루엣.
 * 어깨는 아바타 아래로 넘겨 잘리게 둔다 — 증명사진처럼 보이라고.
 *
 * 닉네임 첫 글자 대신 실루엣을 쓴다(2026-09-08, 시안 D): 사진을 올린 사람과 안 올린 사람이
 * 한눈에 갈리고, 첫 글자가 기호·이모지인 닉네임에서도 지저분해지지 않는다.
 * 아바타를 직접 그리는 화면(나·프로필 수정·유저 마이페이지·방문자·메신저)도 이걸 가져다 쓴다 —
 * 사진 없는 모습이 화면마다 다르면 같은 사람이 다른 사람처럼 보인다.
 * 비율이 전부 지름에 매여 있어 40px 목록이든 112px 프로필이든 같은 얼굴이 나온다.
 */
export function PersonGlyph({ size, color }: { size: number; color: string }) {
  const head = Math.round(size * 0.27);
  const bodyW = Math.round(size * 0.52);
  const bodyH = Math.round(size * 0.4);
  return (
    <View style={[styles.glyph, { width: size, height: size }]} pointerEvents="none">
      <View style={{
        width: head,
        height: head,
        borderRadius: head / 2,
        backgroundColor: color,
        marginTop: Math.round(size * 0.22),
      }} />
      <View style={{
        width: bodyW,
        height: bodyH,
        backgroundColor: color,
        borderTopLeftRadius: bodyW / 2,
        borderTopRightRadius: bodyW / 2,
        marginTop: Math.round(size * 0.05),
      }} />
    </View>
  );
}

/**
 * 작성자 아바타(기본 AVATAR_SIZE) — 밑줄·독후감·리뷰·완독 카드와 댓글 행, 홈 조각이 같이 쓴다.
 * 사진이 없으면 빈 원이 아니라 종이 판 위에 실루엣을 세운다(PersonGlyph).
 */
export function QuoteAvatar({ uri, nickname, size = AVATAR_SIZE }: {
  uri?: string | null;
  /** 사진을 읽어 줄 이름. 실루엣만 설 때는 옆 닉네임 글자가 이미 읽히므로 라벨을 달지 않는다. */
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
        <Image
          source={{ uri }}
          style={styles.avatarImage}
          resizeMode="cover"
          accessibilityLabel={`${nickname} 프로필 사진`}
        />
      ) : (
        <PersonGlyph size={size} color={colors.textFaint} />
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  // 실루엣 두 조각(머리·어깨)을 세로로 쌓는 상자 — 넘치는 어깨는 잘라 낸다.
  glyph: { alignItems: 'center', overflow: 'hidden' },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)과 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nickname: { lineHeight: 20 },
  // 제목과 완독 마크 사이 — 4는 붙어 보인다는 피드백으로 8.
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, flexShrink: 1 },
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
