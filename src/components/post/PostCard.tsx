import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { TiltCover } from '@/components/collage';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Card, FootAction, Tag, formatRelative } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/** 본문 오른쪽에 붙인 사진 조각(px) — 표지(44)보다 조금 크게, 인화지를 얹은 크기. */
const THUMB = 56;

/** 공개 범위 라벨 — 공개는 굳이 말하지 않으므로 여기 없다. 상세 바이라인도 같이 쓴다. */
export const VISIBILITY_LABEL = { PRIVATE: '비공개', LINK: '링크' } as const;

/**
 * 독후감 카드 — 광장 피드·책별 목록·내 독후감이 같은 카드를 쓴다(밑줄의 QuoteCard 와 같은 꼴).
 *
 * 본문 행만 눌러 상세로 가고 푸터는 그 형제다 — 웹에서 버튼 안에 버튼이 들어가면 안 되기 때문이다.
 * 삭제는 여기 없다(상세에서만) — 목록에서 실수로 지우는 일을 만들지 않는다.
 */
export function PostCard({ post, tilt, onOpen, onLike, onOpenBook, onOpenAuthor, showVisibility = false }: {
  post: Post;
  /** 카드 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
  tilt: number;
  onOpen: () => void;
  onLike: () => void;
  /** 있으면 푸터 오른쪽에 '책 보기 →'. 책 없는 글에는 넘기지 않는다. */
  onOpenBook?: () => void;
  /** 있으면 작성자 줄을 눌러 유저 마이페이지로 (§14.1 — 피드에서 사람으로). */
  onOpenAuthor?: () => void;
  /** 내 독후감처럼 공개 범위를 밝혀야 하는 목록에서만 켠다. */
  showVisibility?: boolean;
}) {
  const { colors } = useTheme();

  const photo = post.images[0];
  const extraPhotos = post.images.length - 1;
  const visibilityLabel = post.visibility === 'PUBLIC' ? null : VISIBILITY_LABEL[post.visibility];

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <Pressable
        onPress={onOpenAuthor}
        disabled={!onOpenAuthor}
        accessibilityRole={onOpenAuthor ? 'button' : undefined}
        accessibilityLabel={onOpenAuthor ? `${post.authorNickname} 프로필 열기` : undefined}
        style={styles.authorRow}
      >
        <QuoteAvatar uri={post.authorAvatarUrl} nickname={post.authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {post.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {post.bookTitle ?? '책 없음'} · {formatRelative(post.publishedAt ?? post.createdAt)}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="독후감 상세" style={styles.bodyRow}>
        {/* 책에 매인 글에만 표지를 세운다 — 광장 완독 카드와 같은 44px 판. */}
        {post.bookId != null ? (
          <TiltCover uri={post.bookCoverUrl} title={post.bookTitle} width={44} tilt={0} entering={false} />
        ) : null}

        <View style={styles.bodyText}>
          <Text numberOfLines={2} style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>
            {post.title}
          </Text>
          <Text numberOfLines={3} style={[typeScale.body, styles.excerpt, { color: colors.textMuted }]}>
            {post.excerpt}
          </Text>
        </View>

        {photo ? (
          <View style={styles.photoSlot}>
            <Image
              source={{ uri: photo.url }}
              style={[styles.photo, { borderColor: colors.line }]}
              resizeMode="cover"
              accessibilityLabel="독후감 사진"
            />
            {extraPhotos > 0 ? (
              <Text style={[typeScale.monoLabel, styles.photoMore, { color: colors.textFaint }]}>
                +{extraPhotos}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <View style={styles.footRow}>
        <FootAction label={`좋아요 ${post.likeCount}`} onPress={onLike} selected={post.likedByMe} />
        <FootAction label={`조회 ${post.viewCount}`} />
        {/* 엮은 밑줄은 세기만 한다 — 펼쳐 보는 것은 상세의 몫이다. */}
        {post.quotes.length > 0 ? <FootAction label={`밑줄 ${post.quotes.length}`} /> : null}
        <View style={styles.footRight}>
          {onOpenBook ? (
            <FootAction
              label="책 보기 →"
              onPress={onOpenBook}
              tone="accent"
              accessibilityLabel={`${post.bookTitle ?? '책'} 상세`}
            />
          ) : null}
          {showVisibility && visibilityLabel ? <Tag label={visibilityLabel} /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorText: { flex: 1 },
  nickname: { fontSize: 12 },
  where: { fontSize: 9, letterSpacing: 0.4, marginTop: 2 },

  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bodyText: { flex: 1, gap: spacing.xs },
  title: { fontSize: 16, lineHeight: 22 },
  excerpt: { fontSize: 13, lineHeight: 20 },

  photoSlot: { alignItems: 'center', gap: 2 },
  // 살짝 비뚤게 붙인 인화지 — 표지와 반대 방향으로 기울여 둘이 겹쳐 보이지 않게.
  photo: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    borderWidth: hairline,
    transform: [{ rotate: '2deg' }],
  },
  photoMore: { fontSize: 9, letterSpacing: 0.4 },

  // 좋아요·조회·밑줄·책 보기 — 댓글은 없다(§14.1). 숫자가 커지면 한 줄에 못 담는다.
  // Card 가 overflow:hidden 이라 넘치면 소리 없이 잘리므로, 넘칠 때만 다음 줄로 내린다.
  // 줄 사이(rowGap)는 액션의 음수 세로 마진(-6·-6)만큼 먹히므로 한 단계 크게 잡는다.
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xl,
  },
  footRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
