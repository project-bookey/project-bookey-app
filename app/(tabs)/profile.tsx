import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { libraryApi, postApi, profileApi, quoteApi, statsApi, walletApi } from '@/api/endpoints';
import { MY_POSTS_LATEST_KEY } from '@/api/postCache';
import type { ReadingRecord } from '@/api/types';
import {
  BrandHeader, MemoScrap, PaperScreen, PlusGlyph, StickyNote, TiltCover, useCoverEntrance,
} from '@/components/collage';
import { SocialCard } from '@/components/social/SocialCard';
import {
  Card, Eyebrow, KeyValue, Rule, formatDuration,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, statusLabel, typeScale, useTheme } from '@/theme';
import { rowOffsetY, sans, tiltFor } from '@/theme/tokens';

/** 아바타 지름(px) — 시안 A. 글줄 가운데에 앉히므로 이름·핸들·팔로우 세 줄 높이보다 조금 크다. */
const AVATAR = 88;
/** 선반에 올리는 최대 권수 — 넘치면 '전체보기'로 넘긴다. */
const SHELF_CAP = 10;
/** 선반 표지 폭(px) — 시안 2e 기준. */
const SHELF_COVER_W = 100;
/** 히트맵에 그리는 최근 일수 — 통계 응답이 더 짧으면 응답 길이를 따른다. */
const HEATMAP_DAYS = 90;

/**
 * 구역 4. 나 — 프로필 · 지갑 메모/방문 노트 · 내 서재 선반 · 기록 · 오려둔 문장/독후감 링크 · 소셜 (시안 2e).
 *
 * 올해 읽은 시간 차트는 뺐고 기록 카드만 남겼다. 오려둔 문장·독후감은 여기서 펼치지 않고
 * 각자의 화면(/quote/mine · /post/mine)으로 보내는 링크만 둔다.
 * 소셜(지갑·팔로우 코드·방문)은 따로 탭이었다가 이 화면 맨 아래로 돌아왔다 — 호출하는 API·상태는 그대로다.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const myId = user?.id;

  const summary = useQuery({ queryKey: ['library', 'summary'], queryFn: libraryApi.summary });
  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const subscribed = wallet.data?.subscriptionActive ?? false;
  const visitCount = myProfile.data?.visitCount ?? 0;
  // 홈과 같은 캐시 키를 쓴다 — 서가 탭을 거쳐 왔다면 그대로 재사용된다.
  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const want = useQuery({ queryKey: ['library', 'WANT_TO_READ'], queryFn: () => libraryApi.list('WANT_TO_READ') });
  // 올해 읽은 시간 차트는 뺐지만 기록 카드의 값(총 독서시간·스트릭)은 그대로 두려고
  // 범위를 줄이지 않았다 — 한 해를 덮는 365일을 그대로 받는다. 히트맵은 이 응답의 최근 구간만 잘라 쓴다.
  const stats = useQuery({ queryKey: ['stats', 365], queryFn: () => statsApi.summary(365) });

  // 읽는 중을 앞에 세우고 읽고 싶은 책을 뒤에 잇는다 — 선반은 '지금 손이 가는 순서'다.
  const shelf: ReadingRecord[] = [
    ...(reading.data?.content ?? []),
    ...(want.data?.content ?? []),
  ].slice(0, SHELF_CAP);
  const shelfLoading = reading.isLoading || want.isLoading;

  const counts = summary.data;
  const libraryTotal = counts
    ? counts.reading + counts.wantToRead + counts.finished + counts.paused + counts.abandoned
    : shelf.length;

  const heatDaily = (stats.data?.daily ?? []).slice(-HEATMAP_DAYS);

  return (
    <PaperScreen withTopInset>
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileRow}>
          <Pressable
            onPress={() => router.push({ pathname: '/profile-photo', params: { returnTo: 'profile' } })}
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.lineStrong }]}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.textMuted }]}>
                  {user?.nickname?.slice(0, 1) ?? '?'}
                </Text>
              )}
            </View>
            {/* 사진 모서리에 붙는 민트 원 배지 — 배경색 테두리로 사진과 띄워 '떠 있는 +' 가 되지 않게 한다. */}
            <View style={[styles.avatarBadge, { backgroundColor: colors.accent, borderColor: colors.bg }]}>
              <PlusGlyph size={12} stroke={2.5} color={colors.onAccent} />
            </View>
          </Pressable>
          <View style={styles.profileText}>
            <View style={styles.nicknameRow}>
              <Text numberOfLines={1} style={[styles.nickname, { color: colors.text }]}>
                {user?.nickname ?? '독자'}
              </Text>
              <Pressable
                onPress={() => router.push('/profile-edit')}
                accessibilityRole="button"
                accessibilityLabel="프로필 편집"
                hitSlop={8}
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
              >
                <PencilLine color={colors.accent} />
              </Pressable>
            </View>
            {/* 서버 MeResponse 에 가입일이 없어 핸들로 대신한다 — 필드가 생기면 '{연도} 가입'으로 바꾼다. */}
            <Text style={[typeScale.monoLabel, styles.profileMeta, { color: colors.textFaint }]}>
              @{user?.handle ?? '—'} · 완독 {counts?.finished ?? 0}권
            </Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>
              팔로워{' '}
              <Text style={[styles.profileCount, { color: colors.text }]}>{myProfile.data?.followerCount ?? 0}</Text>
              {' · '}팔로잉{' '}
              <Text style={[styles.profileCount, { color: colors.text }]}>{myProfile.data?.followingCount ?? 0}</Text>
            </Text>
          </View>
          {/* 설정은 탭이 아니라 여기서 들어간다 — 프로필 행 오른쪽 끝, 팔로워 줄에 밑선을 맞춘다. */}
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="설정"
            hitSlop={8}
            style={({ pressed }) => [
              styles.settingsPill,
              { borderColor: colors.line, backgroundColor: colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <GearLine size={14} color={colors.textMuted} />
            <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>설정</Text>
          </Pressable>
        </View>

        {/* 지갑 메모 + 방문 스티키 — 예전 '전부 보기' 조각 행과 같은 꼴.
            메모는 잔액 요약이고 누르면 지갑 화면(교환·구독·책갈피 구매)으로, 스티키는 방문자 화면으로 간다. */}
        <View style={[styles.block, styles.scrapRow]}>
          <Pressable
            onPress={() => router.push('/wallet')}
            accessibilityRole="button"
            accessibilityLabel={`지갑, 책갈피 ${wallet.data?.bookmarkBalance ?? 0}개 · 엽서 ${wallet.data?.postcardBalance ?? 0}장 · 무료엽서 ${wallet.data?.freePostcardsLeftToday ?? 0}장 · 우표 ${wallet.data?.stampBalance ?? 0}개, 교환·구독 열기`}
            style={({ pressed }) => [styles.walletPress, pressed && styles.pressed]}
          >
            <MemoScrap rotate={-0.8} style={styles.walletMemo}>
              <View style={styles.walletHead}>
                <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>지갑</Text>
                <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>교환·구독 →</Text>
              </View>
              <View style={styles.walletRow}>
                <WalletCell value={wallet.data?.bookmarkBalance ?? 0} label="책갈피" />
                <WalletCell value={wallet.data?.postcardBalance ?? 0} label="엽서" />
                <WalletCell value={wallet.data?.freePostcardsLeftToday ?? 0} label="무료엽서" />
                <WalletCell value={wallet.data?.stampBalance ?? 0} label="우표" />
              </View>
            </MemoScrap>
          </Pressable>
          <Pressable
            onPress={subscribed
              ? () => router.push('/visitors')
              : () => router.push({ pathname: '/subscription', params: { feature: 'visitors' } })}
            accessibilityRole="button"
            accessibilityLabel={`${visitCount}명이 내 페이지에 다녀갔어요, 방문자 확인하기`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <StickyNote rotate={1.5} style={styles.visitNote}>
              <Text style={[typeScale.monoNumeral, styles.visitCount, { color: colors.onNote }]}>{visitCount}명</Text>
              <Text style={[typeScale.label, styles.visitText, { color: colors.onNote }]}>내 페이지에{'\n'}다녀갔어요</Text>
              <Text style={[typeScale.monoEyebrow, styles.visitAction, { color: colors.onNote }]}>확인하기 →</Text>
            </StickyNote>
          </Pressable>
        </View>

        <View style={styles.shelfSection}>
          <View style={styles.shelfHeader}>
            <Text style={[typeScale.titleSerif, styles.shelfTitle, { color: colors.text }]}>내 서재</Text>
            <Pressable
              onPress={() => router.push('/library')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`서재 전체보기, 총 ${libraryTotal}권`}
            >
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>
                {libraryTotal}권 · 전체보기 →
              </Text>
            </Pressable>
          </View>

          {shelfLoading ? (
            <View style={styles.shelfList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.shelfSkeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : shelf.length === 0 ? (
            <View style={styles.shelfList}>
              <Pressable
                onPress={() => router.navigate('/search')}
                accessibilityRole="button"
                accessibilityLabel="책 추가"
              >
                <View style={[styles.shelfGhost, { borderColor: colors.lineStrong }]}>
                  <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
                  <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>책 추가</Text>
                </View>
              </Pressable>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.shelfGhost, { borderColor: colors.lineStrong }]} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfList}
            >
              {shelf.map((record, index) => (
                <ShelfItem
                  key={record.id}
                  record={record}
                  index={index}
                  onPress={() => {
                    if (record.book?.id != null) {
                      router.push(`/book/${record.book.id}?recordId=${record.id}`);
                    }
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {stats.isLoading ? null : (
          <View style={styles.block}>
            <Card>
              <Eyebrow>기록</Eyebrow>
              {stats.data ? (
                <>
                  <View style={styles.statRow}>
                    <StatCell label="현재 스트릭" value={`${stats.data.currentStreakDays}일`} />
                    <VRule />
                    <StatCell label="최장 스트릭" value={`${stats.data.longestStreakDays}일`} />
                    <VRule />
                    <StatCell label="이번 주" value={formatDuration(stats.data.weekDurationSec)} />
                  </View>
                  <Heatmap daily={heatDaily} />
                  <View style={styles.legend}>
                    <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>적음</Text>
                    {[0, 0.2, 0.4, 0.6, 1].map((level) => (
                      <View
                        key={level}
                        style={[styles.legendCell, { backgroundColor: cellColor(level, colors) }]}
                      />
                    ))}
                    <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>많음</Text>
                  </View>
                  <View style={{ marginTop: spacing.sm }}>
                    <Rule />
                    <KeyValue label="총 독서시간" value={formatDuration(stats.data.totalDurationSec)} />
                    <Rule />
                    <KeyValue label="오늘" value={formatDuration(stats.data.todayDurationSec)} />
                    <Rule />
                    <KeyValue
                      label="기록한 날"
                      value={`${heatDaily.filter((d) => d.sessionCount > 0).length}일 / ${heatDaily.length}일`}
                    />
                  </View>
                </>
              ) : (
                <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
                  통계를 불러오지 못했습니다.
                </Text>
              )}
            </Card>
          </View>
        )}

        <MyScraps />

        <View style={styles.block}>
          <SocialCard />
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

// 장식용 아이콘 — aria-hidden 은 RN 이 네이티브 접근성 숨김으로 옮기고 웹은 그대로 쓴다.
// (accessibilityElementsHidden 은 react-native-svg 웹에서 DOM 에 새어 React 경고가 뜬다)
/** 톱니 — 예전 하단 탭 '설정' 아이콘과 같은 꼴. */
function GearLine({ size, color }: { size: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Circle cx={12} cy={12} r={3} {...stroke} />
      <Path d="M12 4.5v2" {...stroke} />
      <Path d="M12 17.5v2" {...stroke} />
      <Path d="M4.5 12h2" {...stroke} />
      <Path d="M17.5 12h2" {...stroke} />
      <Path d="m6.7 6.7 1.4 1.4" {...stroke} />
      <Path d="m15.9 15.9 1.4 1.4" {...stroke} />
      <Path d="m17.3 6.7-1.4 1.4" {...stroke} />
      <Path d="m8.1 15.9-1.4 1.4" {...stroke} />
    </Svg>
  );
}

function PencilLine({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M5 18.5 6.2 14 15.8 4.4a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L10 17.8z"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m14.5 5.8 3.7 3.7"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * '내가 오려둔 문장'·'내 독후감' — 프로필에서는 목록을 펼치지 않고 각자의 화면으로 보내는 링크만 둔다.
 *
 * 개수는 size 1 응답의 totalElements 로 센다 — 목록은 /quote/mine · /post/mine 의 몫이라 그 이상은 받지 않는다.
 * 서버가 totalElements 를 생략했거나 아직 못 받았으면 개수 없이 링크만 보인다. 0건이어도 링크는 남긴다 —
 * 들어간 화면의 빈 상태가 첫 문장·첫 독후감을 권한다.
 */
function MyScraps() {
  const router = useRouter();
  const quotes = useQuery({ queryKey: ['quotes', 'mine'], queryFn: () => quoteApi.mine(0, 1) });
  const posts = useQuery({ queryKey: MY_POSTS_LATEST_KEY, queryFn: () => postApi.mine(0, 1) });

  return (
    <View style={styles.block}>
      <Card>
        <LinkRow
          label="내가 오려둔 문장"
          count={quotes.data?.totalElements}
          unit="개"
          onPress={() => router.push('/quote/mine')}
        />
        <Rule />
        <LinkRow
          label="내 독후감"
          count={posts.data?.totalElements}
          unit="편"
          onPress={() => router.push('/post/mine')}
        />
      </Card>
    </View>
  );
}

/** 카드 안 한 줄 링크 — 왼쪽 제목, 오른쪽 'N개 →'. 개수를 모르면 '보기 →'. */
function LinkRow({ label, count, unit, onPress }: {
  label: string;
  count?: number;
  unit: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, 총 ${count}${unit}` : label}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.linkLabel, { color: colors.text }]}>
        {label}
      </Text>
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
        {count != null ? `${count}${unit} →` : '보기 →'}
      </Text>
    </Pressable>
  );
}

/**
 * 선반 한 칸 — 표지 + 진행 트랙 + 제목 + 상태.
 * 표지와 아래 활자는 같은 index·entranceKey 로 입장 진행값을 공유해 한 조각처럼 앉는다.
 */
function ShelfItem({ record, index, onPress }: {
  record: ReadingRecord;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const offsetY = rowOffsetY[index % rowOffsetY.length];
  // 책 id 와 기록 id 는 다른 시퀀스라 섞으면 서로 다른 책이 같은 키를 가질 수 있다 — 접두로 갈라 둔다.
  const entranceKey = record.book?.id != null
    ? `me-shelf:b${record.book.id}`
    : `me-shelf:r${record.id}`;
  const progress = useCoverEntrance(index, entranceKey);
  const metaStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const title = record.book?.title ?? '제목 없음';
  const state = statusLabel[record.status] ?? record.status;
  const reading = record.status === 'READING';
  const rate = Math.max(0, Math.min(1, record.progress?.completionRate ?? 0));

  return (
    <View style={styles.shelfItem}>
      <TiltCover
        uri={record.book?.coverUrl}
        title={title}
        width={SHELF_COVER_W}
        index={index}
        tilt={tiltFor(index)}
        offsetY={offsetY}
        entranceKey={entranceKey}
        onPress={onPress}
        accessibilityLabel={`${title}, ${state}`}
      />

      {/* 표지가 내려간 만큼 아래 활자도 같이 내린다. 표지 버튼이 제목·상태를 이미 읽어 주므로
          여기는 접근성 트리에서 감춘다. */}
      <Animated.View
        style={[styles.shelfMeta, offsetY ? { transform: [{ translateY: offsetY }] } : null, metaStyle]}
        aria-hidden
      >
        {reading ? (
          <View style={[styles.shelfTrack, { backgroundColor: colors.line }]}>
            <View
              style={[styles.shelfFill, { width: `${Math.round(rate * 100)}%`, backgroundColor: colors.accent }]}
            />
          </View>
        ) : null}
        <Text numberOfLines={2} style={[typeScale.caption, styles.shelfItemTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[typeScale.monoLabel, styles.shelfState, { color: colors.textFaint }]}>{state}</Text>
      </Animated.View>
    </View>
  );
}

/** 지갑 메모의 숫자 한 칸 — 모노 숫자 위, 캡션 라벨 아래('기록' 카드의 StatCell 보다 한 치수 작다). */
function WalletCell({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.walletCell}>
      <Text style={[typeScale.monoNumeral, styles.walletValue, { color: colors.text }]}>{value}</Text>
      <Text style={[typeScale.caption, styles.walletLabel, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[typeScale.monoNumeral, styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function VRule() {
  const { colors } = useTheme();
  return <View style={[styles.vRule, { backgroundColor: colors.line }]} />;
}

/** 주 단위 열로 쌓는 히트맵 — 램프는 테마 악센트 파생 4단계. */
function Heatmap({ daily }: { daily: { date: string; durationSec: number }[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...daily.map((d) => d.durationSec));
  const weeks: { date: string; durationSec: number }[][] = [];
  let current: { date: string; durationSec: number }[] = [];

  daily.forEach((day, index) => {
    const weekday = new Date(day.date).getDay();
    if (index === 0) {
      for (let i = 0; i < weekday; i++) {
        current.push({ date: '', durationSec: -1 });
      }
    }
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  });
  if (current.length > 0) {
    weeks.push(current);
  }

  return (
    <View style={styles.heatmap}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.heatWeek}>
          {week.map((day, dayIndex) => (
            <View
              key={`${weekIndex}-${dayIndex}`}
              style={[
                styles.heatCell,
                day.durationSec < 0
                  ? { backgroundColor: 'transparent' }
                  : { backgroundColor: cellColor(day.durationSec / max, colors) },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function cellColor(ratio: number, colors: ColorTokens): string {
  if (ratio <= 0) return colors.line;
  if (ratio < 0.25) return `${colors.accent}40`;
  if (ratio < 0.5) return `${colors.accent}80`;
  if (ratio < 0.75) return `${colors.accent}BF`;
  return colors.accent;
}

const styles = StyleSheet.create({
  container: { ...layout.content, gap: spacing.xl, paddingBottom: 104, paddingTop: spacing.lg },
  block: { paddingHorizontal: spacing.lg },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatarButton: { width: AVATAR, height: AVATAR, borderRadius: radius.pill },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  // 배지 테두리 3px 는 배경색 — 사진과 배지 사이를 끊어 주는 여백 역할이라 hairline 이 아니다.
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...typeScale.titleSerif, fontSize: 34, lineHeight: 42 },
  profileText: { flex: 1, gap: 5 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 시안의 프로필 표제는 히어로보다 작다 — displaySerif 를 22로 줄여 쓴다.
  nickname: { ...typeScale.displaySerif, flexShrink: 1, fontSize: 22, lineHeight: 30 },
  editButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  // alignSelf 로 행의 가운데 정렬에서 빠져나와 팔로워·팔로잉 줄에 밑선을 맞춘다.
  settingsPill: {
    alignSelf: 'flex-end',
    height: 30,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileMeta: { letterSpacing: 0.4 },
  // 팔로워·팔로잉 숫자만 본문색 세미볼드 — 캡션 크기는 바깥 Text 가 정한다.
  profileCount: { fontFamily: sans.semiBold },
  pressed: { opacity: 0.72 },

  scrapRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  walletPress: { flex: 1 },
  walletMemo: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md + 2 },
  walletHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 네 칸을 메모 폭에 고르게 편다 — 왼쪽에 몰리면 오른쪽이 빈 종이로 남는다.
  walletRow: { flexDirection: 'row', gap: spacing.sm },
  walletCell: { flex: 1, gap: 2 },
  walletValue: { fontSize: 17, lineHeight: 22 },
  walletLabel: { fontSize: 11 },
  visitNote: { width: 92, justifyContent: 'center', gap: spacing.xs, paddingHorizontal: 10 },
  visitCount: { fontSize: 18, lineHeight: 22 },
  visitText: { fontSize: 11, lineHeight: 15 },
  visitAction: { fontSize: 9, letterSpacing: 1, marginTop: 2 },

  shelfSection: { gap: spacing.sm },
  shelfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  shelfTitle: { fontSize: 18, lineHeight: 26 },
  // 지그재그로 내려간 표지와 그 아래 활자가 잘리지 않게 아래 여백을 크게 둔다.
  shelfList: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  shelfItem: { width: SHELF_COVER_W },
  shelfMeta: { marginTop: spacing.sm, gap: spacing.xs },
  shelfTrack: { height: 2, width: '100%', overflow: 'hidden' },
  shelfFill: { height: 2 },
  // 브리프대로 caption 계열 — 앞에 얹은 typeScale.caption 을 덮지 않도록 행간만 조인다.
  shelfItemTitle: { lineHeight: 16 },
  shelfState: { fontSize: 9, letterSpacing: 0.6 },
  shelfSkeleton: {
    width: SHELF_COVER_W,
    height: Math.round(SHELF_COVER_W * 1.5),
    borderRadius: radius.sm,
  },
  shelfGhost: {
    width: SHELF_COVER_W,
    height: Math.round(SHELF_COVER_W * 1.5),
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  statRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.md },
  statCell: { flex: 1, gap: 3 },
  statValue: { fontSize: 18 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  heatmap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginTop: spacing.md },
  heatWeek: { gap: 3 },
  heatCell: { width: 11, height: 11, borderRadius: radius.sm },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  legendCell: { width: 11, height: 11, borderRadius: radius.sm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  linkLabel: { flexShrink: 1 },
});
