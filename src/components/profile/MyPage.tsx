import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ApiError } from '@/api/client';
import { chatApi, libraryApi, postApi, profileApi, statsApi, walletApi } from '@/api/endpoints';
import { MY_POSTS_LATEST_KEY } from '@/api/postCache';
import type { Post, ReadingRecord } from '@/api/types';
import {
  MemoScrap, NAV_CLEARANCE, PlusGlyph, StickyNote, TiltCover, useCoverEntrance,
} from '@/components/collage';
import { PersonGlyph } from '@/components/Avatar';
import { KeyboardScroll } from '@/components/keyboard';
import { AttendanceCard } from '@/components/home/AttendanceCard';
import { LikeCount } from '@/components/post/LikeCount';
import { FollowButton } from '@/components/social/FollowButton';
import { PostcardComposer } from '@/components/social/PostcardComposer';
import { useTourTarget } from '@/components/tour/TourTarget';
import {
  Button, Card, EmptyState, Eyebrow, KeyValue, Rule, TextLink, formatDuration, formatRelative, linkLabel,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import type { ColorTokens } from '@/theme';
import {
  controlHeight, glassFace, hairline, iconStroke, layout, pressedStyle, radius, spacing, statusLabel, typeScale, useTheme,
} from '@/theme';
import { rowOffsetY, sans, serif, tiltFor } from '@/theme/tokens';

/** 아바타 지름(px) — 시안 A. 글줄 가운데에 앉히므로 이름·핸들·팔로우 세 줄 높이보다 조금 크다. */
const AVATAR = 88;
/** 선반에 올리는 최대 권수 — 넘치면 '전체 보기'로 넘긴다. */
const SHELF_CAP = 10;
/** 선반 표지 폭(px) — 시안 2e 기준. */
const SHELF_COVER_W = 100;
/** 히트맵에 그리는 최근 일수 — 통계 응답이 더 짧으면 응답 길이를 따른다. */
const HEATMAP_DAYS = 90;
/** 남의 공개 독후감을 한 번에 받는 편수. */
const POSTS_PAGE = 10;
/**
 * 팔로워·팔로잉 터치 상자 — 15px 글줄(22)에 위아래 11 씩 더해 44pt.
 * 위는 핸들 줄 안에서 멈춰 닉네임 옆 연필 버튼의 hitSlop 과 겹치지 않고, 아래는 묶음 간격(36) 안에 머문다.
 * 좌우 6 씩은 두 칸 사이 간격(spacing.md = 12)을 반씩 나눠 가져 서로 겹치지 않는다.
 */
const SOCIAL_HIT_SLOP = { top: 11, bottom: 11, left: 6, right: 6 };
/**
 * 서재 '전체 보기' 터치 상자 — 11px 글줄(≈15)에 위 16·아래 14.
 * 선반이 '기록' 묶음의 첫머리라 위는 묶음 간격(36) 안에 머물고, 아래는 선반 표지 위에서 멈춘다.
 */
const SHELF_ALL_HIT_SLOP = { top: 16, bottom: 14, left: 8, right: spacing.lg };

/**
 * 마이페이지 — '나' 탭(mine)과 다른 사람의 페이지(/user/[id])가 같은 판을 쓴다.
 *
 * 위에서부터 세 묶음이다 — 묶음 사이는 간격으로만 가른다.
 *  1. 프로필: 사진·이름·팔로워/팔로잉. 나는 사진 변경(아바타 하나로만)·편집(연필)·설정,
 *     남은 오른쪽 팔로우 칩(맞팔로우 여부도 이 라벨이 알린다)과 팔로워 줄 아래 채팅·엽서 링크(시안 A)
 *     — 팔로우는 이 화면에서만 한다.
 *  2. 오늘(나만): 지갑 메모/방문 노트, 출석.
 *  3. 기록: 서재 선반 · 기록 카드(스트릭·히트맵) · 내 독후감 링크(남은 공개 독후감).
 * 내 팔로워·팔로잉 숫자를 누르면 팔로우 목록 화면(/follows)으로 넘어간다.
 * 남의 서재·통계는 /users/{id}/library · /users/{id}/stats 로 받는다(각오 메모는 서버가 비워 보낸다).
 */
export function MyPage({ userId, mine }: { userId: number | undefined; mine: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useAuth((s) => s.user);
  const ready = userId != null;
  // 남의 페이지 동작(시안 A) — 채팅·엽서 링크는 프로필 줄 안에, 엽서 작성 칸은 그 아래에 펼친다.
  const [composing, setComposing] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const openChat = useMutation({
    mutationFn: () => chatApi.open(userId as number),
    onSuccess: (chat) => {
      setChatError(null);
      router.push({ pathname: '/chat/[id]', params: { id: String(chat.id), name: chat.otherNickname } });
    },
    onError: (e) => setChatError(e instanceof ApiError ? e.message : '채팅을 열지 못했어요.'),
  });
  const openFollows = (tab: 'FOLLOWER' | 'FOLLOWING') => {
    router.push({ pathname: '/follows', params: { tab } });
  };
  // 둘러보기 마지막 단계가 비추는 설정 버튼 — 남의 페이지에선 버튼이 없어 아무것도 등록되지 않는다.
  const settingsTourRef = useTourTarget('profile-settings');

  // 내 서재·통계는 홈·서재 화면과 같은 캐시 키를 쓴다 — 서가 탭을 거쳐 왔다면 그대로 재사용된다.
  const profile = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => profileApi.user(userId as number),
    enabled: ready,
  });
  const summary = useQuery({
    queryKey: mine ? ['library', 'summary'] : ['userLibrary', userId, 'summary'],
    queryFn: () => (mine ? libraryApi.summary() : profileApi.librarySummary(userId as number)),
    enabled: ready,
  });
  const reading = useQuery({
    queryKey: mine ? ['library', 'READING'] : ['userLibrary', userId, 'READING'],
    queryFn: () => (mine ? libraryApi.list('READING') : profileApi.library(userId as number, 'READING')),
    enabled: ready,
  });
  const want = useQuery({
    queryKey: mine ? ['library', 'WANT_TO_READ'] : ['userLibrary', userId, 'WANT_TO_READ'],
    queryFn: () => (mine ? libraryApi.list('WANT_TO_READ') : profileApi.library(userId as number, 'WANT_TO_READ')),
    enabled: ready,
  });
  const finished = useQuery({
    queryKey: mine ? ['library', 'FINISHED'] : ['userLibrary', userId, 'FINISHED'],
    queryFn: () => (mine ? libraryApi.list('FINISHED') : profileApi.library(userId as number, 'FINISHED')),
    enabled: ready,
  });
  // 기록 카드의 총 독서시간·스트릭 때문에 한 해를 덮는 365일을 받는다. 히트맵은 이 응답의 최근 구간만 잘라 쓴다.
  const stats = useQuery({
    queryKey: mine ? ['stats', 365] : ['userStats', userId, 365],
    queryFn: () => (mine ? statsApi.summary(365) : profileApi.stats(userId as number, 365)),
    enabled: ready,
  });

  // 읽는 중을 앞에 세우고 완독한 책, 읽고 싶은 책 순으로 잇는다 — 지금 손에 든 책 다음에 다 읽은 책을 보여 준다.
  const shelf: ReadingRecord[] = [
    ...(reading.data?.content ?? []),
    ...(finished.data?.content ?? []),
    ...(want.data?.content ?? []),
  ].slice(0, SHELF_CAP);
  const shelfLoading = reading.isLoading || finished.isLoading || want.isLoading;

  const counts = summary.data;
  const libraryTotal = counts
    ? counts.reading + counts.wantToRead + counts.finished + counts.paused + counts.abandoned
    : shelf.length;

  const heatDaily = (stats.data?.daily ?? []).slice(-HEATMAP_DAYS);

  const p = profile.data;
  // 내 이름·사진은 로그인 정보가 먼저 와 있다 — 프로필 응답을 기다리지 않는다.
  const nickname = (mine ? me?.nickname : p?.nickname) ?? (mine ? '독자' : '');
  const handle = mine ? me?.handle : p?.handle;
  const avatarUrl = mine ? me?.avatarUrl : p?.avatarUrl;

  if (!mine && profile.isError) {
    return (
      <View style={styles.missing}>
        <EmptyState title="사용자를 찾을 수 없어요" description="탈퇴했거나 주소가 잘못됐어요." />
      </View>
    );
  }

  const avatar = (
    <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.lineStrong }]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <PersonGlyph size={AVATAR} color={colors.textFaint} />
      )}
    </View>
  );

  const followerCount = p?.followerCount ?? 0;
  const followingCount = p?.followingCount ?? 0;

  return (
    <KeyboardScroll contentContainerStyle={styles.container}>
      {/* 1. 프로필 — 사진·이름·팔로워/팔로잉에 편집·설정을 붙인다(남의 페이지는 팔로우·채팅·엽서). */}
      <View style={styles.group}>
        <View style={styles.profileRow}>
          {mine ? (
            <Pressable
              onPress={() => router.push({ pathname: '/profile-photo', params: { returnTo: 'profile' } })}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 변경"
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            >
              {avatar}
              {/* 사진 모서리에 붙는 잉크 원 배지 — 배경색 테두리로 사진과 띄워 '떠 있는 +' 가 되지 않게 한다.
                  이 화면 위쪽의 악센트는 출석하기 버튼 하나뿐이다. */}
              <View style={[styles.avatarBadge, { backgroundColor: colors.ink, borderColor: colors.bg }]}>
                <PlusGlyph size={12} stroke={2.5} color={colors.onInk} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.avatarButton}>{avatar}</View>
          )}
          <View style={styles.profileText}>
            <View style={styles.nicknameRow}>
              <Text numberOfLines={1} style={[styles.nickname, { color: colors.text }]}>
                {nickname}
              </Text>
              {mine ? (
                <Pressable
                  onPress={() => router.push('/profile-edit')}
                  accessibilityRole="button"
                  accessibilityLabel="프로필 편집"
                  hitSlop={8}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <PencilLine color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            {/* 서버 MeResponse 에 가입일이 없어 핸들로 대신한다 — 필드가 생기면 '{연도} 가입'으로 바꾼다. */}
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.profileMeta, { color: colors.textFaint }]}>
              @{handle ?? '—'} · 완독 {counts?.finished ?? 0}권
            </Text>
            {mine ? (
              // 숫자를 누르면 팔로우 목록 화면으로 넘어가며 그 칸이 열린다 (§14.3)
              <View style={styles.profileSocial}>
                <Pressable
                  onPress={() => openFollows('FOLLOWER')}
                  accessibilityRole="button"
                  accessibilityLabel={`팔로워 ${followerCount}명 목록`}
                  hitSlop={SOCIAL_HIT_SLOP}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <SocialCount label="팔로워" value={followerCount} />
                </Pressable>
                <Pressable
                  onPress={() => openFollows('FOLLOWING')}
                  accessibilityRole="button"
                  accessibilityLabel={`팔로잉 ${followingCount}명 목록`}
                  hitSlop={SOCIAL_HIT_SLOP}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <SocialCount label="팔로잉" value={followingCount} />
                </Pressable>
              </View>
            ) : (
              <>
                {/* 나를 팔로우하는지·맞팔로우인지는 오른쪽 팔로우 버튼 라벨이 알린다 — 여기 따로 적지 않는다. */}
                <View style={styles.profileSocial}>
                  <SocialCount label="팔로워" value={followerCount} />
                  <SocialCount label="팔로잉" value={followingCount} />
                </View>
                {/* 채팅은 엽서 답장이 오간 사이(canChat)에만 — 서버 거절도 아래에 그대로 표시한다. */}
                {p ? (
                  <View style={styles.visitorLinks}>
                    {p.canChat ? (
                      <Pressable
                        onPress={() => openChat.mutate()}
                        disabled={openChat.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.nickname}님과 채팅`}
                        hitSlop={8}
                        style={({ pressed }) => [styles.visitorLink, pressed && styles.pressed]}
                      >
                        <ChatLine color={colors.accent} />
                        <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('채팅')}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => setComposing((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={composing ? '엽서 쓰기 닫기' : `${p.nickname}님에게 엽서 쓰기`}
                      accessibilityState={{ expanded: composing }}
                      hitSlop={8}
                      style={({ pressed }) => [styles.visitorLink, pressed && styles.pressed]}
                    >
                      <EnvelopeLine color={composing ? colors.textFaint : colors.accent} />
                      <Text style={[typeScale.monoLabel, { color: composing ? colors.textFaint : colors.accent }]}>
                        {linkLabel(composing ? '엽서 닫기' : '엽서 쓰기', 'action')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
          {mine ? (
            // 설정은 탭이 아니라 여기서 들어간다 — 프로필 행 오른쪽 끝, 팔로워 줄에 밑선을 맞춘다.
            <Pressable
              ref={settingsTourRef}
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="설정"
              hitSlop={8}
              style={({ pressed }) => [
                styles.settingsButton,
                glassFace(colors, colors.tonal),
                pressed && styles.pressed,
              ]}
            >
              <GearLine size={14} color={colors.text} />
              <Text style={[styles.settingsLabel, { color: colors.text }]}>설정</Text>
            </Pressable>
          ) : userId != null ? (
            // 팔로우는 앱에서 이 자리에서만 한다 — '나' 화면 설정 버튼과 같은 자리(프로필 줄 오른쪽 위).
            <View style={styles.followSlot}>
              <FollowButton userId={userId} nickname={p?.nickname} followsMe={p?.followsMe} />
            </View>
          ) : null}
        </View>

        {!mine && (chatError || composing) && p && userId != null ? (
          <View style={[styles.block, styles.visitorActions]}>
            {chatError ? (
              <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
                {chatError}
              </Text>
            ) : null}
            {composing ? (
              <PostcardComposer
                toUserId={userId}
                toNickname={p.nickname}
                onDone={() => setComposing(false)}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 2. 오늘(나만) — 지갑이 출석보다 위다. 출석 카드는 응답이 와야 그려지므로 아래에 두면
          지갑이 늦게 밀려 내려가 오터치가 난다. */}
      {mine ? (
        <View style={styles.group}>
          <MyWalletRow />
          <AttendanceCard />
        </View>
      ) : null}

      {/* 3. 기록 — 같은 까닭으로 자리표시로 크기를 먼저 잡는 선반이 앞, 통계가 와야 그려지는 기록 카드가 뒤다. */}
      <View style={styles.group}>
        <View style={styles.shelfSection}>
          <View style={styles.shelfHeader}>
            <Text style={[typeScale.titleSerif, styles.shelfTitle, { color: colors.text }]}>
              {mine ? '내 서재' : '서재'}
            </Text>
            {mine ? (
              <TextLink
                label={`${libraryTotal}권 · 전체 보기`}
                onPress={() => router.push('/library')}
                hitSlop={SHELF_ALL_HIT_SLOP}
                accessibilityLabel={`서재 전체 보기, 총 ${libraryTotal}권`}
              />
            ) : (
              <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{libraryTotal}권</Text>
            )}
          </View>

          {shelfLoading ? (
            <View style={styles.shelfList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.shelfSkeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : shelf.length === 0 && mine ? (
            <View style={styles.shelfList}>
              <Pressable
                onPress={() => router.navigate('/book-search')}
                accessibilityRole="button"
                accessibilityLabel="책 추가"
              >
                <View style={[styles.shelfGhost, { borderColor: colors.control }]}>
                  <Text style={[typeScale.titleSerif, { color: colors.text }]}>+</Text>
                  <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>책 추가</Text>
                </View>
              </Pressable>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.shelfGhost, { borderColor: colors.lineStrong }]} />
              ))}
            </View>
          ) : shelf.length === 0 ? (
            <Text style={[typeScale.caption, styles.shelfEmpty, { color: colors.textFaint }]}>
              서재에 담긴 책이 아직 없어요.
            </Text>
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
                  entranceScope={mine ? 'me' : `u${userId}`}
                  onPress={() => {
                    if (record.book?.id == null) return;
                    // 남의 기록 id 는 내 서재 상세에 쓸 수 없다 — 책 상세로만 보낸다.
                    router.push(mine ? `/book/${record.book.id}?recordId=${record.id}` : `/book/${record.book.id}`);
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
                    <StatCell label="연속 독서" value={`${stats.data.currentStreakDays}일`} />
                    <VRule />
                    <StatCell label="최장연속" value={`${stats.data.longestStreakDays}일`} />
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
                    <KeyValue label="총 독서 시간" value={formatDuration(stats.data.totalDurationSec)} />
                    <Rule />
                    <KeyValue label="오늘" value={formatDuration(stats.data.todayDurationSec)} />
                    <Rule />
                    <KeyValue
                      label="읽은 날"
                      value={`${heatDaily.filter((d) => d.sessionCount > 0).length}일 / ${heatDaily.length}일`}
                    />
                  </View>
                </>
              ) : (
                <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
                  통계를 불러오지 못했어요.
                </Text>
              )}
            </Card>
          </View>
        )}

        {mine ? <MyScraps finishedCount={counts?.finished} /> : userId != null ? <PublicPosts userId={userId} /> : null}
      </View>
    </KeyboardScroll>
  );
}

/** 프로필 줄의 '팔로워 12' 한 칸 — 숫자만 본문색 세미볼드. */
function SocialCount({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.socialText, { color: colors.textMuted }]}>
      {label}{' '}
      <Text style={[styles.profileCount, { color: colors.text }]}>{value}</Text>
    </Text>
  );
}

/**
 * 지갑 메모 + 방문 스티키 — 예전 '전부 보기' 조각 행과 같은 꼴.
 * 메모는 잔액 요약이고 누르면 지갑 화면(교환·구독·책갈피 구매)으로, 스티키는 방문자 화면으로 간다.
 */
function MyWalletRow() {
  const router = useRouter();
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);
  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const subscribed = wallet.data?.subscriptionActive ?? false;
  const visitCount = myProfile.data?.visitCount ?? 0;

  return (
    <View style={[styles.block, styles.scrapRow]}>
      <Pressable
        onPress={() => router.push('/wallet')}
        accessibilityRole="button"
        accessibilityLabel={`지갑, 책갈피 ${wallet.data?.bookmarkBalance ?? 0}개 · 엽서 ${wallet.data?.postcardBalance ?? 0}장 · 무료 엽서 ${wallet.data?.freePostcardsLeftToday ?? 0}장 · 우표 ${wallet.data?.stampBalance ?? 0}개, 교환·구독 열기`}
        style={({ pressed }) => [styles.walletPress, pressed && styles.pressed]}
      >
        <MemoScrap rotate={-0.8} style={styles.walletMemo}>
          <View style={styles.walletHead}>
            <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>지갑</Text>
            <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>{linkLabel('교환·구독')}</Text>
          </View>
          <View style={styles.walletRow}>
            <WalletCell value={wallet.data?.bookmarkBalance ?? 0} label="책갈피" />
            <WalletCell value={wallet.data?.postcardBalance ?? 0} label="엽서" />
            <WalletCell value={wallet.data?.freePostcardsLeftToday ?? 0} label="무료 엽서" />
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
          <Text style={[typeScale.monoEyebrow, styles.visitAction, { color: colors.onNote }]}>{linkLabel('확인하기')}</Text>
        </StickyNote>
      </Pressable>
    </View>
  );
}

/** 남의 공개 독후감 — 피드에서 휘발된 글도 여기엔 쌓인다. 누르면 독후감 상세로. */
function PublicPosts({ userId }: { userId: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const posts = useInfiniteQuery({
    queryKey: ['userPosts', userId, POSTS_PAGE],
    queryFn: ({ pageParam }) => postApi.byUser(userId, pageParam, POSTS_PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });
  const items: Post[] = posts.data?.pages.flatMap((page) => page.content ?? []) ?? [];

  return (
    <View style={[styles.block, styles.postsSection]}>
      <Eyebrow>공개 독후감</Eyebrow>
      {posts.isLoading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : posts.isError ? (
        <EmptyState
          title="독후감을 불러오지 못했어요"
          action={<Button label="다시 시도" variant="outline" onPress={() => posts.refetch()} />}
        />
      ) : items.length === 0 ? (
        <EmptyState title="아직 공개한 독후감이 없어요" />
      ) : (
        <>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/post/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} 독후감 열기`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card>
                <Text numberOfLines={2} style={[styles.postTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[typeScale.body, { color: colors.textMuted }]} numberOfLines={3}>
                  {item.excerpt}
                </Text>
                <View style={styles.postFoot}>
                  {item.bookTitle ? (
                    <Text style={[typeScale.caption, { color: colors.textFaint, flex: 1 }]} numberOfLines={1}>
                      『{item.bookTitle}』
                    </Text>
                  ) : <View style={{ flex: 1 }} />}
                  <View style={styles.postStat}>
                    <LikeCount count={item.likeCount} textStyle={[typeScale.monoLabel, { color: colors.textFaint }]} />
                    <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                      {` · ${formatRelative(item.publishedAt ?? item.createdAt)}`}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
          {posts.hasNextPage ? (
            <View style={styles.more}>
              {posts.isFetchingNextPage ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <TextLink label="더 보기" kind="action" onPress={() => posts.fetchNextPage()} />
              )}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// 장식용 아이콘 — aria-hidden 은 RN 이 네이티브 접근성 숨김으로 옮기고 웹은 그대로 쓴다.
// (accessibilityElementsHidden 은 react-native-svg 웹에서 DOM 에 새어 React 경고가 뜬다)
/** 톱니 — 예전 하단 탭 '설정' 아이콘과 같은 꼴. */
function GearLine({ size, color }: { size: number; color: string }) {
  const stroke = { stroke: color, ...iconStroke };
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
        {...iconStroke}
        strokeWidth={2.1}
      />
      <Path
        d="m14.5 5.8 3.7 3.7"
        stroke={color}
        {...iconStroke}
        strokeWidth={2.1}
      />
    </Svg>
  );
}

/** 말풍선 — 채팅 링크 앞. */
function ChatLine({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M4 5h16v11H9l-5 4z" stroke={color} {...iconStroke} />
    </Svg>
  );
}

/** 봉투 — 엽서 쓰기 링크 앞. */
function EnvelopeLine({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M3 6h18v13H3z" stroke={color} {...iconStroke} />
      <Path d="m3 7 9 6 9-6" stroke={color} {...iconStroke} />
    </Svg>
  );
}

/**
 * '내 독후감' · '완독 카드' — 프로필에서는 목록을 펼치지 않고 제 화면으로 보내는 링크만 둔다.
 * 둘 다 내가 남긴 것을 모아 보는 입구라 한 카드에 괘선으로 나눠 묶는다(섹션을 늘리지 않는다 — Hick).
 * 완독 카드 수는 서재 상태별 개수(finished)를 그대로 쓴다 — 다 읽은 회차마다 한 장이다.
 *
 * 개수는 size 1 응답의 totalElements 로 센다 — 목록은 /post/mine 의 몫이라 그 이상은 받지 않는다.
 * 서버가 totalElements 를 생략했거나 아직 못 받았으면 개수 없이 링크만 보인다. 0건이어도 링크는 남긴다 —
 * 들어간 화면의 빈 상태가 첫 독후감을 권한다.
 */
function MyScraps({ finishedCount }: { finishedCount?: number }) {
  const router = useRouter();
  const posts = useQuery({ queryKey: MY_POSTS_LATEST_KEY, queryFn: () => postApi.mine(0, 1) });

  return (
    <View style={styles.block}>
      <Card>
        <LinkRow
          label="내 독후감"
          count={posts.data?.totalElements}
          unit="편"
          onPress={() => router.push('/post/mine')}
        />
        <Rule />
        <LinkRow
          label="완독 카드"
          count={finishedCount}
          unit="장"
          onPress={() => router.push('/finish-cards')}
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
        {linkLabel(count != null ? `${count}${unit}` : '보기')}
      </Text>
    </Pressable>
  );
}

/**
 * 선반 한 칸 — 표지 + 진행 트랙 + 제목 + 상태.
 * 표지와 아래 활자는 같은 index·entranceKey 로 입장 진행값을 공유해 한 조각처럼 앉는다.
 */
function ShelfItem({ record, index, entranceScope, onPress }: {
  record: ReadingRecord;
  index: number;
  /** 입장 애니메이션 키 앞머리 — 내 선반과 남의 선반이 같은 책으로 키가 겹치지 않게 가른다. */
  entranceScope: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const offsetY = rowOffsetY[index % rowOffsetY.length];
  // 책 id 와 기록 id 는 다른 시퀀스라 섞으면 서로 다른 책이 같은 키를 가질 수 있다 — 접두로 갈라 둔다.
  const entranceKey = record.book?.id != null
    ? `${entranceScope}-shelf:b${record.book.id}`
    : `${entranceScope}-shelf:r${record.id}`;
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
  // '2시간 30분'처럼 긴 값은 세 칸 폭(≈100px)에 안 들어가 두 줄로 꺾인다 — 길면 한 치수 줄이고 한 줄로 고정한다.
  // adjustsFontSizeToFit 은 웹이 무시하므로 글자 수로도 한 번 줄인다.
  const long = value.length >= 6;
  return (
    <View style={styles.statCell}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[typeScale.monoNumeral, styles.statValue, long && styles.statValueLong, { color: colors.text }]}
      >
        {value}
      </Text>
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
  // 묶음(프로필·오늘·기록) 사이는 xxl, 묶음 안은 md — 상자나 선 없이 간격만으로 세 덩이가 갈린다.
  container: { ...layout.content, gap: spacing.xxl, paddingBottom: NAV_CLEARANCE, paddingTop: spacing.lg },
  group: { gap: spacing.md },
  block: { paddingHorizontal: spacing.lg },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatarButton: { width: AVATAR, height: AVATAR, borderRadius: radius.round },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.round,
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
    borderRadius: radius.round,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, gap: 5 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 시안의 프로필 표제는 히어로보다 작다 — displaySerif 를 22로 줄여 쓴다.
  nickname: { ...typeScale.displaySerif, flexShrink: 1, fontSize: 22, lineHeight: 30 },
  // 닉네임 옆 연필은 상자 없이 둔다(사용자 결정 2026-10-04 — 테두리 상자로 바꿨다가 되돌림).
  editButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  // alignSelf 로 행의 가운데 정렬에서 빠져나와 팔로워·팔로잉 줄에 밑선을 맞춘다.
  // 겉모습은 Button sm(32pt · 회색 톤 유리 · control 모서리)과 같고 터치 상자는 hitSlop 으로 넓힌다.
  settingsButton: {
    alignSelf: 'flex-end',
    height: controlHeight.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  settingsLabel: { ...typeScale.label, fontSize: 12 },
  profileMeta: { letterSpacing: 0.4 },
  // 팔로워·팔로잉 줄 — 캡션(12)으로는 작아 눌러 볼 곳으로 읽히지 않아 본문 크기(15)로 키웠다(2026-10-04).
  socialText: { fontFamily: sans.regular, fontSize: 16, lineHeight: 24 },
  profileCount: { fontFamily: sans.semiBold, fontSize: 19, lineHeight: 24 },
  // 칸 사이는 '·' 없이 간격(md)으로만 가른다 — 360pt 에서 세 자리 숫자까지 한 줄에 들고,
  // 더 길어져 다음 줄로 넘어가도 줄 끝에 점만 덩그러니 남지 않는다.
  profileSocial: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    columnGap: spacing.md, rowGap: spacing.xs, alignSelf: 'flex-start',
  },
  pressed: pressedStyle,

  scrapRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  walletPress: { flex: 1 },
  walletMemo: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md + 2 },
  walletHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 네 칸을 메모 폭에 고르게 편다 — 왼쪽에 몰리면 오른쪽이 빈 종이로 남는다.
  walletRow: { flexDirection: 'row', gap: spacing.sm },
  walletCell: { flex: 1, gap: 2 },
  walletValue: { fontSize: 17, lineHeight: 22 },
  walletLabel: { fontSize: 11 },
  visitNote: { width: 92, justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
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
  statValueLong: { fontSize: 15 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  heatmap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginTop: spacing.md },
  heatWeek: { gap: 3 },
  heatCell: { width: 11, height: 11, borderRadius: radius.sm },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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

  missing: { ...layout.content, paddingTop: spacing.xl },
  shelfEmpty: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  visitorActions: { gap: spacing.sm },
  // 링크 두 개 사이를 spacing.lg 로 띄워 오터치를 막는다 — 글자는 작아도 hitSlop 으로 44pt 가까이 받는다.
  visitorLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 },
  visitorLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  followSlot: { alignSelf: 'flex-start', marginTop: spacing.xs },
  postsSection: { gap: spacing.md },
  postTitle: { fontFamily: serif.bold, fontSize: 16, lineHeight: 23, marginBottom: spacing.xs },
  postFoot: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  postStat: { flexDirection: 'row', alignItems: 'center' },
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
