import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Settings } from 'lucide-react-native';

import type { ClubMemberBrief, ClubSummary } from '@/api/types';
import { ICON_SIZE, IconButton, StickyNote } from '@/components/collage';
import { Avatar } from '@/components/Avatar';
import { ClubBackdrop } from './ClubBackdrop';
import { meetingDay } from './meetingTime';
import { hairline, iconStroke, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

const AVATAR = 24;
/** 제목 줄 오른쪽 끝에 보이는 프로필 사진 수 — 더 많으면 뒤에 '…'를 붙인다(2026-10-05 사용자 결정). */
const MAX_AVATARS = 3;
/** 그림 띠 높이 — 96에서 144로 늘렸다(2026-10-05 사용자 결정). */
const BAND_H = 144;
/** 아이콘 버튼(44pt) 높이 — 톱니를 얹는 제목 줄을 이만큼 세워 버튼과 가운데를 맞춘다. */
const MANAGE_H = 44;
/** 제목 줄 오른쪽에 톱니 몫으로 비워 두는 폭 — 상자 여백(10)을 카드 여백 쪽으로 민 만큼 뺀다. */
const MANAGE_ROOM = 44;

/**
 * 내 클럽 카드 — 클럽은 책 한 권에 묶이지 않으므로 책 대신 클럽의 얼굴로 그린다.
 * 위 띠는 호스트가 올린 배경 사진(없으면 기본 배경 — ClubBackdrop)과 내가 참여한 가장 가까운 모임의 스티키,
 * 아래 본문은 제목 줄(이름 + 오른쪽 끝에 함께하는 사람의 프로필 사진) · 한 줄 소개. 모임은 스티키 날짜로만 알리고 글 줄로는 쓰지 않는다.
 * 카드 본문은 누르면 클럽 홈으로. 호스트에게만 붙는 관리 톱니(IconButton — 클럽 정보의 톱니와 같은 아이콘·같은 설정 화면,
 * 2026-10-05 사용자 결정으로 '관리' 글자 대신)는 제목 줄 오른쪽 끝에 얹는다 —
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
  // '모임' 글자 대신 달력 아이콘 + 날짜(2026-10-05 사용자 결정). 끝난 클럽은 '종료' 글자만.
  const meetingDate = !ended && club.myNextMeetingAt ? meetingDay(club.myNextMeetingAt) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${club.name}, 멤버 ${club.memberCount}명`}>
        <View style={styles.band}>
          <ClubBackdrop uri={club.backgroundUrl} seed={club.id} />
          {/* 배경이 아래 본문으로 녹아들게 카드 표면색으로 덮는다 — 검은 스크림을 쓰지 않는다. */}
          <LinearGradient
            colors={[`${colors.surface}00`, colors.surface]}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          {ended || meetingDate ? (
            <View style={styles.bandNote}>
              <StickyNote rotate={4} style={styles.note}>
                <View
                  accessible
                  accessibilityLabel={ended ? '종료' : `참여할 모임 ${meetingDate}`}
                  style={styles.noteRow}
                >
                  {ended ? null : <CalendarDays size={13} color={colors.onNote} {...iconStroke} />}
                  <Text style={[styles.noteText, { color: colors.onNote }]}>{ended ? '종료' : meetingDate}</Text>
                </View>
              </StickyNote>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* 제목 줄 — 함께하는 사람의 프로필 사진을 줄 오른쪽 끝에. 톱니가 얹히면 버튼 높이만큼 세우고 오른쪽을 비워 둔다. */}
          <View style={[styles.titleRow, onManage ? styles.titleRowWithManage : null]}>
            <Text numberOfLines={1} style={[styles.name, styles.flex, { color: colors.text }]}>
              {club.name}
            </Text>
            <MemberAvatars members={club.members ?? []} />
          </View>
          {club.description ? (
            <Text numberOfLines={2} style={[styles.intro, { color: colors.textMuted }]}>{club.description}</Text>
          ) : null}
          <LiveLine members={club.members ?? []} />
        </View>
      </Pressable>

      {onManage ? (
        <View style={styles.manage}>
          <IconButton onPress={onManage} accessibilityLabel={`${club.name} 관리`}>
            <Settings size={ICON_SIZE} color={colors.text} {...iconStroke} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

/** 함께하는 사람 — 프로필 사진을 겹쳐 3개까지, 더 있으면 '…'. 지금 읽는 사람은 사진에 초록 점. */
function MemberAvatars({ members }: { members: ClubMemberBrief[] }) {
  const { colors } = useTheme();
  if (members.length === 0) return null;
  const shown = members.slice(0, MAX_AVATARS);

  return (
    <View style={styles.avatars}>
      {shown.map((m, i) => (
        <View key={m.userId} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.surface }]}>
          <Avatar uri={m.avatarUrl} nickname={m.nickname} size={AVATAR} />
          {m.readingNow ? (
            <View style={[styles.liveDot, { backgroundColor: colors.accent, borderColor: colors.surface }]} />
          ) : null}
        </View>
      ))}
      {members.length > MAX_AVATARS ? (
        <Text style={[styles.more, { color: colors.textMuted }]}>…</Text>
      ) : null}
    </View>
  );
}

/** 열린 독서가 있으면 점과 '○○ 지금 읽는 중' — 아무도 읽고 있지 않으면 그리지 않는다. */
function LiveLine({ members }: { members: ClubMemberBrief[] }) {
  const { colors } = useTheme();
  const live = members.filter((m) => m.readingNow);
  if (live.length === 0) return null;

  return (
    <View style={styles.liveLine}>
      <View style={[styles.liveMark, { backgroundColor: colors.accent }]} />
      <Text numberOfLines={1} style={[styles.liveText, { color: colors.accent }]}>
        {live.map((m) => (m.isMe ? '나' : m.nickname)).join(', ')} 지금 읽는 중
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: hairline, overflow: 'hidden' },
  band: { height: BAND_H, overflow: 'hidden' },
  bandNote: { position: 'absolute', right: spacing.lg, top: spacing.md },
  note: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noteText: { fontFamily: mono.semiBold, fontSize: 13, letterSpacing: 1 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRowWithManage: { minHeight: MANAGE_H, paddingRight: MANAGE_ROOM },
  // 본문 위 여백(md) 아래, 제목 줄과 같은 높이에 선다. 44pt 상자 여백(10)만큼 오른쪽으로 내밀어
  // 톱니 아이콘이 카드 안쪽 선(lg)에 맞는다.
  manage: { position: 'absolute', right: spacing.lg - 10, top: BAND_H + spacing.md },
  name: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  flex: { flex: 1 },
  intro: { ...typeScale.caption, lineHeight: 18 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  more: { ...typeScale.caption, marginLeft: 2 },
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
