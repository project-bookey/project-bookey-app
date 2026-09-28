import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubNotePageSummary } from '@/api/types';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { formatRelative } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { NoteCanvas } from './NoteCanvas';
import { CANVAS, parseDoc } from './noteDoc';
import { useNotePageQuery } from './queries';

/**
 * 모두의 노트 피드 카드 — 만든 사람 줄(아바타·닉네임·시간) → 페이지 미리보기(3:4, 읽기 전용) → 제목.
 * 요약엔 문서가 없어 카드마다 페이지를 받아 그린다(react-query 캐시라 편집 화면과 공유된다).
 */
export function NoteFeedCard({ clubId, summary, width, onPress }: {
  clubId: number;
  summary: ClubNotePageSummary;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const page = useNotePageQuery(clubId, summary.id);
  const doc = useMemo(() => (page.data ? parseDoc(page.data.document) : null), [page.data]);
  const author = page.data?.createdBy ?? summary.updatedBy ?? null;
  const editor = summary.updatedBy ?? null;
  const title = summary.title && summary.title.length > 0 ? summary.title : `${summary.seq}쪽`;
  const height = Math.round((width * CANVAS.h) / CANVAS.w);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} 열기`}
      style={({ pressed }) => [styles.card, pressed ? pressedStyle : null]}
    >
      <View style={styles.head}>
        <QuoteAvatar uri={author?.avatarUrl} nickname={author?.nickname ?? '알 수 없음'} size={30} />
        <View style={styles.headText}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{author?.nickname ?? '알 수 없음'}</Text>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {formatRelative(summary.updatedAt)}
            {editor && author && editor.userId !== author.userId ? ` · ${editor.nickname}님이 마지막으로 고침` : ''}
          </Text>
        </View>
      </View>
      {doc ? (
        <NoteCanvas doc={doc} width={width} />
      ) : (
        <View style={[styles.placeholder, { width, height, backgroundColor: colors.surface, borderColor: colors.line }]} />
      )}
      <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  placeholder: { borderWidth: hairline, borderRadius: radius.md },
  title: { fontSize: 18, lineHeight: 26 },
});
