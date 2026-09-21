import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubMemberBrief, ClubSummary } from '@/api/types';
import { Chip, StickyNote, TiltCover } from '@/components/collage';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Numeral, ProgressBar, Tag, percent } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/** 시안 비교용 — a: 큰 표지 카드, b: 포스터 띠 카드. 고른 뒤 하나로 줄인다. */
export type ClubCardVariant = 'a' | 'b';

const AVATAR = 24;
const MAX_AVATARS = 4;

/**
 * 내 모임 카드 — 표지·책·함께 읽는 사람이 한눈에 들어오게.
 * 카드 본문은 누르면 모임 홈으로, 호스트에게만 붙는 '관리' 칩은 본문 Pressable 의 형제로 둬
 * 웹에서 button 안에 button 이 들어가지 않게 한다.
 */
export function ClubCard({ club, variant, onPress, onManage }: {
  club: ClubSummary;
  variant: ClubCardVariant;
  onPress: () => void;
  onManage?: () => void;
}) {
  const { colors, cardShadow } = useTheme();
  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';
  const dday = ended ? '종료' : club.daysLeft >= 0 ? `D-${club.daysLeft}` : '기간 종료';
  const bookLine = [club.book?.title ?? '도서 없음', club.book?.author].filter(Boolean).join(' · ');
  const cover = club.book?.coverUrl ?? club.coverUrl;

  const body = (
    <View style={styles.body}>
      <Text numberOfLines={variant === 'a' ? 2 : 1} style={[styles.name, { color: colors.text }, onManage && styles.nameWithManage]}>
        {club.name}
      </Text>
      <Text numberOfLines={1} style={[styles.book, { color: colors.textMuted }]}>
        {variant === 'a' ? (
          <>
            <Text style={[styles.ddayInline, { color: ended ? colors.textFaint : colors.accent }]}>{dday}</Text>
            {' · '}
          </>
        ) : null}
        {bookLine}
      </Text>
      <MembersLine members={club.members ?? []} />
      <View style={styles.progressLine}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={club.myCompletionRate} height={5} />
        </View>
        <Numeral style={[styles.pct, { color: colors.text }]}>{percent(club.myCompletionRate)}</Numeral>
        <Text style={[styles.avg, { color: colors.textFaint }]}>평균 {percent(club.averageCompletionRate)}</Text>
      </View>
    </View>
  );

  if (variant === 'b') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={club.name}>
          <View style={[styles.band, { backgroundColor: colors.surfaceRaised }]}>
            {cover ? (
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />
            ) : null}
            <LinearGradient colors={[colors.scrimDim, colors.surface]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.bandCover}>
              <TiltCover uri={cover} title={club.book?.title} width={76} tilt={-4} entering={false} />
            </View>
            <View style={styles.bandNote}>
              <StickyNote rotate={4} style={styles.note}>
                <Text style={[styles.noteText, { color: colors.onNote }]}>{dday}</Text>
              </StickyNote>
            </View>
          </View>
          <View style={styles.bandBody}>{body}</View>
        </Pressable>
        {onManage ? (
          <View style={styles.manageB}>
            <Chip label="관리" onPress={onManage} accessibilityLabel={`${club.name} 관리`} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}>
      <Pressable onPress={onPress} style={styles.cardA} accessibilityRole="button" accessibilityLabel={club.name}>
        <TiltCover uri={cover} title={club.book?.title} width={84} tilt={-3} entering={false} />
        {body}
      </Pressable>
      {onManage ? (
        <View style={styles.manageA}>
          <Chip label="관리" onPress={onManage} accessibilityLabel={`${club.name} 관리`} />
        </View>
      ) : null}
      {ended ? <View style={styles.endedTag}><Tag label="종료" /></View> : null}
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
            <QuoteAvatar uri={m.avatarUrl} nickname={m.nickname} size={AVATAR} />
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
  // A — 큰 표지 카드
  cardA: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, paddingRight: spacing.lg },
  manageA: { position: 'absolute', top: spacing.md, right: spacing.md },
  endedTag: { position: 'absolute', top: spacing.md, right: spacing.md },
  // B — 포스터 띠 카드
  band: { height: 128, overflow: 'hidden' },
  bandCover: { position: 'absolute', left: spacing.lg, top: spacing.md },
  bandNote: { position: 'absolute', right: spacing.lg, top: spacing.md },
  note: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  noteText: { fontFamily: mono.semiBold, fontSize: 13, letterSpacing: 1 },
  bandBody: { padding: spacing.lg, paddingTop: spacing.md },
  manageB: { position: 'absolute', top: 128 + spacing.md, right: spacing.lg },
  // 본문 공통
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  name: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  nameWithManage: { paddingRight: 56 },
  ddayInline: { fontFamily: mono.semiBold, fontSize: 11, letterSpacing: 0.5 },
  book: { ...typeScale.caption },
  membersLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: radius.pill, borderWidth: 2 },
  liveDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveMark: { width: 6, height: 6, borderRadius: radius.pill },
  liveText: { fontFamily: mono.medium, fontSize: 10.5, letterSpacing: 0.3 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  pct: { fontSize: 11 },
  avg: { fontFamily: mono.regular, fontSize: 10.5 },
});
