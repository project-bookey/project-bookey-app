import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { inquiryApi } from '@/api/endpoints';
import type { InquiryCategory } from '@/api/types';
import { Chip, PaperScreen, SubHeader } from '@/components/collage';
import { deviceSummary, inquiryDevice } from '@/components/inquiry/deviceInfo';
import { clearInquiryDraft, readInquiryDraft, saveInquiryDraft } from '@/components/inquiry/draft';
import {
  INQUIRY_BODY_MAX, INQUIRY_IMAGE_MAX, inquiriesKey, inquiryKey, useInquiryCategories,
} from '@/components/inquiry/queries';
import { PhotoStrip } from '@/components/post/PhotoStrip';
import { usePhotoUploads } from '@/components/post/usePhotoUploads';
import { Button, Eyebrow, Field, linkLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/**
 * 문의하기 — 유형 · 내용 · 사진(최대 3장) 한 화면에 주요 버튼 '보내기' 하나.
 * 유형은 서버 순서의 맨 앞(이용 문의)이 미리 골라져 있어 내용만 적으면 바로 보낼 수 있다(UX 철칙 Hick).
 * 앱 버전·OS·기기 모델은 자동으로 붙이고, 무엇이 함께 가는지 화면 아래에 밝힌다.
 * `?category=&body=` 로 미리 채워 열 수 있다(도서 상세의 '관리자에게 문의하기').
 * 실수로 뒤로 가도 유형·내용은 초안으로 남는다. 보내면 그 문의 화면으로 바꿔 '답변 대기'를 보여 준다.
 * 라벨은 '올리기'가 아니라 '보내기' — 공개 글이 아니라 운영팀에게 보내는 글이다.
 */
export default function InquiryNewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; body?: string }>();
  const categories = useInquiryCategories();
  const userId = useAuth((state) => state.user?.id);

  // 쓰던 글이 있으면 그것이 먼저다 — 미리 채우기 문구로 덮으면 같은 링크로 다시 들어왔을 때 쓴 글이 사라진다.
  // 쓰던 글이 없을 때만 넘겨받은 문구(도서 상세의 '완독 기록 증명 문의')로 시작한다.
  const [initial] = useState(() => {
    const draft = readInquiryDraft(userId);
    const paramCategory = params.category as InquiryCategory | undefined;
    if (draft.body.trim().length > 0 || !params.body) {
      return { category: draft.category ?? paramCategory ?? null, body: draft.body };
    }
    return { category: paramCategory ?? draft.category, body: params.body };
  });
  const [picked, setPicked] = useState<InquiryCategory | null>(initial.category);
  const [body, setBody] = useState(initial.body);
  const [error, setError] = useState<string | null>(null);
  const photos = usePhotoUploads([], INQUIRY_IMAGE_MAX, inquiryApi.uploadImage);
  const device = useMemo(() => inquiryDevice(), []);

  // 고른 유형이 서버 목록에 없으면(아직 안 골랐거나 옛 링크) 맨 앞 값을 기본으로 쓴다.
  const options = categories.data ?? [];
  const category = options.some((option) => option.code === picked) ? picked : (options[0]?.code ?? null);

  // 손대지 않은 미리 채우기 문구는 초안으로 남기지 않는다 — 사용자가 쓴 적 없는 글이 다음에 '초안'으로 뜨지 않게.
  useEffect(() => {
    const untouched = params.body != null && body === params.body;
    saveInquiryDraft(userId, untouched ? { category: null, body: '' } : { category: picked, body });
  }, [userId, picked, body, params.body]);

  const send = useMutation({
    mutationFn: () =>
      inquiryApi.create({
        category: category!,
        body: body.trim(),
        imageIds: photos.imageIds,
        ...device,
      }),
    // 캐시·초안 정리는 화면을 떠났어도 해 둔다. 화면 바꾸기는 mutate 의 onSuccess 에서만 —
    // 보내는 중에 뒤로 갔다면 그 콜백은 불리지 않아, 엉뚱한 화면(도서 상세 등)을 문의 화면으로 바꾸지 않는다.
    onSuccess: (inquiry) => {
      clearInquiryDraft();
      queryClient.invalidateQueries({ queryKey: inquiriesKey });
      queryClient.setQueryData(inquiryKey(inquiry.id), inquiry);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '문의를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  const canSend = category != null && body.trim().length > 0 && !photos.busy;
  const summary = deviceSummary(device);

  return (
    <PaperScreen>
      <SubHeader category="문의하기" />

      {/* 오프셋 없음 — 헤더가 없어 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(클럽 만들기와 같은 이유). */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
          <View>
            <Eyebrow>문의 유형</Eyebrow>
            <View style={styles.sectionBody}>
              {categories.isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={styles.chipsLoading} />
              ) : categories.isError ? (
                <Pressable
                  onPress={() => categories.refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="문의 유형 다시 불러오기"
                  style={styles.retry}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
                    {`유형을 불러오지 못했어요 · ${linkLabel('다시 시도', 'action')}`}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.chips}>
                  {options.map((option) => (
                    <Chip
                      key={option.code}
                      label={option.label}
                      active={option.code === category}
                      onPress={() => setPicked(option.code)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          <Field
            label="내용"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={INQUIRY_BODY_MAX}
            textAlignVertical="top"
            placeholder="궁금하거나 불편했던 점을 적어 주세요. 언제, 어떤 화면에서 그랬는지 알려 주시면 더 빨리 도와드릴 수 있어요."
            hint={`${body.length}/${INQUIRY_BODY_MAX}`}
            style={styles.bodyInput}
          />

          <View>
            <Eyebrow>{`사진 ${photos.photos.length}/${INQUIRY_IMAGE_MAX}`}</Eyebrow>
            <View style={styles.sectionBody}>
              <PhotoStrip
                photos={photos.photos}
                onPick={() => void photos.pick()}
                onRetry={photos.retry}
                onRemove={photos.remove}
                max={INQUIRY_IMAGE_MAX}
                disabled={photos.picking || !photos.retryable}
                retryable={photos.retryable}
                notice={photos.notice}
              />
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                오류 화면을 붙이면 더 빨리 확인할 수 있어요.
              </Text>
            </View>
          </View>

          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            {summary ? `${summary} 정보가 함께 전달돼요. ` : ''}답변이 오면 알림으로 알려 드려요.
          </Text>
        </ScrollView>

        {/* 하단 띠 — ScrollView 의 형제라 키보드가 뜨면 그 위에 붙는다. 실패 안내는 버튼 바로 위(UX 철칙 Proximity). */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          <Button
            label="보내기"
            disabled={!canSend}
            loading={send.isPending}
            onPress={() => {
              setError(null);
              send.mutate(undefined, {
                onSuccess: (inquiry) =>
                  router.replace({ pathname: '/inquiry/[id]', params: { id: String(inquiry.id) } }),
              });
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  sectionBody: { marginTop: spacing.sm, gap: spacing.xs },
  // 줄바꿈되는 칩 — 칩 hitSlop(위아래 7) 끼리 겹치지 않게 줄 사이를 md 로 띄운다.
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.md },
  chipsLoading: { alignSelf: 'flex-start', minHeight: 44 },
  retry: { minHeight: 44, justifyContent: 'center' },
  // 긴 글을 쓰는 칸 — 처음부터 여러 줄이 보이게 키운다. 글이 길어지면 칸이 따라 자란다.
  bodyInput: { minHeight: 160 },
  bottomBar: {
    ...layout.content,
    width: '100%',
    gap: spacing.xs,
    borderTopWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
