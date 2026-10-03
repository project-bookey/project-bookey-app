import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubPost } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/theme';
import { hairline, mono, pressedStyle, radius, sans, serif, spacing } from '@/theme/tokens';
import { kstTime } from './dates';

/** 반응 4종. */
export const LOG_REACTIONS = [
  { kind: 'LIKE', label: '좋아요' },
  { kind: 'FIRE', label: '뜨겁다' },
  { kind: 'CRY', label: '울컥' },
  { kind: 'THINK', label: '생각중' },
] as const;

const AVATAR = 24;
const THUMB = 44;

/**
 * 클럽 홈 '읽기 조각'의 한 줄 — 누가 · 몇 쪽 · 한 줄, 사진이 있으면 오른쪽에 작은 썸네일.
 * 홈에서는 몇 개만 짧게 보여 주고, 누르면 조각 상세(사진 · 한 마디 · 반응)로 간다.
 * 내 진도보다 앞선 조각은 내용을 숨기고 '가려진 조각'으로만 적는다 — 상세에서 그래도 볼 수 있다.
 */
export function LogLine({ log, onOpen }: { log: ClubPost; onOpen: () => void }) {
  const { colors } = useTheme();
  const page = log.anchorPage != null ? `${log.anchorPage}쪽` : null;
  const text = log.masked
    ? `가려진 조각${page ? ` · ${page}까지 읽으면 열려요` : ''}`
    : log.body || '사진 한 장';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${log.authorNickname}의 조각, ${text}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && pressedStyle]}
    >
      <Avatar uri={log.authorAvatarUrl} nickname={log.authorNickname} size={AVATAR} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Text numberOfLines={1} style={[styles.author, { color: colors.text }]}>{log.authorNickname}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {[page, kstTime(log.createdAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[log.masked ? styles.masked : styles.text, { color: log.masked ? colors.textMuted : colors.text }]}
        >
          {text}
        </Text>
      </View>
      {log.imageUrl && !log.masked ? (
        <Image
          source={{ uri: log.imageUrl }}
          style={[styles.thumb, { backgroundColor: colors.surfaceRaised }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
  },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  author: { fontFamily: sans.semiBold, fontSize: 13, flexShrink: 1 },
  meta: { fontFamily: mono.regular, fontSize: 11 },
  text: { fontFamily: serif.regular, fontSize: 14, lineHeight: 21 },
  masked: { fontFamily: sans.regular, fontSize: 13, lineHeight: 21 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm },
});
