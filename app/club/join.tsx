import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { StatStrip } from '@/components/club';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { Button, Eyebrow, Rule, Toggle } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, sans } from '@/theme/tokens';

/**
 * 코드로 참가 (§12.1).
 * 코드로 볼 수 있는 정보는 미리보기 수준까지다 — 멤버 진척·기록은 참가 후에만 보인다.
 * 미리보기는 클럽 홈과 같은 활자·괘선 언어(명조 이름 · 모노 책 줄 · 숫자 띠).
 */
export default function ClubJoinScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [shareProgress, setShareProgress] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const ready = normalized.length === 6;

  const preview = useQuery({
    queryKey: ['club', 'preview', normalized],
    queryFn: () => clubApi.preview(normalized),
    enabled: ready,
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => clubApi.join(normalized, { shareProgress }),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      router.replace(`/club/${club.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '참가하지 못했어요.'),
  });

  const errorStyle = [typeScale.caption, { color: colors.danger }];
  const club = preview.data;

  return (
    <PaperScreen>
      <SubHeader category="코드로 참가" />
      <KeyboardArea>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <Eyebrow>초대 코드</Eyebrow>
            <TextInput
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError(null);
              }}
              placeholder="ABC123"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={[
                styles.codeInput,
                { borderColor: colors.line, backgroundColor: colors.surface, color: colors.text },
              ]}
            />
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              대문자·소문자나 하이픈(-)은 신경 쓰지 않아도 돼요.
            </Text>
          </View>

          {ready && preview.isError ? (
            <Text style={errorStyle}>없는 초대 코드예요. 다시 확인해 주세요.</Text>
          ) : null}

          {club ? (
            <View style={[styles.section, { borderTopColor: colors.line }]}>
              <View style={styles.previewHead}>
                <TiltCover uri={club.book?.coverUrl} title={club.book?.title} width={52} tilt={0} entering={false} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={[styles.clubName, { color: colors.text }]}>{club.name}</Text>
                  <Text style={[styles.bookLine, { color: colors.textMuted }]}>
                    {club.book
                      ? `지금 읽는 책 · ${[club.book.title, club.book.author].filter(Boolean).join(' · ')}`
                      : '읽을 책 미정'}
                  </Text>
                  {club.description ? (
                    <Text numberOfLines={2} style={[typeScale.caption, { color: colors.textFaint }]}>
                      {club.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              <StatStrip
                cells={[
                  { label: '호스트', value: club.hostNickname ?? '—' },
                  { label: '인원', value: String(club.memberCount), unit: ` / ${club.memberLimit}명` },
                ]}
              />
              {club.alreadyMember ? (
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>이미 참가한 클럽이에요.</Text>
              ) : club.joinBlockedReason ? (
                <Text style={errorStyle}>{club.joinBlockedReason}</Text>
              ) : null}
            </View>
          ) : null}

          {club?.joinable ? (
            <View style={[styles.section, { borderTopColor: colors.line }]}>
              <Eyebrow>참가하면 이렇게 돼요</Eyebrow>
              <Text style={[styles.consentText, { color: colors.textMuted }]}>
                · 클럽이 지금 읽는 책이 내 서재에 저절로 담겨요. 모임마다 책이 바뀌면 그 책도 담겨요{'\n'}
                · 내 <Text style={[styles.bold, { color: colors.text }]}>진도, 지금까지 읽은 시간, 마지막으로 읽은 때</Text>가 멤버에게 보여요{'\n'}
                · 독서 일지, 다른 책의 기록, 내 독후감은 <Text style={[styles.bold, { color: colors.text }]}>보이지 않아요</Text>
              </Text>

              <Rule />
              <Toggle
                label="내 진도 공개"
                description="끄면 멤버 목록에 내 진도가 '비공개'로 보이고, 클럽 평균에서도 빠져요."
                value={shareProgress}
                onChange={setShareProgress}
              />
            </View>
          ) : null}

        </ScrollView>

        {/*
          하단 띠 — 클럽 만들기와 같은 자리. 미리보기가 길어져도 '참가하기'는 엄지가 닿는 아래에 머물고,
          키보드가 뜨면 그 위에 붙는다(UX 철칙 Fitts). 실패 안내도 버튼 바로 위에(Proximity).
        */}
        <KeyboardDock style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          {error ? <Text style={errorStyle}>{error}</Text> : null}
          <Button
            label="참가하기"
            disabled={!club?.joinable}
            loading={join.isPending}
            onPress={() => join.mutate()}
          />
        </KeyboardDock>
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  // 코드 입력 — Field 와 같은 종이 상자, 글자는 모노 크게(한글이 아니라 자간 1 로 숨을 준다)
  codeInput: {
    borderWidth: hairline,
    borderRadius: radius.md,
    fontFamily: mono.semiBold,
    fontSize: 28,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  hint: { ...typeScale.caption, marginTop: spacing.sm },
  section: { borderTopWidth: hairline, paddingTop: spacing.lg, gap: spacing.md },
  previewHead: { flexDirection: 'row', gap: spacing.md },
  clubName: { ...typeScale.titleSerif, fontSize: 22, lineHeight: 30 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  consentText: { ...typeScale.body, lineHeight: 22 },
  bold: { fontFamily: sans.semiBold },
});
