import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PostcardView } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { StampIcon } from '@/components/collage';
import { Card, DeleteAction, Eyebrow, FootAction, TextLink } from '@/components/ui';
import { iconSize, pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 날짜·시각 — "10월 3일 오후 9:52". 올해가 아니면 연도를 앞에 붙인다. */
function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString('ko-KR', {
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/**
 * 펼친 엽서 — 엽서 화면(/postcard/[id])의 몸통. 위에 보낸·받은 사람과 시각, 가운데 16글자 본문을 부리 서체로 크게,
 * 발치에 우표 동봉 표시와 차단·삭제(작은 단추 — 화면 아래 답장 단추와 떨어뜨린다). 답장이 오갔으면 그 아래에 답장 종이를 한 장 더 둔다.
 * 상대 프로필은 지금까지처럼 답장이 오간 뒤에만 연다.
 */
export function PostcardLetter({ card, confirmingDelete, onDelete, onBlock }: {
  card: PostcardView;
  confirmingDelete: boolean;
  onDelete: () => void;
  onBlock: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  // mine = 내가 보낸 엽서(서버가 보낸 사람으로 정한다).
  const inbox = !card.mine;
  const name = inbox ? card.fromNickname : card.toNickname;
  const avatar = inbox ? card.fromAvatarUrl : card.toAvatarUrl;
  const counterpartId = inbox ? card.fromUserId : card.toUserId;
  const replied = card.status === 'REPLIED';
  const postId = card.postId;

  return (
    <View style={styles.stack}>
      <Card style={styles.paper}>
        <Pressable
          onPress={replied ? () => router.push(`/user/${counterpartId}`) : undefined}
          disabled={!replied}
          accessibilityRole={replied ? 'button' : undefined}
          accessibilityLabel={replied ? `${name}님 프로필` : undefined}
          style={({ pressed }) => [styles.person, pressed && pressedStyle]}
        >
          <Avatar uri={avatar} nickname={name} />
          <View style={styles.personText}>
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
              {inbox ? `${name}에게서` : `${name}에게`}
            </Text>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{formatDateTime(card.createdAt)}</Text>
          </View>
        </Pressable>

        {card.postTitle ? (
          postId != null ? (
            <TextLink
              label={`『${card.postTitle}』 독후감을 보고`}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(postId) } })}
              numberOfLines={1}
            />
          ) : (
            <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textFaint }]}>
              『{card.postTitle}』 독후감을 보고
            </Text>
          )
        ) : null}

        <Text selectable style={[typeScale.titleSerif, { color: colors.text }]}>{card.body}</Text>

        <View style={styles.foot}>
          {card.stampAttached ? (
            <View style={styles.stamp}>
              <StampIcon size={iconSize.inline} color={colors.textMuted} />
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>우표 동봉 — 무료 답장</Text>
            </View>
          ) : <View />}
          <View style={styles.actions}>
            <FootAction label="차단" size="xs" onPress={onBlock} accessibilityLabel={`${name}님 차단`} />
            <DeleteAction target="엽서" size="xs" confirming={confirmingDelete} onPress={onDelete} />
          </View>
        </View>
      </Card>

      {replied && card.replyBody ? (
        <Card style={styles.paper}>
          <Eyebrow>{inbox ? '내 답장' : `${name}님의 답장`}</Eyebrow>
          <Text selectable style={[typeScale.titleSerif, { color: colors.text }]}>{card.replyBody}</Text>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{formatDateTime(card.repliedAt)}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 엽서와 답장은 다른 종이 — 종이 사이(lg)를 종이 안 묶음 간격(md)보다 넓게 둔다.
  stack: { gap: spacing.lg },
  paper: { gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', maxWidth: '100%' },
  personText: { flexShrink: 1, gap: 2 },
  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
