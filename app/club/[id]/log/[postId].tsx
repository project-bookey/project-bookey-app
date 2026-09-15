import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import type { ClubPost } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { LOG_REACTIONS, clubLogKeys, kstTime } from '@/components/clubLog';
import { Button, Loading, Rule, Toggle, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

/** 한 줄 길이 — 서버의 조각 본문 상한과 같은 값. */
const BODY_MAX = 100;
/** 한 마디 길이 — 모임 글과 같은 상한을 쓰되, 조각 아래 짧게 주고받는 자리라 넉넉히 두지 않는다. */
const TALK_MAX = 300;

/**
 * 조각 한 장 — 보드에서 조각을 누르면 열린다.
 *
 * 사진과 한 줄을 크게 보고, 반응과 한 마디를 남기는 자리다. 내가 남긴 조각이면
 * 여기서 바로 고치고 지운다(사진은 그 순간의 기록이라 바꾸지 않는다).
 */
export default function ClubLogScrapScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, cardShadow } = useTheme();
  const { id, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const clubId = Number(id);
  const scrapId = Number(postId);

  const [talk, setTalk] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState('');
  const [anchor, setAnchor] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<'scrap' | number>();

  const scrap = useQuery({
    queryKey: clubLogKeys.scrap(clubId, scrapId),
    queryFn: () => clubApi.post(clubId, scrapId),
    enabled: Number.isFinite(clubId) && Number.isFinite(scrapId),
  });
  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
  });

  const me = club.data?.members.find((m) => m.isMe);
  const mine = scrap.data != null && me != null && scrap.data.authorId === me.userId;
  const ended = club.data?.status === 'ENDED' || club.data?.status === 'ARCHIVED';

  /** 조각·보드·요일 스트립이 한꺼번에 어긋나므로 같이 새로 받는다. */
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: clubLogKeys.scrap(clubId, scrapId) });
    queryClient.invalidateQueries({ queryKey: clubLogKeys.all(clubId) });
  };

  const react = useMutation({
    mutationFn: (kind: string) => clubApi.react(clubId, scrapId, kind),
    onSuccess: refresh,
  });
  const reveal = useMutation({
    mutationFn: () => clubApi.reveal(clubId, scrapId),
    onSuccess: refresh,
  });
  const speak = useMutation({
    mutationFn: () => clubApi.createPost(clubId, { body: talk.trim(), parentId: scrapId }),
    onSuccess: () => { setTalk(''); refresh(); },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : '한 마디를 남기지 못했어요 · 다시 시도'),
  });
  const save = useMutation({
    mutationFn: () => {
      const at = page.trim() ? Number(page) : undefined;
      return clubApi.updatePost(clubId, scrapId, {
        body: draft.trim(),
        anchorPage: at,
        spoilerLevel: at != null && anchor ? 'PAGE' : 'NONE',
      });
    },
    onSuccess: () => { setEditing(false); setNotice(null); refresh(); },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : '고치지 못했어요 · 다시 시도'),
  });
  const remove = useMutation({
    mutationFn: (target: number) => clubApi.deletePost(clubId, target),
    onSuccess: (_r, target) => {
      refresh();
      if (target === scrapId) router.back();
    },
  });

  const startEditing = () => {
    const data = scrap.data;
    if (!data) return;
    setDraft(data.body ?? '');
    setPage(data.anchorPage != null ? String(data.anchorPage) : '');
    setAnchor(data.spoilerLevel === 'PAGE');
    setNotice(null);
    setEditing(true);
  };

  if (scrap.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="조각" />
        <Loading />
      </PaperScreen>
    );
  }
  if (!scrap.data) {
    return (
      <PaperScreen>
        <SubHeader category="조각" />
        <Text style={[typeScale.body, { color: colors.danger, padding: spacing.lg }]}>
          조각을 불러오지 못했어요. 지워졌을 수도 있어요.
        </Text>
      </PaperScreen>
    );
  }

  const data = scrap.data;
  const talks = data.comments ?? [];
  const canSave = (draft.trim().length > 0 || data.imageUrl != null) && !save.isPending;

  return (
    <PaperScreen>
      <SubHeader category="조각" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {data.masked ? (
            <Pressable
              onPress={() => reveal.mutate()}
              accessibilityRole="button"
              style={[styles.polaroid, { backgroundColor: colors.memoPad }, cardShadow]}
            >
              <View style={[styles.photo, styles.maskedPhoto, { backgroundColor: colors.surfaceRaised }]}>
                <Text style={[styles.maskedTitle, { color: colors.text }]}>
                  {data.anchorPage != null ? `${data.anchorPage}쪽 조각` : '가려진 조각'}
                </Text>
              </View>
              <Text style={[styles.caption, { color: colors.onMemoPad }]}>
                {data.anchorPage != null
                  ? `${data.anchorPage}쪽까지 읽으면 열려요${me?.currentPage != null ? ` · 내 진도 ${me.currentPage}쪽` : ''}`
                  : '완독하면 열려요'}
              </Text>
              <Text style={[typeScale.label, { color: colors.onMemoPad, fontSize: 11 }]}>그래도 볼래요 →</Text>
            </Pressable>
          ) : (
            <View style={[styles.polaroid, { backgroundColor: colors.memoPad }, cardShadow]}>
              {data.imageUrl ? (
                <Image
                  source={{ uri: data.imageUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {editing ? (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={BODY_MAX}
                  multiline
                  placeholder="한 줄"
                  placeholderTextColor={colors.mid}
                  style={[styles.captionInput, { color: colors.onMemoPad, borderColor: colors.mid }]}
                  accessibilityLabel="한 줄 고치기"
                />
              ) : data.body ? (
                <Text style={[styles.caption, { color: colors.onMemoPad }]}>{data.body}</Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.mid }]}>
                {data.authorNickname} · {kstTime(data.createdAt)}
                {data.anchorPage != null ? ` · ${data.anchorPage}쪽` : ''}
                {data.editedAt ? ' · 수정됨' : ''}
              </Text>
            </View>
          )}

          {editing ? (
            <View style={styles.editBlock}>
              <View style={styles.pageField}>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>몇 쪽까지 읽었나요</Text>
                <TextInput
                  value={page}
                  onChangeText={(t) => setPage(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="비우면 쪽 없이"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.pageInput, { borderBottomColor: colors.line, color: colors.text }]}
                  accessibilityLabel="쪽"
                />
              </View>
              {page.trim() ? (
                <Toggle
                  label={`${page}쪽까지 읽은 사람에게만 보이기`}
                  description="끄면 쪽은 적어 두되 모두에게 보여요."
                  value={anchor}
                  onChange={setAnchor}
                />
              ) : null}
              <View style={styles.editActions}>
                <Button label="저장" size="sm" onPress={() => save.mutate()} loading={save.isPending} disabled={!canSave} />
                <Button label="그만두기" size="sm" variant="outline" onPress={() => { setEditing(false); setNotice(null); }} />
              </View>
            </View>
          ) : null}

          {!data.masked && !editing ? (
            <View style={styles.reactions}>
              {LOG_REACTIONS.map(({ kind, label }) => {
                const on = data.myReactions.includes(kind);
                return (
                  <Pressable
                    key={kind}
                    onPress={() => react.mutate(kind)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.reaction,
                      { borderColor: colors.line, backgroundColor: colors.bg },
                      on && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[typeScale.monoLabel, { color: on ? colors.onAccent : colors.textMuted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {mine && !editing && !ended ? (
            <View style={styles.ownerActions}>
              <Button label="고치기" size="sm" variant="outline" onPress={startEditing} />
              <Button
                label={confirm === 'scrap' ? '정말 지울까요?' : '지우기'}
                size="sm"
                variant="outline"
                loading={remove.isPending}
                onPress={() => {
                  if (confirm === 'scrap') { disarm(); remove.mutate(scrapId); } else arm('scrap');
                }}
              />
            </View>
          ) : null}

          {notice ? (
            <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">{notice}</Text>
          ) : null}

          {!data.masked ? (
            <View style={styles.talks}>
              <Rule />
              <Text style={[typeScale.label, { color: colors.textMuted }]}>
                한 마디{talks.length > 0 ? ` ${talks.length}` : ''}
              </Text>
              {talks.length === 0 ? (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  아직 조용해요. 먼저 한 마디 남겨 보세요.
                </Text>
              ) : (
                talks.map((t) => (
                  <TalkRow
                    key={t.id}
                    talk={t}
                    mine={me != null && t.authorId === me.userId}
                    confirming={confirm === t.id}
                    onDelete={() => {
                      if (confirm === t.id) { disarm(); remove.mutate(t.id); } else arm(t.id);
                    }}
                  />
                ))
              )}
            </View>
          ) : null}
        </ScrollView>

        {!data.masked && !ended ? (
          <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.line }]}>
            <TextInput
              value={talk}
              onChangeText={setTalk}
              maxLength={TALK_MAX}
              placeholder="한 마디 남기기"
              placeholderTextColor={colors.textFaint}
              style={[styles.composerInput, { color: colors.text }]}
              multiline
            />
            <Button
              label="남기기"
              size="sm"
              disabled={talk.trim().length === 0}
              loading={speak.isPending}
              onPress={() => speak.mutate()}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

/** 한 마디 한 줄 — 내 것이면 두 번 눌러 지운다. */
function TalkRow({ talk, mine, confirming, onDelete }: {
  talk: ClubPost;
  mine: boolean;
  confirming: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.talk, { borderTopColor: colors.line }]}>
      <View style={styles.talkHead}>
        <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{talk.authorNickname}</Text>
        <Text style={[typeScale.caption, { color: colors.textFaint, flex: 1 }]}>
          {formatRelative(talk.createdAt)}
        </Text>
        {mine ? (
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button">
            <Text style={[typeScale.caption, { color: confirming ? colors.danger : colors.textFaint }]}>
              {confirming ? '정말?' : '지우기'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.talkBody, { color: colors.text }]}>{talk.body ?? '(가려진 한 마디)'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  polaroid: { padding: spacing.md, paddingBottom: spacing.lg, borderRadius: radius.sm },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 1 },
  maskedPhoto: { alignItems: 'center', justifyContent: 'center' },
  maskedTitle: { fontFamily: mono.semiBold, fontSize: 12 },
  caption: { fontFamily: serif.regular, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  captionInput: {
    fontFamily: serif.regular,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
    borderBottomWidth: hairline,
    paddingBottom: spacing.xs,
    minHeight: 48,
  },
  meta: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.4, marginTop: spacing.sm },
  editBlock: { gap: spacing.md },
  pageField: { gap: spacing.xs },
  pageInput: { borderBottomWidth: hairline, paddingVertical: spacing.xs, fontFamily: mono.regular, fontSize: 15 },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reaction: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  ownerActions: { flexDirection: 'row', gap: spacing.sm },
  talks: { gap: spacing.sm },
  talk: { borderTopWidth: hairline, paddingTop: spacing.sm, gap: 4 },
  talkHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  talkBody: { fontFamily: serif.regular, fontSize: 15, lineHeight: 22 },
  composer: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: hairline,
  },
  composerInput: { flex: 1, fontFamily: serif.regular, fontSize: 15, maxHeight: 96, paddingVertical: spacing.xs },
});
