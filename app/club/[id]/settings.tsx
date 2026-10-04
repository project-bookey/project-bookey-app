import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { prepareImage } from '@/api/upload';
import type { ClubHome, ClubVisibility, MemberProgress } from '@/api/types';
import { CLUB_DESCRIPTION_MAX, ClubBackdrop, confirmAsync, notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardScroll, useScrollReveal } from '@/components/keyboard';
import { Avatar } from '@/components/Avatar';
import {
  Button, EmptyState, Eyebrow, Field, FootAction, KeyValue, Loading, Rule, Segmented, Tag, Toggle, linkLabel,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

const VISIBILITIES: { value: ClubVisibility; label: string; description: string }[] = [
  { value: 'CODE_ONLY', label: '코드로만', description: '초대 코드를 아는 사람만 참가할 수 있어요.' },
  { value: 'LINK', label: '링크', description: '초대 링크를 받은 사람이 참가할 수 있어요.' },
  { value: 'PUBLIC', label: '공개', description: '추천 클럽에 노출되고 누구나 참가할 수 있어요.' },
];


/**
 * 클럽 설정 — 클럽을 연 사람(호스트)만. 클럽 홈 머리의 '정보 수정', 목록의 '관리' 칩, 클럽 정보의 톱니에서 들어온다.
 * 맨 위는 클럽 홈 머리 미리보기와 배경 사진(없으면 기본 배경), 그 아래 이름 · 한 줄 소개 · 공개 범위 · 운영.
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
  // 이름·소개 칸을 누르면 '저장'까지, 내보내는 이유 칸을 누르면 '내보내기'까지 키보드 위로 올린다.
  const scrollRef = useRef<ScrollView>(null);
  const saveRef = useRef<View>(null);
  const kickActionsRef = useRef<View>(null);
  const revealAbove = useScrollReveal(scrollRef);
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
  // 배경 사진 — 고르면 줄이고 JPEG 로 바꿔 바로 올린다. 이전 사진은 서버가 지운다.
  const applyClub = (updated: ClubHome) => {
    queryClient.setQueryData(['club', clubId], updated);
    queryClient.invalidateQueries({ queryKey: ['clubs'] });
  };
  const backgroundFail = (e: unknown) =>
    notify(
      e instanceof ApiError && e.code === 'STORAGE_DISABLED'
        ? '사진 저장소가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.'
        : e instanceof ApiError ? e.message : '배경 사진을 바꾸지 못했어요.',
    );
  const uploadBackground = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return null;
      return clubApi.uploadBackground(clubId, await prepareImage(result.assets[0]));
    },
    onSuccess: (updated) => {
      if (updated) applyClub(updated);
    },
    onError: backgroundFail,
  });
  const removeBackground = useMutation({
    mutationFn: () => clubApi.removeBackground(clubId),
    onSuccess: applyClub,
    onError: backgroundFail,
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
  // 예전에 길게 쓴 소개는 한 줄 소개 길이로 줄여야 저장된다.
  const descriptionTooLong = description.trim().length > CLUB_DESCRIPTION_MAX;
  const backgroundBusy = uploadBackground.isPending || removeBackground.isPending;
  const others = club.members.filter((m) => !m.isMe);
  const expandable = club.seatPolicy && club.memberLimit < club.seatPolicy.maxLimit;

  return (
    <PaperScreen>
      <SubHeader category="클럽 설정" />
      <KeyboardScroll ref={scrollRef} contentContainerStyle={styles.container}>
        {/* 미리보기 — 클럽 홈 머리가 어떻게 보이는지 그대로. 입력 중인 이름 · 한 줄 소개가 바로 비친다 */}
        <View style={{ gap: spacing.sm }}>
          <View style={[styles.preview, { borderColor: colors.line }]}>
            <ClubBackdrop uri={club.backgroundUrl} seed={club.id} />
            <LinearGradient
              colors={[`${colors.bg}40`, `${colors.bg}D9`, colors.bg]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.previewText}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {name.trim() || club.name}
              </Text>
              {description.trim() ? (
                <Text style={[styles.previewIntro, { color: colors.text }]} numberOfLines={2}>
                  {description.trim()}
                </Text>
              ) : null}
              {ended ? (
                <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>종료된 클럽</Text>
              ) : null}
            </View>
          </View>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {club.backgroundUrl
              ? '글씨가 잘 보이도록 사진 위에 종이색을 옅게 덮어요.'
              : '사진을 올리지 않으면 이 기본 배경이 깔려요.'}
          </Text>
          <View style={styles.backdropActions}>
            {club.backgroundUrl ? (
              <Button
                label="기본 배경으로"
                variant="outline"
                size="sm"
                disabled={backgroundBusy}
                loading={removeBackground.isPending}
                onPress={() => removeBackground.mutate()}
              />
            ) : null}
            <Button
              label={club.backgroundUrl ? '사진 바꾸기' : '배경 사진 고르기'}
              variant="outline"
              size="sm"
              disabled={backgroundBusy}
              loading={uploadBackground.isPending}
              onPress={() => uploadBackground.mutate()}
            />
          </View>
        </View>

        <Section title="기본 정보">
          <Field
            label="클럽 이름"
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="예: 회사 독서 클럽"
            onFocus={() => revealAbove(saveRef)}
          />
          <Field
            label="한 줄 소개"
            hint={`${description.trim().length}/${CLUB_DESCRIPTION_MAX}자 · 클럽 홈 맨 위와 클럽 목록에 보여요`}
            error={descriptionTooLong ? `${CLUB_DESCRIPTION_MAX}자 안으로 줄여 주세요.` : null}
            value={description}
            onChangeText={setDescription}
            placeholder="예: 토요일 새벽마다 한 권씩 함께 읽어요"
            onFocus={() => revealAbove(saveRef)}
          />
          <View ref={saveRef}>
            <Button
              label="저장"
              size="sm"
              disabled={!infoDirty || name.trim().length === 0 || descriptionTooLong}
              loading={update.isPending}
              onPress={() =>
                update.mutate(
                  { name: name.trim(), description: description.trim() },
                  { onSuccess: () => notify('저장했어요.') },
                )}
            />
          </View>
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

        {/* 클럽은 기간 없이 이어진다 — 연 날만 적어 두고, 끝내려면 아래 '클럽 종료'. */}
        <Section title="시작 · 찌르기">
          <KeyValue label="연 날" value={club.startsAt} />
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
                    onFocus={() => revealAbove(kickActionsRef)}
                  />
                  <View ref={kickActionsRef} style={styles.rowButtons}>
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
      </KeyboardScroll>
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
  title: { ...typeScale.titleSerif, fontSize: 22, lineHeight: 30 },
  section: { borderTopWidth: hairline, paddingTop: spacing.lg },
  // 머리 미리보기 — 클럽 홈과 같은 배경 · 그라데이션 위에 이름 · 한 줄 소개를 아래쪽에 얹는다.
  preview: {
    aspectRatio: 16 / 9,
    borderWidth: hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  previewText: { padding: spacing.lg, gap: spacing.xs },
  previewIntro: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  backdropActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  code: { fontFamily: mono.semiBold, fontSize: 22, letterSpacing: 1, marginTop: 2 },
  seat: { fontFamily: mono.semiBold, fontSize: 16, marginTop: 2 },
  // 행 높이를 동작의 터치 상자(34pt + 위아래 hitSlop 5 = 44pt)보다 넉넉히 — 이웃 멤버 행의 동작과 겹치지 않게.
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingVertical: spacing.sm },
  // FootAction(테두리 버튼)은 옆으로 넓어지지 않는다 — md 간격이면 파괴적인 '내보내기'가 '호스트 넘기기' 탭에 걸리지 않는다.
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kickForm: { gap: spacing.md, paddingBottom: spacing.sm },
  rowButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
