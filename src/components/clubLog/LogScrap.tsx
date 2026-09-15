import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubPost } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { useTheme } from '@/theme';
import { mono, radius, serif, spacing, tiltFor, typeScale } from '@/theme/tokens';
import { kstTime } from './dates';

/** 반응 4종 — 토론 글과 같은 종류·이름. */
export const LOG_REACTIONS = [
  { kind: 'LIKE', label: '좋아요' },
  { kind: 'FIRE', label: '뜨겁다' },
  { kind: 'CRY', label: '울컥' },
  { kind: 'THINK', label: '생각중' },
] as const;

/**
 * 읽기로그 조각 하나 — 사진 조각은 폴라로이드, 글만 남긴 조각은 메모 조각, 가려진 조각은 빗금 폴라로이드.
 * 기울기는 목록 순서(index)로 정해 다시 그려도 조각이 튀지 않는다.
 */
export function LogScrap({ log, index, myPage, selected, onOpen, onToggleReactions, onReveal, onReact }: {
  log: ClubPost;
  index: number;
  /** 뷰어의 현재 쪽 — 가려진 조각에 '내 진도'를 함께 적는다. */
  myPage?: number | null;
  /** 반응 줄이 열려 있는지(길게 눌러 연다). */
  selected: boolean;
  /** 탭 — 조각을 펼쳐 한 마디까지 본다. */
  onOpen: () => void;
  /** 길게 누르기 — 보드에서 바로 반응만 남긴다. */
  onToggleReactions: () => void;
  onReveal: () => void;
  onReact: (kind: string) => void;
}) {
  const { colors, cardShadow } = useTheme();
  const rotate = `${tiltFor(index)}deg`;
  const meta = `${log.authorNickname} · ${kstTime(log.createdAt)}${log.anchorPage != null ? ` · ${log.anchorPage}쪽` : ''}`;
  const tail = [
    log.reactionCount > 0 ? `반응 ${log.reactionCount}` : null,
    log.commentCount > 0 ? `한 마디 ${log.commentCount}` : null,
  ].filter(Boolean).join(' · ');
  const reactionTotal = tail ? ` · ${tail}` : '';

  const reactions = selected && !log.masked ? (
    <View style={styles.reactions}>
      {LOG_REACTIONS.map(({ kind, label }) => {
        const on = log.myReactions.includes(kind);
        return (
          <Pressable
            key={kind}
            onPress={() => onReact(kind)}
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
  ) : null;

  if (log.masked) {
    return (
      <Pressable
        onPress={onReveal}
        accessibilityRole="button"
        accessibilityLabel={`${log.anchorPage ?? ''}쪽 조각, 눌러서 그래도 보기`}
        style={[styles.polaroid, { backgroundColor: colors.memoPad, transform: [{ rotate }] }, cardShadow]}
      >
        <View style={[styles.photo, styles.maskedPhoto, { backgroundColor: colors.surfaceRaised }]}>
          <LockGlyph color={colors.textMuted} />
          <Text style={[styles.maskedTitle, { color: colors.text }]}>
            {log.anchorPage != null ? `${log.anchorPage}쪽 조각` : '가려진 조각'}
          </Text>
        </View>
        <Text style={[styles.caption, { color: colors.onMemoPad }]}>
          {log.anchorPage != null ? `${log.anchorPage}쪽까지 읽으면 열려요` : '완독하면 열려요'}
        </Text>
        <Text style={[styles.meta, { color: colors.mid }]}>
          {log.authorNickname}{myPage != null ? ` · 내 진도 ${myPage}쪽` : ''}
        </Text>
        <Text style={[styles.revealHint, { color: colors.onMemoPad }]}>그래도 볼래요 →</Text>
      </Pressable>
    );
  }

  if (!log.imageUrl) {
    return (
      <View>
        <Pressable
          onPress={onOpen}
          onLongPress={onToggleReactions}
          accessibilityRole="button"
          accessibilityHint="눌러서 펼치기, 길게 눌러 반응 남기기"
        >
          <MemoScrap rotate={tiltFor(index) / 2}>
            <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>{log.body}</Text>
            <Text style={[styles.meta, { color: colors.textFaint, marginTop: spacing.sm }]}>{meta}{reactionTotal}</Text>
          </MemoScrap>
        </Pressable>
        {/* 반응 버튼은 조각 Pressable 밖에 둔다 — 웹에서 button 안에 button 이 들어가지 않게. */}
        {reactions}
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={onOpen}
        onLongPress={onToggleReactions}
        accessibilityRole="button"
        accessibilityHint="눌러서 펼치기, 길게 눌러 반응 남기기"
        style={[styles.polaroid, { backgroundColor: colors.memoPad, transform: [{ rotate }] }, cardShadow]}
      >
        <View style={[styles.tape, { backgroundColor: colors.bookPage }]} />
        <Image source={{ uri: log.imageUrl }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        {log.body ? <Text style={[styles.caption, { color: colors.onMemoPad }]}>{log.body}</Text> : null}
        <Text style={[styles.meta, { color: colors.mid }]}>{meta}{reactionTotal}</Text>
      </Pressable>
      {reactions}
    </View>
  );
}

/** 자물쇠 — 선 굵기 1.6 의 단순한 도형. SVG 의존 없이 View 로 그린다(웹·네이티브 공용). */
function LockGlyph({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  polaroid: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
    borderRadius: radius.sm,
  },
  tape: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 52,
    height: 16,
    opacity: 0.4,
    zIndex: 1,
    transform: [{ rotate: '4deg' }],
  },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 1 },
  maskedPhoto: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  maskedTitle: { fontFamily: mono.semiBold, fontSize: 11 },
  caption: { fontFamily: serif.regular, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  meta: { fontFamily: mono.regular, fontSize: 9.5, letterSpacing: 0.4, marginTop: spacing.xs },
  revealHint: { ...typeScale.label, fontSize: 11, marginTop: spacing.sm },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  reaction: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  lockShackle: {
    width: 12,
    height: 9,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  lockBody: { width: 18, height: 13, borderWidth: 1.6, borderRadius: 2 },
});
