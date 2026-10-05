import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import type { ClubPost } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/theme';
import { hairline, iconStroke, mono, pressedStyle, radius, sans, serif, spacing } from '@/theme/tokens';
import { kstTime } from './dates';

/** 반응 4종. */
export const LOG_REACTIONS = [
  { kind: 'LIKE', label: '좋아요' },
  { kind: 'FIRE', label: '뜨거워요' },
  { kind: 'CRY', label: '울컥해요' },
  { kind: 'THINK', label: '생각 중' },
] as const;

const AVATAR = 24;
const THUMB = 44;

/**
 * 클럽 홈 '메모'의 한 줄 — 누가 · 몇 쪽 · 한 줄, 사진이 있으면 오른쪽에 작은 썸네일.
 * 홈에서는 몇 개만 짧게 보여 주고, 누르면 조각 상세(사진 · 한 마디 · 반응)로 간다.
 * 내 진도보다 앞선 조각은 내용을 숨기고 자물쇠와 열리는 조건만 적는다(2026-10-05 사용자 결정 — '가려진 메모' 글자 대신 자물쇠).
 * 상세에서 그래도 볼 수 있다. 스크린 리더는 '가려진 메모'로 읽는다.
 */
export function LogLine({ log, onOpen }: { log: ClubPost; onOpen: () => void }) {
  const { colors } = useTheme();
  const page = log.anchorPage != null ? `${log.anchorPage}쪽` : null;
  const text = log.masked
    ? (page ? `${page}까지 읽으면 열려요` : '완독하면 열려요')
    : log.body || '사진 한 장';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${log.authorNickname}의 ${log.masked ? '가려진 메모' : '메모'}, ${text}`}
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
        <View style={styles.line}>
          {log.masked ? <Lock size={13} color={colors.textMuted} {...iconStroke} /> : null}
          <Text
            numberOfLines={1}
            style={[log.masked ? styles.masked : styles.text, styles.lineText, { color: log.masked ? colors.textMuted : colors.text }]}
          >
            {text}
          </Text>
        </View>
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
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lineText: { flexShrink: 1 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm },
});
