import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, walletApi } from '@/api/endpoints';
import type { ClubHome, ClubSeatPolicy, WalletView } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, EmptyState, Eyebrow, KeyValue, Loading, Rule, Segmented, Tag } from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 자리 늘리기 — 모임 홈의 '자리 늘리기'로 들어온다(호스트 전용).
 *
 * 무료 정원을 넘는 자리는 책갈피로 연다. 가격·상한은 모임 홈 응답의 seatPolicy 를 따르고,
 * 늘린 자리는 그 모임에만 적용되며 모임이 끝나면 사라진다(서버 정책).
 */
export default function ClubSeatsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });

  if (club.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="자리 늘리기" />
        <Loading />
      </PaperScreen>
    );
  }
  const data = club.data;
  if (!data || !data.seatPolicy) {
    return (
      <PaperScreen>
        <SubHeader category="자리 늘리기" />
        <Text style={[styles.error, { color: colors.danger }]}>모임을 불러오지 못했습니다.</Text>
      </PaperScreen>
    );
  }
  // 딥링크로 멤버가 들어오면 모임 홈으로 돌려보낸다 — 서버도 CLUB_NOT_HOST 로 막는다.
  if (data.myRole !== 'HOST') {
    return <Redirect href={`/club/${clubId}`} />;
  }

  return (
    <SeatsForm
      club={data}
      policy={data.seatPolicy}
      wallet={wallet.data}
      colors={colors}
      onExpanded={(memberLimit, bookmarkBalance) => {
        // 서버 응답으로 두 캐시를 바로 맞추고, 멤버 목록 등 나머지는 다시 받는다.
        queryClient.setQueryData<ClubHome>(['club', clubId], (prev) => (prev ? { ...prev, memberLimit } : prev));
        queryClient.setQueryData<WalletView>(['wallet'], (prev) => (prev ? { ...prev, bookmarkBalance } : prev));
        queryClient.invalidateQueries({ queryKey: ['club', clubId] });
        queryClient.invalidateQueries({ queryKey: ['clubs'] });
        // 딥링크·웹 새로고침으로 들어와 돌아갈 곳이 없으면 back() 이 아무 일도 하지 않는다 — 그때는 모임 홈으로.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(`/club/${clubId}`);
        }
      }}
      onInsufficient={() => wallet.refetch()}
    />
  );
}

function SeatsForm({ club, policy, wallet, colors, onExpanded, onInsufficient }: {
  club: ClubHome;
  policy: ClubSeatPolicy;
  wallet?: WalletView;
  colors: ColorTokens;
  onExpanded: (memberLimit: number, bookmarkBalance: number) => void;
  onInsufficient: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(String(policy.maxLimit));
  const [error, setError] = useState<string | null>(null);

  const expand = useMutation({
    mutationFn: () => clubApi.expandSeats(club.id, Number(target)),
    onMutate: () => setError(null),
    onSuccess: (result) => onExpanded(result.memberLimit, result.bookmarkBalance),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_BOOKMARK') {
        // 다른 기기에서 책갈피를 썼을 수 있다 — 잔액을 다시 받아 부족 상태로 보여준다.
        onInsufficient();
      }
      setError(e instanceof ApiError ? e.message : '자리를 늘리지 못했어요 · 다시 시도');
    },
  });

  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';
  if (ended || club.memberLimit >= policy.maxLimit) {
    return (
      <PaperScreen>
        <SubHeader category="자리 늘리기" />
        <EmptyState
          title={ended ? '끝난 모임이에요' : '이미 최대 정원이에요'}
          description={
            ended
              ? '늘린 자리는 모임이 끝나면 사라져요.'
              : `모임은 최대 ${policy.maxLimit}명까지 함께 읽을 수 있어요.`
          }
        />
      </PaperScreen>
    );
  }

  const options = Array.from({ length: policy.maxLimit - club.memberLimit }, (_, i) => {
    const value = club.memberLimit + i + 1;
    return { value: String(value), label: `${value}명` };
  });
  const targetLimit = Number(target);
  const added = targetLimit - club.memberLimit;
  const cost = added * policy.costPerSeat;
  const balance = wallet?.bookmarkBalance;
  const shortage = balance == null ? 0 : Math.max(0, cost - balance);
  const affordableLimit = balance == null
    ? club.memberLimit
    : Math.min(policy.maxLimit, club.memberLimit + Math.floor(balance / policy.costPerSeat));

  return (
    <PaperScreen>
      <SubHeader category="자리 늘리기" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <Card style={styles.hero}>
            <Tag label={club.name} fg={colors.accent} bg={colors.accentSoft} />
            <Text style={[styles.title, { color: colors.text }]}>자리를 열고{'\n'}한 명 더 초대해요</Text>
            <Text style={[typeScale.body, { color: colors.textMuted }]}>
              모임은 {policy.freeLimit}명까지 무료예요. 책갈피로 자리를 늘리면 최대 {policy.maxLimit}명까지 함께 읽을 수 있어요.
            </Text>
            <SeatGrid club={club} targetLimit={targetLimit} maxLimit={policy.maxLimit} colors={colors} />
          </Card>

          <Card>
            <Eyebrow plain>늘릴 인원</Eyebrow>
            <View style={{ marginTop: spacing.md }}>
              <Segmented options={options} value={target} onChange={setTarget} />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="추가 자리" value={`${added}자리`} />
              <Rule />
              <KeyValue
                label="필요한 책갈피"
                value={
                  <Text style={{ color: colors.accent }}>
                    {cost}개{' '}
                    <Text style={{ color: colors.textFaint }}>({policy.costPerSeat} × {added}자리)</Text>
                  </Text>
                }
              />
              <Rule />
              <KeyValue label="내 책갈피" value={balance == null ? '—' : `${balance}개`} />
              {shortage > 0 ? (
                <>
                  <Rule />
                  <KeyValue label="부족한 책갈피" value={<Text style={{ color: colors.warn }}>{shortage}개</Text>} />
                </>
              ) : null}
            </View>
            {shortage > 0 && affordableLimit > club.memberLimit ? (
              <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
                지금 책갈피로는 {affordableLimit}명까지 늘릴 수 있어요.
              </Text>
            ) : null}
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              늘린 자리는 이 모임에만 적용되고, 모임이 끝나면 사라져요.
            </Text>
          </Card>

          {error ? (
            <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {shortage > 0 ? (
              <>
                <Button label={`책갈피 ${shortage}개 더 구매하기 →`} onPress={() => router.push('/bookmarks')} />
                <Button label="책갈피로 자리 늘리기" variant="outline" disabled />
              </>
            ) : (
              <>
                <Button
                  label="책갈피로 자리 늘리기"
                  onPress={() => expand.mutate()}
                  loading={expand.isPending}
                  disabled={balance == null}
                />
                <Button label="책갈피 구매 →" variant="outline" onPress={() => router.push('/bookmarks')} />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

/** 자리 격자 — 지금 멤버(이니셜) · 이번에 열 자리(악센트 점선 +) · 그 너머 자리(흐린 점선). */
function SeatGrid({ club, targetLimit, maxLimit, colors }: {
  club: ClubHome;
  targetLimit: number;
  maxLimit: number;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.seatGrid} accessible accessibilityLabel={`${club.memberLimit}명에서 ${targetLimit}명으로`}>
      {Array.from({ length: maxLimit }, (_, i) => {
        const member = club.members[i];
        const isNew = i >= club.memberLimit && i < targetLimit;
        const isOpen = !member && i < club.memberLimit;
        return (
          <View key={i} style={styles.seatCell}>
            <View
              style={[
                styles.seat,
                member
                  ? { backgroundColor: colors.surfaceRaised, borderColor: member.isMe ? colors.accent : colors.lineStrong }
                  : isOpen
                    ? { borderColor: colors.lineStrong }
                    : { borderStyle: 'dashed', borderColor: isNew ? colors.accent : colors.line },
              ]}
            >
              {member ? (
                <Text style={[typeScale.label, { color: colors.text }]}>{member.nickname.slice(0, 1)}</Text>
              ) : isNew ? (
                <Text style={[typeScale.label, { color: colors.accent }]}>+</Text>
              ) : null}
            </View>
            <Text style={[typeScale.monoLabel, { color: isNew ? colors.accent : colors.textFaint }]}>{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.md },
  title: { ...typeScale.title, lineHeight: 30 },
  hint: { marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  seatGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  seatCell: { alignItems: 'center', gap: 6 },
  seat: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typeScale.body, padding: spacing.lg },
});
