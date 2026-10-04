import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { CLUB_DESCRIPTION_MAX } from '@/components/club';
import { Button, Eyebrow, Field, Segmented, Toggle } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 무료 정원은 3명까지 — 더 필요하면 만든 뒤 클럽 홈에서 책갈피로 자리를 늘린다(서버가 같은 상한을 검사한다). */
const MEMBER_LIMITS = [
  { value: '2', label: '2명' },
  { value: '3', label: '3명' },
] as const;

/**
 * 클럽 만들기 (§12.1) — 이름 · 소개 · 정원 · 공개 한 화면.
 * 클럽은 기간 없이 이어지고 책은 모임을 열 때마다 고르므로, 여기서는 책도 기간도 묻지 않는다.
 * 정원은 기본값(3명)이 골라져 있어 이름만 적으면 바로 만들 수 있다(UX 철칙 Hick).
 * 클럽 탭·홈 클럽 줄 모두 이 화면으로 들어온다.
 */
export default function ClubCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberLimit, setMemberLimit] = useState<'2' | '3'>('3');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      clubApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility: isPublic ? 'PUBLIC' : 'CODE_ONLY',
        memberLimit: Number(memberLimit),
      }),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace(`/club/${club.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '클럽을 만들지 못했어요.'),
  });

  const canSubmit = name.trim().length > 0;

  return (
    <PaperScreen>
      <SubHeader category="클럽 만들기" />

      {/* 오프셋 없음 — 헤더가 없어 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(독후감 쓰기와 같은 이유). */}
      <KeyboardArea>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          {/* 이름·소개 — 한 묶음이라 md 로 붙이고, 아래 정원·공개와는 섹션 간격(xl)으로 띄운다. */}
          <View style={styles.fields}>
            <Field
              label="클럽 이름"
              value={name}
              onChangeText={setName}
              placeholder="예: 회사 독서 클럽"
              maxLength={60}
            />
            <Field
              label="한 줄 소개 (선택)"
              hint={`${description.length}/${CLUB_DESCRIPTION_MAX}자 · 클럽 홈 맨 위에 보여요`}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 토요일 새벽마다 한 권씩 함께 읽어요"
              maxLength={CLUB_DESCRIPTION_MAX}
            />
          </View>

          <View>
            <Eyebrow>정원</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <Segmented
                options={MEMBER_LIMITS.map((m) => ({ value: m.value, label: m.label }))}
                value={memberLimit}
                onChange={(v) => setMemberLimit(v as typeof memberLimit)}
              />
            </View>
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              호스트 포함 3명까지 무료예요. 더 필요하면 클럽을 만든 뒤 책갈피로 자리를 늘릴 수 있어요.
            </Text>
          </View>

          {/* 옵션 — 카드 대신 위 괘선 한 줄로 나눈다 */}
          <View style={[styles.options, { borderTopColor: colors.line }]}>
            <Toggle
              label="공개 클럽"
              description={
                isPublic
                  ? '추천 클럽에 보이고 누구나 참가할 수 있어요.'
                  : '초대 코드를 아는 사람만 참가할 수 있어요.'
              }
              value={isPublic}
              onChange={setIsPublic}
            />
          </View>

          <Text style={[styles.helper, { color: colors.textMuted }]}>
            읽을 책은 클럽을 만든 뒤 모임을 열 때 골라요.
          </Text>
        </ScrollView>

        {/*
          하단 띠 — 독후감 쓰기와 같은 자리(ScrollView 의 형제)라 키보드가 뜨면 그 위에 붙는다.
          주요 버튼 하나를 엄지가 닿는 아래에 넓게(UX 철칙 Fitts). 실패 안내도 버튼 바로 위에 붙인다(Proximity).
        */}
        <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          <Button
            label="클럽 만들기"
            disabled={!canSubmit}
            loading={create.isPending}
            onPress={() => create.mutate()}
          />
        </KeyboardDock>
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  helper: { ...typeScale.caption, marginTop: spacing.sm },
  fields: { gap: spacing.md },
  options: { borderTopWidth: hairline, paddingTop: spacing.lg, gap: spacing.md },
  // 하단 고정 띠 — 독후감 쓰기의 띠와 같은 만듦새(머리카락 선 · 본문 폭 · 종이 배경).
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
