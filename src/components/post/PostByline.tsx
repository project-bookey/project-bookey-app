import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Globe, Link, Lock, Users, type LucideIcon } from 'lucide-react-native';

import type { Post } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { ViewCount } from '@/components/post/ViewCount';
import { IconMeta, formatRelative } from '@/components/ui';
import { pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 공개 범위 라벨 — 읽어 줄 말(VisibilityMark). 공개는 메타에 굳이 밝히지 않는다. */
const VISIBILITY_LABEL = { PRIVATE: '비공개', LINK: '링크', CLUB: '클럽만' } as const;

/**
 * 공개 범위 아이콘 — 메타 줄에는 글자 대신 이 아이콘만 둔다(2026-10-05 사용자 결정). 공개 = 지구, 비공개 = 자물쇠,
 * 링크 = 고리, 클럽만 = 사람들. 스크린 리더는 '비공개'처럼 원래 말로 읽는다.
 */
const VISIBILITY_ICON: Record<Post['visibility'], LucideIcon> = { PUBLIC: Globe, PRIVATE: Lock, LINK: Link, CLUB: Users };

export function VisibilityMark({ visibility, color }: { visibility: Post['visibility']; color: string }) {
  const label = visibility === 'PUBLIC' ? '공개' : VISIBILITY_LABEL[visibility];
  return <IconMeta icon={VISIBILITY_ICON[visibility]} color={color} accessibilityLabel={`공개 범위 ${label}`} />;
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
  const showMark = showVisibility && post.visibility !== 'PUBLIC';
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
          {showMark ? (
            <>
              <Text style={metaText}> · </Text>
              <VisibilityMark visibility={post.visibility} color={colors.textFaint} />
            </>
          ) : null}
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
