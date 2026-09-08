import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { TiltCover } from '@/components/collage';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Card, FootAction, Tag, formatRelative } from '@/components/ui';
import { darkColors, hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/** 포스터 사진 높이(px) — 카드 머리를 채우고 그 위에 표제까지 얹는다. */
const POSTER_H = 208;

/** 공개 범위 라벨 — 공개는 굳이 말하지 않으므로 여기 없다. 상세 바이라인도 같이 쓴다. */
export const VISIBILITY_LABEL = { PRIVATE: '비공개', LINK: '링크' } as const;

/**
 * 독후감 카드 — 광장 피드·책별 목록·내 독후감이 같은 카드를 쓴다(밑줄의 QuoteCard 와 같은 꼴).
 *
 * '포스터' 꼴이다 — 첫 사진이 카드 머리를 통째로 채우고, 아래로 깔린 그라데이션 위에
 * 책 이름과 표제를 얹는다. 표지는 사진 오른쪽 위에 붙인 것처럼 걸친다. 그 아래로
 * 발췌 세 줄, 작성자 줄, 발치 액션이 온다.
 *
 * 사진이 없는 글은 포스터 자리를 검은 판으로 남기지 않는다 — 표지를 세운 짧은
 * 머리판으로 갈아 끼워 카드 키를 줄인다(아래 PosterHead 참고).
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
  const visibilityLabel = post.visibility === 'PUBLIC' ? null : VISIBILITY_LABEL[post.visibility];

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="독후감 상세">
        <PosterHead post={post} />

        <View style={styles.below}>
          <Text numberOfLines={3} style={[typeScale.body, styles.excerpt, { color: colors.textMuted }]}>
            {post.excerpt}
          </Text>
        </View>
      </Pressable>

      {/* 카드가 사진을 물고 있어 패딩이 0 이다 — 활자 쪽만 제 여백을 갖는다. */}
      <View style={styles.pad}>
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
              {formatRelative(post.publishedAt ?? post.createdAt)}
            </Text>
          </View>
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
      </View>
    </Card>
  );
}

/**
 * 카드 머리 — 사진이 있으면 포스터, 없으면 표지를 세운 짧은 판.
 *
 * 사진 없는 글에 같은 높이의 빈 판을 두면 검은 덩어리만 남는다. 그때는 판을 낮추고
 * 표지를 세워 책 이름·표제를 나란히 읽게 한다 — 카드 키가 자연스럽게 줄어든다.
 */
function PosterHead({ post }: { post: Post }) {
  const { colors } = useTheme();
  const photo = post.images[0];
  const extraPhotos = post.images.length - 1;
  const bookLabel = post.bookTitle ?? '책 없음';

  if (!photo) {
    return (
      <View style={[styles.plainHead, { backgroundColor: colors.surfaceDeep, borderBottomColor: colors.line }]}>
        {post.bookId != null ? (
          <TiltCover uri={post.bookCoverUrl} title={post.bookTitle} width={56} tilt={-3} entering={false} />
        ) : null}
        <View style={styles.plainHeadText}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.accent }]}>
            {bookLabel}
          </Text>
          <Text numberOfLines={2} style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>
            {post.title}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.poster, { backgroundColor: colors.surfaceDeep }]}>
      <Image
        source={{ uri: photo.url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel="독후감 사진"
      />

      {/* 표제를 읽히게 하는 그라데이션 — 사진이 밝아도 활자가 뜨지 않는다. */}
      <LinearGradient colors={colors.scrimStops} style={styles.scrim} />

      {/* 사진 왼쪽 위는 비어 있다 — 남은 장수는 표제와 겹치지 않게 여기 얹는다. */}
      {extraPhotos > 0 ? (
        <View style={[styles.moreBadge, { backgroundColor: colors.scrimDim }]}>
          <Text style={[typeScale.monoLabel, { color: darkColors.text }]}>+{extraPhotos}</Text>
        </View>
      ) : null}

      {post.bookId != null ? (
        <View style={styles.coverCorner}>
          <TiltCover uri={post.bookCoverUrl} title={post.bookTitle} width={46} tilt={4} entering={false} />
        </View>
      ) : null}

      <View style={styles.posterText}>
        <Text numberOfLines={1} style={[typeScale.monoLabel, { color: darkColors.accent }]}>
          {bookLabel}
        </Text>
        {/* 사진 위 글씨는 모드와 무관하게 밝은 잉크로 읽는다 — 뒤에 깔린 것이 늘 어두운 사진이다. */}
        <Text numberOfLines={2} style={[typeScale.titleSerif, styles.title, { color: darkColors.text }]}>
          {post.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 사진이 카드 모서리까지 차오르도록 패딩을 0 으로 둔다 — Card 의 overflow:hidden 이 모서리를 깎는다.
  card: { gap: spacing.md, padding: 0 },

  poster: { height: POSTER_H, justifyContent: 'flex-end' },
  // 아래 절반만 덮는다 — 사진 윗부분은 그대로 보인다.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: POSTER_H * 0.7 },
  coverCorner: { position: 'absolute', top: spacing.md, right: spacing.md },
  posterText: { padding: spacing.lg, gap: spacing.xs },
  moreBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  // 사진 없는 글의 머리판 — 표지를 세우고 옆에 책 이름·표제.
  plainHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: hairline,
  },
  plainHeadText: { flex: 1, gap: spacing.xs },

  title: { fontSize: 20, lineHeight: 27 },
  below: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  excerpt: { fontSize: 14, lineHeight: 22 },
  pad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)·밑줄 카드와 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nickname: { lineHeight: 20 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: 2 },

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
