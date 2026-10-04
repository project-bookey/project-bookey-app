import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { ViewCount } from '@/components/post/ViewCount';
import { formatRelative } from '@/components/ui';
import { pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 공개 범위 라벨 — 공개는 굳이 말하지 않으므로 여기 없다. */
export const VISIBILITY_LABEL = { PRIVATE: '비공개', LINK: '링크', CLUB: '클럽만' } as const;

/** 공개 범위를 밝힐 글이면 그 라벨, 아니면 null — 카드 발치와 상세 바이라인이 같이 쓴다. */
export function visibilityLabelOf(post: Pick<Post, 'visibility'>, show?: boolean): string | null {
  return show && post.visibility !== 'PUBLIC' ? VISIBILITY_LABEL[post.visibility] : null;
}

/**
 * 독후감 상세의 작성자 줄 — 아바타 · 닉네임 · 메타(올린 때 · 조회 · 공개 범위).
 * 조판은 앱 공통 작성자 줄(완독 자랑·리뷰·홈 조각)과 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
 * 누르면 그 사람의 마이페이지로(팔로우는 거기서 한다). onPress 가 없으면 눌리지 않는 줄이다.
 */
export function PostByline({ post, showVisibility, showViews, onPress }: {
  post: Post;
  /** 공개 범위를 메타에 붙일지 — 공개 글은 켜도 붙지 않는다. */
  showVisibility?: boolean;
  /** 조회 수를 메타에 붙일지. */
  showViews?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const when = formatRelative(post.publishedAt ?? post.createdAt);
  const visibility = visibilityLabelOf(post, showVisibility);
  const metaText = [typeScale.monoLabel, styles.meta, { color: colors.textFaint }];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${post.authorNickname} 프로필 열기` : undefined}
      style={({ pressed }) => [styles.row, pressed ? pressedStyle : null]}
    >
      <Avatar uri={post.authorAvatarUrl} nickname={post.authorNickname} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
          {post.authorNickname}
        </Text>
        {/* 메타 — 올린 때 · 조회(눈 아이콘) · 공개 범위. 아이콘이 끼어 글자 한 줄이 아니라 행으로 잇는다. */}
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={[metaText, styles.shrink]}>{when}</Text>
          {showViews ? (
            <>
              <Text style={metaText}> · </Text>
              <ViewCount count={post.viewCount} textStyle={metaText} />
            </>
          ) : null}
          {visibility ? <Text style={metaText}> · {visibility}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1 },
  nickname: { lineHeight: 20 },
  // 닉네임과 메타는 한 덩어리 — 광학 보정 2px 만 띄운다.
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  meta: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14 },
  shrink: { flexShrink: 1 },
});
