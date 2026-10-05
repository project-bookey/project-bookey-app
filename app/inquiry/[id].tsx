import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { inquiryApi } from '@/api/endpoints';
import type { Inquiry, InquiryImage, InquirySummary, Page } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { InquiryStatusTag } from '@/components/inquiry/InquiryStatusTag';
import { inquiriesKey, inquiryKey } from '@/components/inquiry/queries';
import { Button, DeleteAction, EmptyState, Eyebrow } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 날짜·시각 — "10월 3일 오후 9:52". 올해가 아니면 연도를 앞에 붙인다(좁은 화면에서 유형과 한 줄에 들어가게). */
function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString('ko-KR', {
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** 사진 크게 보기 — 가운데 맞춰 화면에 들어오게 그린다. 닫기 버튼과 안드로이드 뒤로 가기로 닫는다. */
function PhotoViewer({ image, onClose }: { image: InquiryImage | null; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={image != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: colors.scrimDim }]}>
        {image ? (
          <Image source={{ uri: image.url }} resizeMode="contain" accessibilityLabel="첨부한 사진" style={styles.viewerImage} />
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={({ pressed }) => [
            styles.viewerClose,
            { top: insets.top + spacing.sm, backgroundColor: colors.ink },
            pressed && pressedStyle,
          ]}
        >
          <X size={22} color={colors.onInk} {...iconStroke} />
        </Pressable>
      </View>
    </Modal>
  );
}

/**
 * 문의 내용 — 내가 쓴 문의(유형 · 상태 · 본문 · 사진)와 그 아래 'Bookey 답변'.
 * 답변 알림을 누르면 바로 여기로 온다. 아직 답이 없으면 기다린다는 한 줄만 둔다.
 * 삭제는 맨 아래, 내용과 떨어진 곳에 두고 두 번 눌러 지운다(답변 전후 모두 지울 수 있다).
 */
export default function InquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inquiryId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const deleteConfirm = useDeleteConfirm<true>();
  const [viewing, setViewing] = useState<InquiryImage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: () => inquiryApi.remove(inquiryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inquiriesKey });
      queryClient.removeQueries({ queryKey: inquiryKey(inquiryId) });
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/inquiry', params: { pane: 'mine' } });
    },
    onError: (e) => setDeleteError(e instanceof ApiError ? e.message : '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  const inquiry = useQuery({
    queryKey: inquiryKey(inquiryId),
    queryFn: () => inquiryApi.get(inquiryId),
    // 지운 뒤 뒤로 가는 동안 지운 문의를 다시 묻지 않게 막는다.
    enabled: Number.isFinite(inquiryId) && !remove.isSuccess,
  });

  // 여기서 새 상태(답변 완료 등)를 받았는데 내 문의 목록은 아직 옛 상태면 목록을 다시 받게 한다 —
  // 목록 화면은 뒤에 마운트된 채 남아 있어 스스로는 다시 묻지 않는다.
  const status = inquiry.data?.status;
  useEffect(() => {
    if (!status) return;
    const list = queryClient.getQueryData<InfiniteData<Page<InquirySummary>>>(inquiriesKey);
    const row = list?.pages.flatMap((page) => page.content).find((item) => item.id === inquiryId);
    if (row && row.status !== status) void queryClient.invalidateQueries({ queryKey: inquiriesKey });
  }, [status, inquiryId, queryClient]);

  const pressDelete = () => {
    if (remove.isPending) return;
    if (deleteConfirm.confirm) {
      deleteConfirm.disarm();
      setDeleteError(null);
      remove.mutate();
    } else {
      deleteConfirm.arm(true);
    }
  };

  const notFound = !Number.isFinite(inquiryId) || (inquiry.error instanceof ApiError && inquiry.error.status === 404);
  // 이미 받아 둔 문의가 있으면 새로고침이 실패해도 내용을 그대로 두고, 위에 한 줄로만 알린다.
  const placeholder = notFound ? (
    <EmptyState title="문의를 찾을 수 없어요" description="삭제했거나 없는 문의예요." />
  ) : inquiry.data ? null : inquiry.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : inquiry.isError ? (
    <EmptyState
      title="문의를 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      action={<Button label="다시 시도" variant="outline" onPress={() => inquiry.refetch()} />}
    />
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="문의 내용" />
      {/* 당겨서 새로고침 — 답변이 왔는지 바로 다시 볼 수 있게. */}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={inquiry.isRefetching} onRefresh={() => inquiry.refetch()} />}
      >
        {!placeholder && inquiry.isError && inquiry.data ? (
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            새로 불러오지 못했어요. 당겨서 다시 시도해 주세요.
          </Text>
        ) : null}
        {placeholder ?? (inquiry.data ? (
          <InquiryArticle
            inquiry={inquiry.data}
            onOpenPhoto={setViewing}
            confirming={deleteConfirm.confirm === true}
            deleteError={deleteError}
            onDelete={pressDelete}
          />
        ) : null)}
      </ScrollView>
      <PhotoViewer image={viewing} onClose={() => setViewing(null)} />
    </PaperScreen>
  );
}

function InquiryArticle({ inquiry, onOpenPhoto, confirming, deleteError, onDelete }: {
  inquiry: Inquiry;
  onOpenPhoto: (image: InquiryImage) => void;
  confirming: boolean;
  deleteError: string | null;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const images = inquiry.images ?? [];
  const answered = inquiry.status === 'ANSWERED' && inquiry.answer;

  return (
    <>
      {/* 내 문의 — 유형·시각 ↔ 본문 ↔ 사진은 한 묶음이라 sm 으로 붙인다. */}
      <View style={styles.group}>
        <View style={styles.head}>
          <Text style={[typeScale.monoLabel, styles.headMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {inquiry.categoryLabel} · {formatDateTime(inquiry.createdAt)}
          </Text>
          <InquiryStatusTag status={inquiry.status} />
        </View>
        <Text selectable style={[typeScale.body, { color: colors.text }]}>{inquiry.body}</Text>
        {images.length > 0 ? (
          <View style={styles.photos}>
            {images.map((image, i) => (
              <Pressable
                key={image.id}
                onPress={() => onOpenPhoto(image)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`첨부한 사진 ${i + 1} 크게 보기`}
                style={({ pressed }) => [styles.photo, pressed && pressedStyle]}
              >
                <Image
                  source={{ uri: image.url }}
                  resizeMode="cover"
                  style={[styles.photoImage, { borderColor: colors.line, backgroundColor: colors.surface }]}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* 답변 — 문의와는 괘선과 섹션 간격으로 나눈다. */}
      <View style={[styles.group, styles.answer, { borderTopColor: colors.line }]}>
        <Eyebrow>Bookey 답변</Eyebrow>
        {answered ? (
          <>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              {formatDateTime(inquiry.answeredAt)}
              {inquiry.answerUpdatedAt ? ` · 수정됨 ${formatDateTime(inquiry.answerUpdatedAt)}` : ''}
            </Text>
            <Text selectable style={[typeScale.body, { color: colors.text }]}>{inquiry.answer}</Text>
          </>
        ) : (
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            답변을 준비하고 있어요. 답변이 오면 알림으로 알려 드려요.
          </Text>
        )}
      </View>

      {/* 파괴적 동작은 맨 아래, 내용과 떨어뜨린다 — 휴지통 → '한 번 더'(앱 전체 같은 규칙). */}
      <View style={styles.foot}>
        {deleteError ? <Text style={[typeScale.caption, { color: colors.danger }]}>{deleteError}</Text> : null}
        <DeleteAction target="문의" confirming={confirming} onPress={onDelete} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  skeleton: { height: 200, borderRadius: radius.md },
  group: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headMeta: { flex: 1 },
  photos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  // 세 장까지 한 줄 — 칸 폭을 똑같이 나눠 화면 폭에 맞춘다(고정 px 없음).
  photo: { flex: 1, maxWidth: '33%' },
  photoImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.sm, borderWidth: hairline },
  answer: { borderTopWidth: hairline, paddingTop: spacing.lg },
  foot: { alignItems: 'flex-end', gap: spacing.xs },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: {
    position: 'absolute',
    right: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
