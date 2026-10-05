import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubMeeting } from '@/api/endpoints';
import { MeetingFormFields, useMeetingForm } from '@/components/club/MeetingForm';
import { meetingState } from '@/components/club/meetingTime';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { Button, EmptyState, Loading, linkLabel } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/**
 * 모임 고치기 — 모임 상세의 '고치기'로 연다. 새 모임과 같은 폼(MeetingFormFields)을 그 모임의 값으로 채워 열고,
 * 장소도 같은 전체 화면 장소 찾기로 바꾼다. 고칠 수 있는 사람은 모임을 연 사람과 클럽 호스트, 고칠 수 있는 때는
 * 모집 중(시작 전 · 취소 전)일 때뿐이다 — 서버도 같은 기준으로 막는다. '저장'은 하단 띠에 하나만 둔다.
 */
export default function MeetingEditScreen() {
  const { id, meetingId, host } = useLocalSearchParams<{ id: string; meetingId: string; host?: string }>();
  const clubId = Number(id);
  const mid = Number(meetingId);
  // 모임 상세와 같은 키 — 상세에서 넘어오면 받아 둔 값으로 바로 연다.
  const meeting = useQuery({
    queryKey: ['clubMeeting', clubId, mid],
    queryFn: () => clubCommunityApi.meeting(clubId, mid),
  });

  if (meeting.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="모임 고치기" />
        <Loading />
      </PaperScreen>
    );
  }
  const m = meeting.data;
  if (!m) {
    return (
      <PaperScreen>
        <SubHeader category="모임 고치기" />
        <EmptyState
          title="모임을 불러오지 못했어요"
          description={meeting.error instanceof ApiError ? meeting.error.message : '잠시 후 다시 시도해 주세요.'}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => meeting.refetch()} />}
        />
      </PaperScreen>
    );
  }
  if (!(host === '1' || m.host) || meetingState(m) !== 'open') {
    return (
      <PaperScreen>
        <SubHeader category="모임 고치기" />
        <EmptyState
          title="고칠 수 없는 모임이에요"
          description={
            meetingState(m) !== 'open'
              ? '지났거나 취소된 모임은 고칠 수 없어요.'
              : '모임을 연 사람과 클럽 호스트만 고칠 수 있어요.'
          }
        />
      </PaperScreen>
    );
  }
  // 값이 온 뒤에 폼을 붙인다 — 폼은 처음 붙을 때의 모임 값으로 채워진다.
  return <MeetingEditForm clubId={clubId} meeting={m} />;
}

function MeetingEditForm({ clubId, meeting }: { clubId: number; meeting: ClubMeeting }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const form = useMeetingForm(meeting);

  const save = useMutation({
    mutationFn: () => clubCommunityApi.updateMeeting(clubId, meeting.id, form.toInput()),
    onSuccess: (updated) => {
      qc.setQueryData(['clubMeeting', clubId, meeting.id], updated);
      qc.invalidateQueries({ queryKey: ['clubMeetings', clubId] });
      // 날짜나 읽을 책이 바뀌면 클럽의 지금 읽는 책 · 다음 모임도 바뀔 수 있다.
      qc.invalidateQueries({ queryKey: ['club', clubId] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      router.back();
    },
  });

  return (
    <PaperScreen>
      <SubHeader category="모임 고치기" />
      <KeyboardArea>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          <MeetingFormFields clubId={clubId} form={form} />
        </ScrollView>

        {/* 하단 띠 — 클럽 만들기와 같은 자리(ScrollView 의 형제)라 키보드가 뜨면 그 위에 붙는다.
            주요 버튼 하나를 엄지가 닿는 아래에, 실패 안내는 버튼 바로 위에 붙인다(UX 철칙 Fitts · Proximity). */}
        <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          {save.error ? (
            <Text style={[typeScale.caption, { color: colors.danger }]}>
              {save.error instanceof ApiError ? save.error.message : '모임을 고치지 못했어요. 다시 시도해 주세요.'}
            </Text>
          ) : form.missing ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>제목과 장소를 정하면 저장할 수 있어요.</Text>
          ) : null}
          <Button label="저장" disabled={!form.ready} loading={save.isPending} onPress={() => save.mutate()} />
        </KeyboardDock>
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  // 하단 고정 띠 — 클럽 만들기의 띠와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
