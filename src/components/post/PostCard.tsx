import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye } from 'lucide-react-native';

import type { Post } from '@/api/types';
import { TiltCover } from '@/components/collage';
import { Avatar } from '@/components/Avatar';
import { LikeAction } from '@/components/post/LikeAction';
import { VisibilityMark } from '@/components/post/PostByline';
import { Card, formatRelative } from '@/components/ui';
import { darkColors, hairline, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 포스터 사진 높이(px) — 카드 머리를 채우고 그 위에 표제까지 얹는다. */
const POSTER_H = 208;
/** 발치 작성자 아바타(px) — 발치 한 줄(44pt) 안에 들어가는 작은 크기. */
const FOOT_AVATAR = 28;

/**
 * 독후감 카드 — 광장 피드·내 독후감이 같은 카드를 쓴다.
 *
 * 머리는 '포스터'다 — 첫 사진이 카드 머리를 통째로 채우고, 아래로 깔린 그라데이션 위에
 * 책 이름과 표제를 얹는다. 표지는 사진 오른쪽 위에 붙인 것처럼 걸친다. 사진이 없는 글은
 * 포스터 자리를 검은 판으로 남기지 않고 표지를 세운 짧은 머리판으로 갈아 끼운다(PosterHead).
 * 그 아래는 발췌 두 줄과, 머리카락 선으로 끊은 발치 한 줄(작성자 · 올린 때 … 조회 · 좋아요)이다.
 * 카드는 기울이지 않는다 — 사진이 큰 카드라 기울이면 사진 모서리가 들쭉날쭉해 보인다.
 *
 * 머리·발췌만 눌러 상세로 가고 발치는 그 형제다 — 웹에서 버튼 안에 버튼이 들어가면 안 되기 때문이다.
 * 삭제는 여기 없다(상세에서만) — 목록에서 실수로 지우는 일을 만들지 않는다.
 */
export function PostCard({ post, onOpen, onLike, onOpenAuthor, showVisibility = false }: {
  post: Post;
  onOpen: () => void;
  onLike: () => void;
  /** 있으면 발치의 작성자를 눌러 유저 마이페이지로 (§14.1 — 피드에서 사람으로). */
  onOpenAuthor?: () => void;
  /** 내 독후감처럼 공개 범위를 밝혀야 하는 목록에서만 켠다 — 발치의 올린 때 옆에 붙는다. */
  showVisibility?: boolean;
}) {
  const { colors } = useTheme();
  const when = formatRelative(post.publishedAt ?? post.createdAt);
  const showMark = showVisibility && post.visibility !== 'PUBLIC';

  return (
    <Card style={styles.card}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="독후감 상세">
        <PosterHead post={post} />
        {post.excerpt.length > 0 ? (
          <Text numberOfLines={2} style={[typeScale.body, styles.excerpt, { color: colors.textMuted }]}>
            {post.excerpt}
          </Text>
        ) : null}
      </Pressable>

      <View style={[styles.foot, { borderTopColor: colors.line }]}>
        {/* 작성자를 누르면 그 사람의 마이페이지로 — 팔로우는 거기서 한다. */}
        <Pressable
          onPress={onOpenAuthor}
          disabled={!onOpenAuthor}
          accessibilityRole={onOpenAuthor ? 'button' : undefined}
          accessibilityLabel={onOpenAuthor ? `${post.authorNickname} 프로필 열기` : undefined}
          style={({ pressed }) => [styles.author, pressed ? pressedStyle : null]}
        >
          <Avatar uri={post.authorAvatarUrl} nickname={post.authorNickname} size={FOOT_AVATAR} />
          <Text numberOfLines={1} style={[typeScale.label, styles.nickname, { color: colors.text }]}>
            {post.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
            {when}
          </Text>
          {showMark ? <VisibilityMark visibility={post.visibility} color={colors.textFaint} /> : null}
        </Pressable>
        {/* 조회수는 눈 아이콘 + 숫자 — 사용자 결정. 누를 수 없는 정보라 Pressable 이 아니라 View 다. */}
        <View accessible accessibilityLabel={`조회 ${post.viewCount}`} style={styles.views}>
          <Eye size={22} color={colors.textMuted} {...iconStroke} />
          <Text style={[styles.viewCount, { color: colors.textMuted }]}>{post.viewCount}</Text>
        </View>
        <LikeAction count={post.likeCount} liked={post.likedByMe} onPress={onLike} />
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
      <View style={[styles.plainHead, { backgroundColor: colors.surfaceRaised, borderBottomColor: colors.lineStrong }]}>
        {post.bookId != null ? (
          <TiltCover uri={post.bookCoverUrl} title={post.bookTitle} width={56} tilt={-3} entering={false} />
        ) : null}
        <View style={styles.plainHeadText}>
          {/* 책 이름은 링크가 아니다(카드는 독후감으로, 책은 발치의 '책 보기'로 간다) — 악센트를 쓰지 않는다. */}
          <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.textFaint }]}>
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
        {/* 사진 위 글씨는 모드와 무관하게 밝은 잉크로 읽는다 — 뒤에 깔린 것이 늘 어두운 사진이다. */}
        <Text numberOfLines={1} style={[typeScale.monoLabel, { color: darkColors.textMuted }]}>
          {bookLabel}
        </Text>
        <Text numberOfLines={2} style={[typeScale.titleSerif, styles.title, { color: darkColors.text }]}>
          {post.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 사진이 카드 모서리까지 차오르도록 패딩을 0 으로 둔다 — Card 의 overflow:hidden 이 모서리를 깎는다.
  // 칸 사이는 각 칸이 제 여백으로 띄운다.
  card: { gap: 0, padding: 0 },

  poster: { height: POSTER_H, justifyContent: 'flex-end' },
  // 아래 절반만 덮는다 — 사진 윗부분은 그대로 보인다.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: POSTER_H * 0.7 },
  coverCorner: { position: 'absolute', top: spacing.md, right: spacing.md },
  posterText: { padding: spacing.lg, gap: spacing.xs },
  moreBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  // 사진 없는 글의 머리판 — 표지를 세우고 옆에 책 이름·표제.
  // 판 색은 카드보다 한 단 올린 surfaceRaised 다: surfaceDeep 은 다크에서 카드와 3 단위밖에
  // 차이가 안 나 단차가 안 보였다. 아래 경계선도 lineStrong 으로 올려 단을 또렷하게 끊는다.
  plainHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: hairline,
  },
  plainHeadText: { flex: 1, gap: spacing.xs },

  title: { fontSize: 23, lineHeight: 31 },
  excerpt: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, fontSize: 15, lineHeight: 23 },

  // 발치 한 줄 — 머리카락 선으로 발췌와 끊는다. 작성자 쪽이 줄어들고 조회·좋아요는 제 폭을 지킨다.
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderTopWidth: hairline,
  },
  // 작성자 — 44pt 상자로 키우고 같은 만큼 음수 마진으로 되돌려 발치 높이는 그대로 둔다.
  author: { flex: 1, minWidth: 0, minHeight: 44, marginVertical: -6, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nickname: { flexShrink: 1 },
  meta: { fontSize: 10, letterSpacing: 0.4 },
  // 조회 — 옆 좋아요(LikeAction)와 같은 아이콘 크기·숫자 조판으로 맞춘다.
  views: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewCount: { ...typeScale.monoNumeral },
});
