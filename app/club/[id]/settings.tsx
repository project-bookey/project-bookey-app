import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import type { ClubHome, ClubVisibility, MemberProgress } from '@/api/types';
import { confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { Avatar } from '@/components/Avatar';
import {
  Button, EmptyState, Eyebrow, Field, FootAction, KeyValue, Loading, Rule, Segmented, Tag, Toggle, linkLabel,
} from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

const VISIBILITIES: { value: ClubVisibility; label: string; description: string }[] = [
  { value: 'CODE_ONLY', label: '코드로만', description: '초대 코드를 아는 사람만 참가할 수 있어요.' },
  { value: 'LINK', label: '링크', description: '초대 링크를 받은 사람이 참가할 수 있어요.' },
  { value: 'PUBLIC', label: '공개', description: '추천 클럽에 노출되고 누구나 참가할 수 있어요.' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 클럽 설정 — 클럽을 연 사람(호스트)만. 목록의 '관리' 칩과 클럽 정보의 톱니에서 들어온다.
 * 멤버가 딥링크로 들어오면 클럽 홈으로 돌려보낸다(서버도 CLUB_NOT_HOST 로 막는다).
 */
export default function ClubSettingsScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const club = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => clubApi.home(clubId),
    enabled: Number.isFinite(clubId),
    retry: false,
  });

  if (club.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="클럽 설정" />
        <Loading />
      </PaperScreen>
    );
  }
  if (!club.data) {
    return (
      <PaperScreen>
        <SubHeader category="클럽 설정" />
        <EmptyState
          title="클럽을 불러오지 못했어요"
          description={club.error instanceof ApiError ? club.error.message : undefined}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => club.refetch()} />}
        />
      </PaperScreen>
    );
  }
  if (club.data.myRole !== 'HOST') {
    return <Redirect href={`/club/${clubId}`} />;
  }
  // 입력 초기값을 서버 값으로 잡으려고 폼을 따로 둔다 — 클럽이 바뀌면 key 로 다시 만든다.
  return <SettingsForm key={club.data.id} club={club.data} />;
}

function SettingsForm({ club }: { club: ClubHome }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const clubId = club.id;
  const ended = club.status === 'ENDED' || club.status === 'ARCHIVED';

  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [endsAt, setEndsAt] = useState(club.endsAt);
  const [kickTarget, setKickTarget] = useState<MemberProgress | null>(null);
  const [kickReason, setKickReason] = useState('');

  const fail = (e: unknown, fallback: string) => notify(e instanceof ApiError ? e.message : fallback);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['club', clubId] });
    queryClient.invalidateQueries({ queryKey: ['clubs'] });
  };

  const update = useMutation({
    mutationFn: (body: Parameters<typeof clubApi.update>[1]) => clubApi.update(clubId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['club', clubId], updated);
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onError: (e) => fail(e, '저장하지 못했습니다.'),
  });
  const rotate = useMutation({
    mutationFn: () => clubApi.rotateCode(clubId),
    onSuccess: () => {
      invalidate();
      notify('초대 코드를 새로 발급했어요.');
    },
    onError: (e) => fail(e, '재발급하지 못했습니다.'),
  });
  const kick = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) => clubApi.kick(clubId, userId, reason),
    onSuccess: () => {
      setKickTarget(null);
      setKickReason('');
      invalidate();
      notify('내보냈어요.');
    },
    onError: (e) => fail(e, '내보내지 못했습니다.'),
  });
  const transfer = useMutation({
    mutationFn: (userId: number) => clubApi.transferHost(clubId, userId),
    onSuccess: () => {
      invalidate();
      notify('호스트를 넘겼어요. 이제 멤버로 함께 읽어요.');
      router.replace(`/club/${clubId}`);
    },
    onError: (e) => fail(e, '넘기지 못했습니다.'),
  });
  const end = useMutation({
    mutationFn: () => clubApi.end(clubId),
    onSuccess: () => {
      invalidate();
      router.replace(`/club/${clubId}`);
    },
    onError: (e) => fail(e, '종료하지 못했습니다.'),
  });

  const infoDirty = name.trim() !== club.name || description.trim() !== (club.description ?? '');
  const endsAtValid = DATE_RE.test(endsAt) && endsAt >= club.startsAt;
  const others = club.members.filter((m) => !m.isMe);
  const expandable = club.seatPolicy && club.memberLimit < club.seatPolicy.maxLimit;

  return (
    <PaperScreen>
      <SubHeader category="클럽 설정" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* 머리 — 클럽 홈과 같은 활자·괘선 언어: 명조 이름 + 모노 책·저자 줄 */}
        <View style={styles.header}>
          <TiltCover uri={club.book?.coverUrl} title={club.book?.title} width={44} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{club.name}</Text>
            <Text style={[styles.bookLine, { color: colors.textMuted }]} numberOfLines={1}>
              {[club.book?.title, club.book?.author].filter(Boolean).join(' · ')}
            </Text>
            {ended ? (
              <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>종료된 클럽</Text>
            ) : null}
          </View>
        </View>

        <Section title="기본 정보">
          <Field label="클럽 이름" value={name} onChangeText={setName} maxLength={60} placeholder="예: 회사 독서 클럽" />
          <Field
            label="소개"
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
            placeholder="어떤 클럽인지 한 줄로"
          />
          <Button
            label="저장"
            size="sm"
            disabled={!infoDirty || name.trim().length === 0}
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { name: name.trim(), description: description.trim() },
                { onSuccess: () => notify('저장했어요.') },
              )}
          />
        </Section>

        <Section title="공개 범위" gap={spacing.sm}>
          <Segmented
            options={VISIBILITIES.map((v) => ({ value: v.value, label: v.label }))}
            value={club.visibility}
            onChange={(visibility) => update.mutate({ visibility })}
          />
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            {VISIBILITIES.find((v) => v.value === club.visibility)?.description}
          </Text>
        </Section>

        <Section title="기간 · 찌르기">
          <KeyValue label="시작일" value={club.startsAt} />
          <Rule />
          <View style={styles.inlineField}>
            <View style={{ flex: 1 }}>
              <Field
                label="종료일"
                value={endsAt}
                onChangeText={setEndsAt}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                error={endsAt !== club.endsAt && !endsAtValid ? '시작일 이후 날짜를 YYYY-MM-DD 로 적어주세요.' : null}
              />
            </View>
            <Button
              label="저장"
              size="sm"
              variant="outline"
              disabled={endsAt === club.endsAt || !endsAtValid}
              loading={update.isPending}
              onPress={() => update.mutate({ endsAt }, { onSuccess: () => notify('종료일을 바꿨어요.') })}
            />
          </View>
          <Rule />
          <Toggle
            label="찌르기 허용"
            description="끄면 이 클럽에서는 아무도 찌르기를 보낼 수 없어요."
            value={club.allowNudge}
            onChange={(allowNudge) => update.mutate({ allowNudge })}
          />
        </Section>

        <Section title="초대 · 자리">
          <View style={styles.rowBetween}>
            <View>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>초대 코드</Text>
              <Text style={[styles.code, { color: colors.text }]}>{club.joinCode}</Text>
            </View>
            <Button
              label="재발급"
              size="sm"
              variant="outline"
              loading={rotate.isPending}
              onPress={async () => {
                if (await confirmAsync('초대 코드를 새로 발급할까요? 이전 코드는 더 이상 쓸 수 없어요.', '재발급')) {
                  rotate.mutate();
                }
              }}
            />
          </View>
          <Rule />
          <View style={styles.rowBetween}>
            <View>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>자리</Text>
              <Text style={[styles.seat, { color: colors.text }]}>{club.memberCount} / {club.memberLimit}명</Text>
            </View>
            {!ended && expandable ? (
              <Button label="자리 늘리기" size="sm" variant="outline" onPress={() => router.push(`/club/${clubId}/seats`)} />
            ) : null}
          </View>
        </Section>

        <Section title="멤버" gap={spacing.sm}>
          {others.length === 0 ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              아직 나뿐이에요. 초대 코드를 공유해 보세요.
            </Text>
          ) : null}
          {others.map((member, index) => (
            <View key={member.clubMemberId}>
              {index > 0 ? <Rule /> : null}
              <View style={styles.memberRow}>
                <Avatar uri={member.avatarUrl} nickname={member.nickname} size={28} />
                <Text style={[typeScale.label, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {member.nickname}
                </Text>
                {member.role === 'MODERATOR' ? <Tag label="운영진" /> : null}
                {!ended ? (
                  <View style={styles.memberActions}>
                    <FootAction
                      label="호스트 넘기기"
                      onPress={async () => {
                        if (await confirmAsync(`${member.nickname}님에게 호스트를 넘길까요? 나는 멤버가 돼요.`, '넘기기')) {
                          transfer.mutate(member.userId);
                        }
                      }}
                    />
                    <FootAction
                      label="내보내기"
                      tone="danger"
                      onPress={() => {
                        setKickTarget(member);
                        setKickReason('');
                      }}
                    />
                  </View>
                ) : null}
              </View>
              {kickTarget?.userId === member.userId ? (
                <View style={styles.kickForm}>
                  <Field
                    label="내보내는 이유"
                    value={kickReason}
                    onChangeText={setKickReason}
                    maxLength={200}
                    placeholder="기록에 남아요"
                  />
                  <View style={styles.rowButtons}>
                    <Button label="취소" size="sm" variant="outline" onPress={() => setKickTarget(null)} />
                    <Button
                      label="내보내기"
                      size="sm"
                      variant="danger"
                      disabled={kickReason.trim().length === 0}
                      loading={kick.isPending}
                      onPress={() => kick.mutate({ userId: member.userId, reason: kickReason.trim() })}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </Section>

        {!ended ? (
          <View style={{ gap: spacing.sm }}>
            <Rule />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              종료하면 더는 조각을 남길 수 없고 결산이 만들어져요.
            </Text>
            <Button
              label="클럽 종료하기"
              variant="danger"
              loading={end.isPending}
              onPress={async () => {
                if (await confirmAsync('클럽을 지금 종료할까요? 되돌릴 수 없어요.', '종료')) end.mutate();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}

/** 설정 한 단 — 카드 대신 위 괘선 한 줄과 악센트 아이브로우로 나눈다. */
function Section({ title, children, gap = spacing.md }: { title: string; children: ReactNode; gap?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.line, gap }]}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typeScale.titleSerif, fontSize: 22, lineHeight: 30 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  section: { borderTopWidth: hairline, paddingTop: spacing.lg },
  inlineField: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  code: { fontFamily: mono.semiBold, fontSize: 22, letterSpacing: 1, marginTop: 2 },
  seat: { fontFamily: mono.semiBold, fontSize: 16, marginTop: 2 },
  // 행 높이를 동작의 터치 상자(위아래 hitSlop 포함 약 56pt)보다 넉넉히 — 이웃 멤버 행의 동작과 겹치지 않게.
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingVertical: spacing.sm },
  // FootAction 은 글자 밖으로 양옆 14pt(여백 6 + hitSlop 8)씩 터치 영역이 넓어진다 — 둘이 겹치지 않고
  // sm 이상 떨어지도록 28 + 8 = 36(xxl)을 띄운다. 파괴적인 '내보내기'가 '호스트 넘기기' 탭에 걸리지 않게.
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl },
  kickForm: { gap: spacing.md, paddingBottom: spacing.sm },
  rowButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
