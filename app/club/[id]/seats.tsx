import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi, walletApi } from '@/api/endpoints';
import type { ClubHome, ClubSeatPolicy, WalletView } from '@/api/types';
import { ReturnToClubHome } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, EmptyState, Eyebrow, KeyValue, Loading, Rule, Segmented, linkLabel } from '@/components/ui';
import type { ColorTokens } from '@/theme';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 자리 늘리기 — 클럽 정보(초대 코드 밑)와 클럽 설정의 '자리 늘리기'로 들어온다(호스트 전용).
 *
 * 무료 정원을 넘는 자리는 책갈피로 연다 — 정해진 단위(step, 10자리)씩만. 가격·상한·단위는 클럽 홈 응답의
 * seatPolicy 를 따르고, 늘린 자리는 그 클럽에만 적용되며 클럽이 끝나면 사라진다(서버 정책).
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
        <EmptyState
          title="클럽을 불러오지 못했어요"
          description={club.error instanceof ApiError ? club.error.message : undefined}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => club.refetch()} />}
        />
      </PaperScreen>
    );
  }
  // 딥링크로 멤버가 들어오면 클럽 홈으로 돌려보낸다 — 서버도 CLUB_NOT_HOST 로 막는다.
  if (data.myRole !== 'HOST') {
    return <ReturnToClubHome clubId={clubId} />;
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
        // 딥링크·웹 새로고침으로 들어와 돌아갈 곳이 없으면 back() 이 아무 일도 하지 않는다 — 그때는 클럽 홈으로.
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
  // 고를 수 있는 정원 — 지금 정원 다음 단위부터 최대 정원까지. 기본값은 가장 흔한 한 단위(UX 철칙 Hick).
  const options = seatTargets(club.memberLimit, policy).map((value) => ({ value: String(value), label: `${value}명` }));
  const [target, setTarget] = useState(options[0]?.value ?? String(policy.maxLimit));
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
  if (ended || options.length === 0) {
    return (
      <PaperScreen>
        <SubHeader category="자리 늘리기" />
        <EmptyState
          title={ended ? '끝난 클럽이에요' : '이미 최대 정원이에요'}
          description={
            ended
              ? '늘린 자리는 클럽이 끝나면 사라져요.'
              : `클럽은 최대 ${policy.maxLimit}명까지 함께 읽을 수 있어요.`
          }
        />
      </PaperScreen>
    );
  }

  const costOf = (limit: number) => (limit - club.memberLimit) * policy.costPerSeat;
  const targetLimit = Number(target);
  const added = targetLimit - club.memberLimit;
  const cost = costOf(targetLimit);
  const balance = wallet?.bookmarkBalance;
  const shortage = balance == null ? 0 : Math.max(0, cost - balance);
  // 지금 책갈피로 고를 수 있는 가장 큰 정원 — 한 단위도 못 열면 없다.
  const affordableLimit = balance == null
    ? undefined
    : options.map((o) => Number(o.value)).filter((limit) => costOf(limit) <= balance).pop();

  return (
    <PaperScreen>
      <SubHeader category="자리 늘리기" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          {/* 머리 — 카드 없이 명조 표제와 자리 격자(활자·괘선 언어) */}
          <View style={styles.hero}>
            <Eyebrow>{club.name}</Eyebrow>
            <Text style={[styles.title, { color: colors.text }]}>자리를 열고{'\n'}더 많이 초대해요</Text>
            <Text style={[typeScale.body, { color: colors.textMuted }]}>
              클럽은 {policy.freeLimit}명까지 무료예요. 책갈피로 {policy.step}명씩, 최대 {policy.maxLimit}명까지 늘릴 수 있어요.
            </Text>
            <SeatGrid club={club} targetLimit={targetLimit} policy={policy} colors={colors} />
          </View>

          <View style={[styles.section, { borderTopColor: colors.line }]}>
            <Eyebrow>늘릴 인원</Eyebrow>
            <View style={{ marginTop: spacing.md }}>
              <Segmented options={options} value={target} onChange={setTarget} />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="추가 자리" value={`${added}자리`} />
              <Rule />
              <KeyValue
                label="필요한 책갈피"
                value={
                  <Text style={{ color: colors.text }}>
                    {cost}개{' '}
                    <Text style={{ color: colors.textFaint }}>({policy.step}자리마다 {policy.step * policy.costPerSeat}개)</Text>
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
            {shortage > 0 && affordableLimit != null ? (
              <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
                지금 책갈피로는 {affordableLimit}명까지 늘릴 수 있어요.
              </Text>
            ) : null}
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              늘린 자리는 이 클럽에만 적용되고, 클럽이 끝나면 사라져요. 쓴 책갈피는 환불되지 않아요.
            </Text>
          </View>

          {error ? (
            <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {shortage > 0 ? (
              <>
                <Button label={`책갈피 ${shortage}개 더 구매하기`} onPress={() => router.push('/bookmarks')} />
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
                <Button label="책갈피 구매" variant="outline" onPress={() => router.push('/bookmarks')} />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

/** 고를 수 있는 목표 정원 — 지금 정원보다 큰 step 의 배수부터 최대 정원까지(서버가 같은 규칙으로 검사한다). */
function seatTargets(memberLimit: number, policy: ClubSeatPolicy): number[] {
  const targets: number[] = [];
  for (let limit = (Math.floor(memberLimit / policy.step) + 1) * policy.step; limit <= policy.maxLimit; limit += policy.step) {
    targets.push(limit);
  }
  return targets;
}

/**
 * 자리 격자 — 한 줄이 늘리는 단위(10자리)이고, 줄 끝 숫자가 그 줄까지의 정원이다.
 * 지금 멤버(채운 점, 나는 잉크) · 빈 자리(실선) · 이번에 열 자리(잉크 점선) · 그 너머 자리(흐린 점선).
 */
function SeatGrid({ club, targetLimit, policy, colors }: {
  club: ClubHome;
  targetLimit: number;
  policy: ClubSeatPolicy;
  colors: ColorTokens;
}) {
  const rows = Math.ceil(policy.maxLimit / policy.step);
  return (
    <View style={styles.seatGrid} accessible accessibilityLabel={`${club.memberLimit}명에서 ${targetLimit}명으로`}>
      {Array.from({ length: rows }, (_, row) => {
        const first = row * policy.step;
        const rowEnd = Math.min(first + policy.step, policy.maxLimit);
        const opensHere = rowEnd > club.memberLimit && rowEnd <= targetLimit;
        return (
          <View key={row} style={styles.seatRow}>
            <View style={styles.seatDots}>
              {Array.from({ length: policy.step }, (_, col) => {
                const i = first + col;
                // 최대 정원이 단위로 나눠떨어지지 않으면 마지막 줄 남는 칸은 비워 둬 점 간격을 맞춘다.
                if (i >= rowEnd) return <View key={i} style={styles.seatSlot} />;
                const member = club.members[i];
                const isNew = i >= club.memberLimit && i < targetLimit;
                const isOpen = !member && i < club.memberLimit;
                return (
                  <View
                    key={i}
                    style={[
                      styles.seat,
                      member
                        ? { backgroundColor: member.isMe ? colors.ink : colors.textFaint, borderColor: member.isMe ? colors.ink : colors.textFaint }
                        : isOpen
                          ? { borderColor: colors.lineStrong }
                          : { borderStyle: 'dashed', borderColor: isNew ? colors.ink : colors.line },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={[typeScale.monoLabel, styles.seatRowEnd, { color: opensHere ? colors.text : colors.textFaint }]}>
              {rowEnd}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  hero: { gap: spacing.md, paddingTop: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 24, lineHeight: 32 },
  section: { borderTopWidth: hairline, paddingTop: spacing.lg },
  hint: { marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  seatGrid: { gap: spacing.sm, marginTop: spacing.xs },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seatDots: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  // 줄 끝 숫자 — 두 자리 정원이 같은 폭에 오른쪽으로 맞춰지게 폭을 고정한다.
  seatRowEnd: { width: 24, textAlign: 'right' },
  seatSlot: { width: 18, height: 18 },
  seat: { width: 18, height: 18, borderRadius: radius.round, borderWidth: 1 },
});
