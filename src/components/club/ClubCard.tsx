import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubMemberBrief, ClubSummary } from '@/api/types';
import { StickyNote } from '@/components/collage';
import { Avatar } from '@/components/Avatar';
import { FootAction } from '@/components/ui';
import { ClubBackdrop } from './ClubBackdrop';
import { meetingDay } from './meetingTime';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

const AVATAR = 24;
const MAX_AVATARS = 4;
const BAND_H = 96;
/** FootAction(sm 버튼) 높이 — '관리'를 얹는 마지막 줄을 이만큼 세워 버튼과 가운데를 맞춘다. */
const MANAGE_H = 34;
/** 마지막 줄 오른쪽에 '관리' 버튼 몫으로 비워 두는 폭(버튼 폭 + 간격). */
const MANAGE_ROOM = 64;

/**
 * 내 클럽 카드 — 클럽은 책 한 권에 묶이지 않으므로 책 대신 클럽의 얼굴로 그린다.
 * 위 띠는 호스트가 올린 배경 사진(없으면 기본 배경 — ClubBackdrop)과 내가 참여한 가장 가까운 모임의 스티키,
 * 아래 본문은 이름 · 한 줄 소개 · 함께하는 사람 · (참여한 모임이 없을 때) 클럽의 다음 모임.
 * 카드 본문은 누르면 클럽 홈으로. 호스트에게만 붙는 '관리'(FootAction)는 본문 마지막 줄 오른쪽에 얹는다 —
 * 버튼 혼자 한 줄을 차지하지 않게. 본문 Pressable 의 형제로 둬 웹에서 button 안에 button 이 들어가지 않게 한다.
 */
export function ClubCard({ club, onPress, onManage }: {
  club: ClubSummary;
  onPress: () => void;
  onManage?: () => void;
}) {
  const { colors, cardShadow } = useTheme();
  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';
  // 스티키 날짜는 내가 참여한 모임 중 가장 가까운 것 — 참여한 모임이 없으면 붙이지 않는다.
  const note = ended ? '종료' : club.myNextMeetingAt ? `모임 ${meetingDay(club.myNextMeetingAt)}` : null;
  // 참여한 모임은 스티키 날짜로만 알린다 — 참여한 모임이 없을 때만 아래 한 줄로 클럽의 다음 모임을 알린다.
  const nextLine = ended || club.myNextMeetingAt || !club.nextMeetingTitle
    ? null
    : `다음 모임 · ${club.nextMeetingTitle}`;
  // '관리'가 얹히는 마지막 줄 — 버튼 높이만큼 세우고 오른쪽을 비워 둔다.
  const lastRow = onManage ? styles.lastRowWithManage : undefined;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={club.name}>
        <View style={styles.band}>
          <ClubBackdrop uri={club.backgroundUrl} seed={club.id} />
          {/* 배경이 아래 본문으로 녹아들게 카드 표면색으로 덮는다 — 검은 스크림을 쓰지 않는다. */}
          <LinearGradient
            colors={[`${colors.surface}00`, colors.surface]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          {note ? (
            <View style={styles.bandNote}>
              <StickyNote rotate={4} style={styles.note}>
                <Text style={[styles.noteText, { color: colors.onNote }]}>{note}</Text>
              </StickyNote>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
            {club.name}
          </Text>
          {club.description ? (
            <Text numberOfLines={2} style={[styles.intro, { color: colors.textMuted }]}>{club.description}</Text>
          ) : null}
          <View style={nextLine ? undefined : lastRow}>
            <MembersLine members={club.members ?? []} />
          </View>
          {nextLine ? (
            <View style={lastRow}>
              <Text numberOfLines={1} style={[styles.next, { color: colors.textMuted }]}>
                {nextLine}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {onManage ? (
        <View style={styles.manage}>
          <FootAction label="관리" onPress={onManage} accessibilityLabel={`${club.name} 관리`} />
        </View>
      ) : null}
    </View>
  );
}

/** 함께 읽는 사람 줄 — 아바타 겹침 + 이름들, 열린 세션이 있으면 점과 '지금 읽는 중'. */
function MembersLine({ members }: { members: ClubMemberBrief[] }) {
  const { colors } = useTheme();
  const shown = members.slice(0, MAX_AVATARS);
  const name = (m: ClubMemberBrief) => (m.isMe ? '나' : m.nickname);
  const names = members.map(name);
  const label = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명`;
  const live = members.filter((m) => m.readingNow);

  return (
    <View style={styles.membersLine}>
      <View style={styles.avatars}>
        {shown.map((m, i) => (
          <View key={m.userId} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.surface }]}>
            <Avatar uri={m.avatarUrl} nickname={m.nickname} size={AVATAR} />
            {m.readingNow ? (
              <View style={[styles.liveDot, { backgroundColor: colors.accent, borderColor: colors.surface }]} />
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
          {label || '아직 나뿐이에요'}
        </Text>
        {live.length > 0 ? (
          <View style={styles.liveLine}>
            <View style={[styles.liveMark, { backgroundColor: colors.accent }]} />
            <Text numberOfLines={1} style={[styles.liveText, { color: colors.accent }]}>
              {live.map(name).join(', ')} 지금 읽는 중
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  band: { height: BAND_H, overflow: 'hidden' },
  bandNote: { position: 'absolute', right: spacing.lg, top: spacing.md },
  note: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noteText: { fontFamily: mono.semiBold, fontSize: 13, letterSpacing: 1 },
  body: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  lastRowWithManage: { minHeight: MANAGE_H, justifyContent: 'center', paddingRight: MANAGE_ROOM },
  // 본문 아래 여백(lg)에 맞춰 마지막 줄과 같은 높이에 선다.
  manage: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  name: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  intro: { ...typeScale.caption, lineHeight: 18 },
  next: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3, marginTop: 2 },
  membersLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: radius.round, borderWidth: 2 },
  liveDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: radius.round,
    borderWidth: 2,
  },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveMark: { width: 6, height: 6, borderRadius: radius.round },
  liveText: { fontFamily: mono.medium, fontSize: 10.5, letterSpacing: 0.3 },
});
