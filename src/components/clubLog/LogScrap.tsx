import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubPost } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { linkLabel } from '@/components/ui';
import { useTheme } from '@/theme';
import { hairline, mono, pressedStyle, radius, sans, serif, spacing, typeScale } from '@/theme/tokens';
import { kstTime } from './dates';

/** 반응 4종. */
export const LOG_REACTIONS = [
  { kind: 'LIKE', label: '좋아요' },
  { kind: 'FIRE', label: '뜨겁다' },
  { kind: 'CRY', label: '울컥' },
  { kind: 'THINK', label: '생각중' },
] as const;

const AVATAR = 28;
/** 사진 비율 범위 — 세로 사진은 정사각까지만 세워 한 장이 화면을 다 차지하지 않게 한다. */
const MIN_RATIO = 1;
const MAX_RATIO = 1.91;
const DEFAULT_RATIO = 4 / 3;

function photoRatio(log: ClubPost): number {
  if (!log.imageWidth || !log.imageHeight) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, log.imageWidth / log.imageHeight));
}

/**
 * 소식 피드의 조각 하나 — 위에 누가 · 몇 쪽 · 언제, 아래에 사진 한 장과 한 줄을 화면 폭으로 세운다.
 * 내 진도보다 앞선 조각은 가린 채 두고, 누르면 그래도 펼쳐 본다.
 * 누르면 조각 상세(한 마디까지), 길게 누르면 그 자리에서 반응 줄을 연다 — 상세에도 같은 반응 버튼이 있다.
 */
export function LogScrap({ log, myPage, selected, onOpen, onToggleReactions, onReveal, onReact }: {
  log: ClubPost;
  /** 뷰어의 현재 쪽 — 가려진 조각에 '내 진도'를 함께 적는다. */
  myPage?: number | null;
  /** 반응 줄이 열려 있는지(길게 눌러 연다). */
  selected: boolean;
  /** 탭 — 조각을 펼쳐 한 마디까지 본다. */
  onOpen: () => void;
  /** 길게 누르기 — 피드에서 바로 반응만 남긴다. */
  onToggleReactions: () => void;
  onReveal: () => void;
  onReact: (kind: string) => void;
}) {
  const { colors } = useTheme();
  const tail = [
    log.reactionCount > 0 ? `반응 ${log.reactionCount}` : null,
    log.commentCount > 0 ? `한 마디 ${log.commentCount}` : null,
  ].filter(Boolean).join(' · ');

  const head = (
    <View style={styles.head}>
      <Avatar uri={log.authorAvatarUrl} nickname={log.authorNickname} size={AVATAR} />
      <Text numberOfLines={1} style={[styles.author, { color: colors.text }]}>{log.authorNickname}</Text>
      {log.anchorPage != null ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{log.anchorPage}쪽</Text>
      ) : null}
      <Text style={[styles.meta, styles.time, { color: colors.textMuted }]}>{kstTime(log.createdAt)}</Text>
    </View>
  );

  if (log.masked) {
    const opensAt = log.anchorPage != null ? `${log.anchorPage}쪽까지 읽으면 열려요` : '완독하면 열려요';
    return (
      <Pressable
        onPress={onReveal}
        accessibilityRole="button"
        accessibilityLabel={`${log.authorNickname}의 가려진 조각, ${opensAt}. 눌러서 그래도 보기`}
        style={({ pressed }) => [styles.item, pressed && pressedStyle]}
      >
        {head}
        <View style={[styles.masked, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
          <LockGlyph color={colors.textMuted} />
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {opensAt}{myPage != null ? ` · 내 진도 ${myPage}쪽` : ''}
          </Text>
          <Text style={[typeScale.label, { color: colors.text }]}>{linkLabel('그래도 볼래요', 'action')}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View>
      <Pressable
        onPress={onOpen}
        onLongPress={onToggleReactions}
        accessibilityRole="button"
        accessibilityHint="눌러서 펼치기, 길게 눌러 반응 남기기"
        style={({ pressed }) => [styles.item, pressed && pressedStyle]}
      >
        {head}
        {log.imageUrl ? (
          <Image
            source={{ uri: log.imageUrl }}
            style={[styles.photo, { aspectRatio: photoRatio(log), backgroundColor: colors.surfaceRaised }]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {log.body ? <Text style={[styles.body, { color: colors.text }]}>{log.body}</Text> : null}
        {tail ? <Text style={[styles.meta, { color: colors.textMuted }]}>{tail}</Text> : null}
      </Pressable>
      {/* 반응 버튼은 조각 Pressable 밖에 둔다 — 웹에서 button 안에 button 이 들어가지 않게. */}
      {selected ? (
        <View style={styles.reactions}>
          {LOG_REACTIONS.map(({ kind, label }) => {
            const on = log.myReactions.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => onReact(kind)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.reaction,
                  { borderColor: colors.line, backgroundColor: colors.bg },
                  on && { backgroundColor: colors.ink, borderColor: colors.ink },
                  pressed && pressedStyle,
                ]}
              >
                <Text style={[typeScale.monoLabel, { color: on ? colors.onInk : colors.textMuted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
  // 머리 줄 · 사진 · 한 줄은 한 묶음이라 sm 으로 붙인다(조각 사이는 피드가 xl 로 띄운다).
  item: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { fontFamily: sans.semiBold, fontSize: 13, flexShrink: 1 },
  meta: { fontFamily: mono.regular, fontSize: 11 },
  time: { marginLeft: 'auto' },
  photo: { width: '100%', borderRadius: radius.sm },
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  masked: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: hairline,
  },
  // 반응 칩은 44pt 터치 상자, 칩 사이는 sm 이상.
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  reaction: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
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
