import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPost } from '@/api/types';
import { Chip } from '@/components/collage';
import { Button, EmptyState, Loading, Numeral, Tag, formatRelative, linkLabel } from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, pressedStyle, serif } from '@/theme/tokens';

const TYPE_LABEL: Record<string, string> = {
  DISCUSSION: '토론',
  QUESTION: '질문',
  QUOTE: '인용',
  NOTICE: '공지',
  CHECKPOINT: '체크포인트',
};

/**
 * 클럽 토론 (§12.3) — 클럽 홈 '토론' 탭의 본문. 괘선 머리줄(내 진도까지 칩 · 개수) 아래 글을
 * 카드 없이 괘선으로 나눠 한 편씩(작성자 · 종류 · 쪽 · 시각, 명조 본문, 잉크 반응 칩, 한 마디).
 *
 * 스포일러 가드는 서버가 강제한다 — 내 진도보다 앞선 글은 본문 없이(masked=true) 내려온다.
 * 여기서는 그 사실을 사용자에게 설명하고, "그래도 볼래요"를 눌렀을 때만 서버에 해제를 요청한다.
 */
export function ClubPostsBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [onlyMyRange, setOnlyMyRange] = useState(true);
  const [body, setBody] = useState('');
  const [anchorPage, setAnchorPage] = useState('');

  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => clubApi.home(clubId) });
  const posts = useQuery({
    queryKey: ['club', clubId, 'posts', onlyMyRange],
    queryFn: () => clubApi.posts(clubId, onlyMyRange),
    enabled: Number.isFinite(clubId),
  });

  const myPage = club.data?.members.find((m) => m.isMe)?.currentPage ?? 0;

  const create = useMutation({
    mutationFn: () =>
      clubApi.createPost(clubId, {
        body: body.trim(),
        anchorPage: anchorPage ? Number(anchorPage) : undefined,
        spoilerLevel: anchorPage ? 'PAGE' : 'NONE',
      }),
    onSuccess: () => {
      setBody('');
      setAnchorPage('');
      queryClient.invalidateQueries({ queryKey: ['club', clubId, 'posts'] });
    },
  });

  const reveal = useMutation({
    mutationFn: (postId: number) => clubApi.reveal(clubId, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', clubId, 'posts'] }),
  });

  const react = useMutation({
    mutationFn: ({ postId, kind }: { postId: number; kind: string }) =>
      clubApi.react(clubId, postId, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', clubId, 'posts'] }),
  });

  const items = posts.data?.content ?? [];

  return (
    <>
      {/*
        오프셋을 주지 않는다. 기존 90 은 네이티브 헤더 높이를 상쇄하려던 값인데,
        헤더를 끄면서 KAV 의 frame.y 가 이미 SubHeader 를 포함하게 됐다. 그대로 두면
        iOS 에서 이중 보정돼 컴포저가 키보드 위로 90px 떠버린다. (login.tsx 도 무오프셋)
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <Chip
            label="내 진도까지"
            active={onlyMyRange}
            onPress={() => setOnlyMyRange((prev) => !prev)}
            accessibilityLabel={onlyMyRange ? '내 진도까지만 보기 켜짐' : '내 진도까지만 보기 꺼짐'}
          />
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
            토론 · {items.length}개 · 내 진도 {myPage}쪽
          </Text>
        </View>

        {posts.isLoading ? <Loading /> : null}

        <ScrollView contentContainerStyle={styles.list}>
          {!posts.isLoading && items.length === 0 ? (
            <EmptyState
              title="아직 글이 없어요"
              description={
                onlyMyRange
                  ? '내 진도보다 앞선 글은 숨겨져 있습니다. 첫 글을 남겨보세요.'
                  : '첫 글을 남겨보세요. 페이지를 지정하면 진도가 느린 사람에게는 가려집니다.'
              }
            />
          ) : null}

          {items.map((post) => (
            <PostEntry
              key={post.id}
              post={post}
              colors={colors}
              onReveal={() => reveal.mutate(post.id)}
              onReact={(kind) => react.mutate({ postId: post.id, kind })}
            />
          ))}
        </ScrollView>

        {/* 컴포저 — 종이 상자 + 헤어라인(채팅 입력과 같은 언어), 기준 쪽은 모노 밑줄 입력 */}
        <View style={[styles.composer, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="이 책에 대해 이야기해요"
            placeholderTextColor={colors.textFaint}
            style={[
              styles.composerInput,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line },
            ]}
            multiline
          />
          <View style={styles.composerFooter}>
            <View style={styles.anchorField}>
              <Text style={[typeScale.monoEyebrow, styles.anchorLabel, { color: colors.textMuted }]}>기준 쪽</Text>
              <TextInput
                value={anchorPage}
                onChangeText={(t) => setAnchorPage(t.replace(/[^0-9]/g, ''))}
                placeholder={String(myPage)}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={[styles.anchorInput, { borderBottomColor: colors.lineStrong, color: colors.text }]}
              />
              <Text numberOfLines={1} style={[typeScale.caption, styles.anchorHint, { color: colors.textFaint }]}>
                비우면 전체 공개
              </Text>
            </View>
            <Button
              label="올리기"
              size="sm"
              disabled={body.trim().length === 0}
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

/** 글 한 편 — 괘선으로만 나눈다. 가려진 글은 점선 상자, 반응은 잉크 반전 칩. */
function PostEntry({ post, colors, onReveal, onReact }: {
  post: ClubPost;
  colors: ColorTokens;
  onReveal: () => void;
  onReact: (kind: string) => void;
}) {
  return (
    <View style={[styles.post, { borderBottomColor: colors.line }]}>
      <View style={styles.postHead}>
        <Text style={[typeScale.label, { color: colors.text }]}>{post.authorNickname}</Text>
        <Tag label={TYPE_LABEL[post.type] ?? post.type} />
        {post.anchorPage != null ? (
          <Numeral style={[styles.anchor, { color: colors.textMuted }]}>p.{post.anchorPage}</Numeral>
        ) : null}
        <Text style={[styles.time, { color: colors.textFaint }]}>{formatRelative(post.createdAt)}</Text>
      </View>

      {post.masked ? (
        <Pressable
          onPress={onReveal}
          accessibilityRole="button"
          accessibilityLabel="가려진 글, 눌러서 그래도 보기"
          style={({ pressed }) => [styles.masked, { borderColor: colors.lineStrong }, pressed ? pressedStyle : null]}
        >
          <View style={styles.maskedLines}>
            <View style={[styles.maskedLine, { width: '92%', backgroundColor: colors.line }]} />
            <View style={[styles.maskedLine, { width: '78%', backgroundColor: colors.line }]} />
            <View style={[styles.maskedLine, { width: '54%', backgroundColor: colors.line }]} />
          </View>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {post.anchorPage != null
              ? `${post.anchorPage}쪽 기준 글입니다`
              : '완독자에게만 보이는 글입니다'}
          </Text>
          <Text style={[typeScale.label, { color: colors.text }]}>{linkLabel('그래도 볼래요', 'action')}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.body, { color: colors.text }]}>{post.body}</Text>
      )}

      {!post.masked ? (
        <View style={styles.postFooter}>
          <View style={styles.reactions}>
            {['LIKE', 'FIRE', 'CRY', 'THINK'].map((kind) => {
              const on = post.myReactions.includes(kind);
              return (
                <Pressable
                  key={kind}
                  onPress={() => onReact(kind)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.reaction,
                    { borderColor: colors.line },
                    on && { backgroundColor: colors.ink, borderColor: colors.ink },
                    pressed ? pressedStyle : null,
                  ]}
                >
                  <Text
                    style={[typeScale.monoLabel, { color: on ? colors.onInk : colors.textMuted }]}
                  >
                    {reactionLabel(kind)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {post.commentCount > 0 ? (
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              한 마디 {post.commentCount}
            </Text>
          ) : null}
        </View>
      ) : null}

      {post.comments.length > 0 ? (
        <View style={[styles.comments, { borderTopColor: colors.line }]}>
          {post.comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
                {comment.authorNickname}
              </Text>
              <Text style={[styles.commentBody, { color: colors.textMuted }]}>
                {comment.body ?? '(가려진 댓글)'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function reactionLabel(kind: string): string {
  switch (kind) {
    case 'LIKE': return '좋아요';
    case 'FIRE': return '뜨겁다';
    case 'CRY': return '울컥';
    default: return '생각중';
  }
}

const styles = StyleSheet.create({
  head: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: hairline,
  },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  post: { paddingVertical: spacing.lg, gap: spacing.sm, borderBottomWidth: hairline },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  anchor: { fontSize: 11 },
  time: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.3, marginLeft: 'auto' },
  // 토론 본문은 인용 활자로 — 종이 위 손글씨 톤을 유지한다.
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 25 },
  masked: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  maskedLines: { gap: 6 },
  maskedLine: { height: 9, borderRadius: radius.sm },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  reactions: { flexDirection: 'row', gap: spacing.xs },
  reaction: {
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  comments: {
    borderTopWidth: hairline,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  comment: { gap: 2 },
  commentBody: { ...typeScale.caption, lineHeight: 17 },
  composer: {
    ...layout.content,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: hairline,
  },
  composerInput: {
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: hairline,
    borderRadius: radius.sm,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  anchorField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  anchorLabel: { flexShrink: 0 },
  anchorHint: { flexShrink: 1 },
  anchorInput: {
    borderBottomWidth: hairline,
    fontFamily: mono.semiBold,
    fontSize: 14,
    width: 56,
    paddingVertical: 2,
    textAlign: 'center',
  },
});

/** 딥링크 호환 — 토론은 이제 클럽 홈의 탭이다. */
export default function ClubPostsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/club/[id]', params: { id, tab: 'posts' } }} />;
}
