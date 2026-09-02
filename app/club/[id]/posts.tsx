import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPost } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Card, EmptyState, Loading, Numeral, Rule, Tag, formatRelative,
} from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

const TYPE_LABEL: Record<string, string> = {
  DISCUSSION: '토론',
  QUESTION: '질문',
  QUOTE: '인용',
  NOTICE: '공지',
  CHECKPOINT: '체크포인트',
};

/**
 * 모임 토론 (§12.3).
 *
 * 스포일러 가드는 서버가 강제한다 — 내 진도보다 앞선 글은 본문 없이(masked=true) 내려온다.
 * 여기서는 그 사실을 사용자에게 설명하고, "그래도 볼래요"를 눌렀을 때만 서버에 해제를 요청한다.
 */
export default function ClubPostsScreen() {
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
    <PaperScreen>
      <SubHeader category="토론" />

      {/*
        오프셋을 주지 않는다. 기존 90 은 네이티브 헤더 높이를 상쇄하려던 값인데,
        헤더를 끄면서 KAV 의 frame.y 가 이미 SubHeader 를 포함하게 됐다. 그대로 두면
        iOS 에서 이중 보정돼 컴포저가 키보드 위로 90px 떠버린다. (login.tsx 도 무오프셋)
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.filterBar, { borderBottomColor: colors.line }]}>
          <Pressable
            style={styles.filterToggle}
            onPress={() => setOnlyMyRange((prev) => !prev)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.textFaint },
                onlyMyRange && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            >
              {onlyMyRange ? (
                <Text style={[styles.checkboxMark, { color: colors.onAccent }]}>✓</Text>
              ) : null}
            </View>
            <Text style={[typeScale.label, { color: colors.text }]}>내 진도까지만 보기</Text>
          </Pressable>
          <Numeral style={[styles.myPage, { color: colors.textFaint }]}>{myPage}쪽</Numeral>
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
            <PostCard
              key={post.id}
              post={post}
              colors={colors}
              onReveal={() => reveal.mutate(post.id)}
              onReact={(kind) => react.mutate({ postId: post.id, kind })}
            />
          ))}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface }]}>
          <Rule />
          <View style={styles.composerRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="이 책에 대해 이야기해요"
              placeholderTextColor={colors.textFaint}
              style={[styles.composerInput, { color: colors.text }]}
              multiline
            />
          </View>
          <View style={styles.composerFooter}>
            <View style={styles.anchorField}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>기준 쪽</Text>
              <TextInput
                value={anchorPage}
                onChangeText={(t) => setAnchorPage(t.replace(/[^0-9]/g, ''))}
                placeholder={String(myPage)}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={[styles.anchorInput, { borderBottomColor: colors.line, color: colors.text }]}
              />
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>비우면 전체 공개</Text>
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
    </PaperScreen>
  );
}

function PostCard({ post, colors, onReveal, onReact }: {
  post: ClubPost;
  colors: ColorTokens;
  onReveal: () => void;
  onReact: (kind: string) => void;
}) {
  return (
    <Card style={styles.post}>
      <View style={styles.postHead}>
        <Text style={[typeScale.label, { color: colors.text }]}>{post.authorNickname}</Text>
        <Tag label={TYPE_LABEL[post.type] ?? post.type} />
        {post.anchorPage != null ? (
          <Numeral style={[styles.anchorBadge, { color: colors.accent }]}>p.{post.anchorPage}</Numeral>
        ) : null}
        <Text style={[typeScale.caption, styles.time, { color: colors.textFaint }]}>
          {formatRelative(post.createdAt)}
        </Text>
      </View>

      {post.masked ? (
        <Pressable
          style={[styles.masked, { borderColor: colors.line, backgroundColor: colors.surfaceDeep }]}
          onPress={onReveal}
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
          <Text style={[typeScale.label, { color: colors.accent }]}>그래도 볼래요</Text>
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
                  style={[
                    styles.reaction,
                    { borderColor: colors.line },
                    on && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[typeScale.monoLabel, { color: on ? colors.onAccent : colors.textMuted }]}
                  >
                    {reactionLabel(kind)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {post.commentCount > 0 ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              댓글 {post.commentCount}
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
    </Card>
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
  filterBar: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
  },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: radius.sm,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { fontFamily: mono.semiBold, fontSize: 11 },
  myPage: { fontSize: 12 },
  list: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  post: { gap: spacing.sm },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  anchorBadge: { fontSize: 11 },
  time: { marginLeft: 'auto' },
  // 토론 본문은 인용 활자로 — 종이 위 손글씨 톤을 유지한다.
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 25 },
  masked: {
    borderWidth: hairline,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  maskedLines: { gap: 6 },
  maskedLine: { height: 9, borderRadius: radius.pill },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  reactions: { flexDirection: 'row', gap: spacing.xs },
  reaction: {
    borderWidth: hairline,
    borderRadius: radius.pill,
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
  composer: { ...layout.content },
  composerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  composerInput: {
    minHeight: 44,
    maxHeight: 120,
    fontFamily: serif.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  anchorField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  anchorInput: {
    borderBottomWidth: hairline,
    fontFamily: mono.semiBold,
    fontSize: 14,
    minWidth: 44,
    paddingVertical: 2,
    textAlign: 'center',
  },
});
