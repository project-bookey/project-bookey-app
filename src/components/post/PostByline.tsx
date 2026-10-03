import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { formatRelative } from '@/components/ui';
import { pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 공개 범위 라벨 — 공개는 굳이 말하지 않으므로 여기 없다. */
export const VISIBILITY_LABEL = { PRIVATE: '비공개', LINK: '링크', CLUB: '클럽만' } as const;

/**
 * 독후감 작성자 줄 — 아바타 · 닉네임 · 메타(올린 때, 필요하면 공개 범위). 카드와 상세가 같은 조판을 쓴다.
 * 공개 범위는 태그가 아니라 메타 글자로 붙인다 — 프로필 조각의 메타 줄과 같은 자리다.
 * 누르면 그 사람의 마이페이지로(팔로우는 거기서 한다). onPress 가 없으면 눌리지 않는 줄이다.
 */
export function PostByline({ post, showVisibility, onPress }: {
  post: Post;
  /** 공개 범위를 메타에 붙일지 — 공개 글은 켜도 붙지 않는다. */
  showVisibility?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const visibility = showVisibility && post.visibility !== 'PUBLIC' ? VISIBILITY_LABEL[post.visibility] : null;
  const when = formatRelative(post.publishedAt ?? post.createdAt);

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
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
          {visibility ? `${when} · ${visibility}` : when}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1 },
  nickname: { fontSize: 16, lineHeight: 22 },
  // 닉네임과 메타는 한 덩어리 — 광학 보정 2px 만 띄운다.
  meta: { fontSize: 12, letterSpacing: 0.3, lineHeight: 17, marginTop: 2 },
});
