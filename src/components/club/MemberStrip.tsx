import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MemberProgress, NudgeMessageKey } from '@/api/types';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import {
  Button, Card, ProgressBar, Tag, formatDuration, formatRelative, percent,
} from '@/components/ui';
import { getPaceStyle, hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

const AVATAR = 44;
const CHIP_W = 72;

/** 찌르기 프리셋 — 서버 NudgeMessageKey 와 1:1. */
export const NUDGES: { key: NudgeMessageKey; label: string }[] = [
  { key: 'READ_TOGETHER', label: '같이 읽어요' },
  { key: 'CHECKPOINT_SOON', label: '체크포인트 임박' },
  { key: 'WAITING', label: '기다리고 있어요' },
];

/**
 * 함께 읽는 사람 스트립 — 모임 홈 맨 위에서 서로의 진척을 한눈에 본다.
 * 아바타 아래 진척 막대 · 퍼센트, 지금 읽는 중이면 아바타 귀퉁이에 점, 그날 남긴 조각 수를 적는다.
 * 순서는 서버가 준 순위 그대로(앞이 1등). 누르면 아래에 그 사람의 자세한 진척과 찌르기가 펼쳐진다.
 */
export function MemberStrip({ members, readingNowIds, logCounts, selectedUserId, onSelect }: {
  members: MemberProgress[];
  /** 지금 읽는 중인 userId 들. */
  readingNowIds: Set<number>;
  /** userId → 고른 날짜에 남긴 조각 수. */
  logCounts: Map<number, number>;
  selectedUserId: number | null;
  onSelect: (member: MemberProgress) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {members.map((member) => {
        const selected = member.userId === selectedUserId;
        const live = readingNowIds.has(member.userId);
        const count = logCounts.get(member.userId) ?? 0;
        const rate = member.shareProgress ? member.completionRate : null;
        const status = member.finished ? '완독' : rate == null ? '비공개' : percent(rate);
        const statusColor = member.finished ? colors.accent : rate == null ? colors.textFaint : colors.text;
        return (
          <Pressable
            key={member.clubMemberId}
            onPress={() => onSelect(member)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${member.nickname}${member.isMe ? ' (나)' : ''} ${status}${live ? ', 지금 읽는 중' : ''}${count > 0 ? `, 조각 ${count}개` : ''}`}
            style={[
              styles.chip,
              { borderColor: selected ? colors.accent : 'transparent' },
              selected && { backgroundColor: colors.surfaceRaised },
            ]}
          >
            <View>
              <View style={[styles.avatarRing, { borderColor: member.isMe ? colors.accent : 'transparent' }]}>
                <QuoteAvatar uri={member.avatarUrl} nickname={member.nickname} size={AVATAR} />
              </View>
              {live ? (
                <View style={[styles.liveDot, { backgroundColor: colors.accent, borderColor: colors.bg }]} />
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
              {member.isMe ? '나' : member.nickname}
            </Text>
            <View style={styles.bar}>
              <ProgressBar value={member.finished ? 1 : rate ?? 0} height={4} />
            </View>
            <Text style={[styles.status, { color: statusColor }]}>{status}</Text>
            <Text style={[styles.count, { color: count > 0 ? colors.textMuted : colors.textFaint }]}>
              {count > 0 ? `${count}조각` : '·'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * 스트립에서 고른 한 사람 — 쪽 · 퍼센트 · 읽은 시간 · 마지막 읽기, 찌를 수 있으면 프리셋 버튼.
 * 옛 홈의 '멤버 진척' 목록과 찌르기 카드를 이 한 장으로 합쳤다.
 */
export function MemberDetail({ member, nudging, onNudge, onClose }: {
  member: MemberProgress;
  nudging?: boolean;
  onNudge?: (userId: number, key: NudgeMessageKey) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const pace = member.paceStatus ? getPaceStyle(colors)[member.paceStatus] : null;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.detailHead}>
        <Text style={[typeScale.label, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
          {member.nickname}{member.isMe ? ' (나)' : ''}
        </Text>
        {member.role === 'HOST' ? <Tag label="호스트" /> : null}
        {member.finished ? <Tag label="완독" fg={colors.accent} bg={colors.accentSoft} /> : null}
        {pace && !member.finished ? <Tag label={pace.label} fg={pace.fg} bg={pace.bg} /> : null}
      </View>

      {member.shareProgress ? (
        <>
          <ProgressBar value={member.completionRate} height={5} />
          <View style={styles.detailMeta}>
            <Text style={[styles.detailNumeral, { color: colors.textMuted }]}>
              {member.currentPage ?? 0}쪽 · {percent(member.completionRate)} · {formatDuration(member.totalDurationSec)}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {formatRelative(member.lastReadAt)}
            </Text>
          </View>
        </>
      ) : (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>진척을 공개하지 않은 멤버예요.</Text>
      )}

      {member.nudgeable && onNudge ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            찌르기 — 프리셋 문구만, 같은 사람에게 24시간에 한 번.
          </Text>
          <View style={styles.nudgeButtons}>
            {NUDGES.map((item) => (
              <Button
                key={item.key}
                label={item.label}
                size="sm"
                variant="outline"
                style={{ flexGrow: 1 }}
                loading={nudging}
                onPress={() => onNudge(member.userId, item.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Button label="닫기" variant="ghost" size="sm" onPress={onClose} />
    </Card>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    width: CHIP_W,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: hairline,
  },
  avatarRing: { borderWidth: 2, borderRadius: radius.pill, padding: 1 },
  liveDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  name: { ...typeScale.caption, fontSize: 11, lineHeight: 15, marginTop: 2, maxWidth: CHIP_W - spacing.xs * 2 },
  bar: { width: CHIP_W - spacing.md * 2 },
  status: { fontFamily: mono.semiBold, fontSize: 11 },
  count: { fontFamily: mono.regular, fontSize: 9.5, letterSpacing: 0.4 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  detailMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  detailNumeral: { fontFamily: mono.regular, fontSize: 11 },
  nudgeButtons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
