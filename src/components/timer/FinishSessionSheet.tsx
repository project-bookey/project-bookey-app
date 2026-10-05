import { useRef } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

import { KeyboardArea, useBottomBarPadding, useScrollReveal } from '@/components/keyboard';
import { Button, formatDuration, percent } from '@/components/ui';
import { useBackHandler } from '@/hooks/useBackHandler';
import { hairline, layout, motion, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

type Props = {
  /** 지금까지 잰 시간(쉰 시간 뺌) — 머리 문장. */
  elapsedSec: number;
  bookTitle?: string;
  startPage: number;
  /** 0 이면 총쪽수를 모르는 책 — 진도는 빼고 '쪽'만 붙인다. */
  totalPages: number;
  endPage: string;
  onEndPage: (text: string) => void;
  pageError: string | null;
  /** 적은 쪽수로 다시 셈한 진도 — 모르면 null. */
  rate?: number | null;
  memo: string;
  onMemo: (text: string) => void;
  error: string | null;
  pending: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  /** 시트 안을 누를 때마다 — 타이머의 상호작용 횟수에 더한다. */
  onTouch: () => void;
  /** iOS 숫자 키패드 위 '완료' 줄 — 타이머 화면이 그린다. */
  inputAccessoryViewID?: string;
};

/**
 * 독서 마치기 시트 — 타이머의 두 번째 단계(2026-10-05, 사용자 결정 B안). 읽는 동안 화면에는 시계와
 * [잠깐 쉬기][독서 마치기]만 두고, 몇 쪽까지 읽었는지·독서 일지는 '독서 마치기'를 눌렀을 때 여기서 묻는다.
 *
 * NoteSheet 와 같은 모양이지만 RN Modal 이 아니라 타이머 화면 안에 겹쳐 그린다 — 마치자마자 화면을 넘기므로
 * (책 상세·클럽 메모·뒤로), 모달을 띄운 채 넘기면 모달 닫힘과 화면 전환이 엇갈린다. 쓰던 쪽수·일지는 부모가 쥐어
 * '계속 읽기'로 닫았다 다시 열어도 남는다.
 */
export function FinishSessionSheet(props: Props) {
  const { colors } = useTheme();
  const { pending, onClose, onTouch } = props;
  const close = () => {
    if (!pending) onClose();
  };
  useBackHandler(true, close);

  return (
    <Animated.View
      entering={FadeIn.duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      style={StyleSheet.absoluteFill}
      aria-modal
      onTouchStart={onTouch}
    >
      <KeyboardArea style={styles.area}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDim }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />
        <Panel {...props} />
      </KeyboardArea>
    </Animated.View>
  );
}

/** 시트 몸통 — KeyboardArea 안에서 그려야 키보드 위에 붙을 때 홈 인디케이터 몫을 거둔다. */
function Panel({
  elapsedSec, bookTitle, startPage, totalPages, endPage, onEndPage, pageError, rate,
  memo, onMemo, error, pending, canSubmit, onSubmit, onClose, inputAccessoryViewID,
}: Props) {
  const { colors } = useTheme();
  const paddingBottom = useBottomBarPadding(spacing.lg, true);
  // 작은 폰에서 키보드 위 자리가 모자라면 칸들은 시트 안에서 굴리고, 버튼 줄은 늘 바닥에 남긴다.
  const scrollRef = useRef<ScrollView>(null);
  const memoRef = useRef<View>(null);
  const reveal = useScrollReveal(scrollRef);

  const typed = Number(endPage);
  const helper = endPage.length > 0
    ? `이번 독서 +${Math.max(0, typed - startPage)}쪽${rate != null ? ` · 진도 ${percent(rate)}` : ''}`
    : null;

  return (
    <Animated.View
      entering={SlideInDown.duration(motion.base)}
      style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.lineStrong, paddingBottom }]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={false}
      >
        <View style={styles.head}>
          <Text style={[typeScale.titleSerif, { color: colors.text }]}>{formatDuration(elapsedSec)} 읽었어요</Text>
          <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
            {bookTitle ? `${bookTitle} · ` : ''}
            {startPage}쪽에서 시작
          </Text>
        </View>

        {/* 질문·쪽수·안내는 한 묶음(sm) — 일지와 버튼은 묶음 밖으로 띄운다(UX 철칙 Proximity). */}
        <View style={styles.pageGroup}>
          <Text style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>몇 쪽까지 읽었나요?</Text>
          <View style={styles.pageRow}>
            <TextInput
              value={endPage}
              onChangeText={(text) => onEndPage(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={5}
              inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel="읽은 쪽수"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              style={[styles.pageInput, { borderBottomColor: colors.accent, color: colors.text }]}
            />
            <Text style={[styles.pageSuffix, { color: colors.textMuted }]}>
              {totalPages > 0 ? `/ ${totalPages}쪽` : '쪽'}
            </Text>
          </View>
          {pageError ? (
            <Text style={[styles.note, { color: colors.danger }]}>{pageError}</Text>
          ) : helper ? (
            <Text style={[styles.note, { color: colors.textMuted }]}>{helper}</Text>
          ) : null}
        </View>

        <View ref={memoRef}>
          <TextInput
            value={memo}
            onChangeText={onMemo}
            placeholder="독서 일지 (선택)"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="독서 일지"
            onFocus={() => reveal(memoRef)}
            onContentSizeChange={() => reveal(memoRef, { onlyIfOpen: true })}
            style={[styles.memoInput, { borderColor: colors.line, backgroundColor: colors.surfaceDeep, color: colors.text }]}
            multiline
          />
        </View>
      </ScrollView>

      {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). 앱 전체 순서 — [취소·이전][주요 버튼]. */}
      <View style={styles.footer}>
        {error ? <Text style={[styles.note, { color: colors.danger }]}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button label="계속 읽기" variant="outline" onPress={onClose} disabled={pending} style={styles.secondary} />
          <Button
            label="독서 마치기"
            onPress={() => {
              Keyboard.dismiss();
              onSubmit();
            }}
            loading={pending}
            disabled={!canSubmit}
            style={styles.primary}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  area: { justifyContent: 'flex-end' },
  sheet: {
    ...layout.content,
    borderTopWidth: hairline,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    maxHeight: '85%',
  },
  // 내용이 85% 를 넘으면 줄어들어 안에서 스크롤한다(버튼 줄은 밖에 남는다).
  scroll: { flexGrow: 0, flexShrink: 1 },
  // 묶음 사이는 lg, 묶음 안은 xs~sm — 완독·한 줄평 시트와 같은 리듬.
  body: { gap: spacing.lg },
  head: { gap: spacing.xs },
  pageGroup: { gap: spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  pageInput: {
    flex: 1,
    minWidth: 0,
    borderBottomWidth: 2,
    fontFamily: mono.semiBold,
    fontSize: 34,
    paddingVertical: spacing.xs,
  },
  pageSuffix: { fontFamily: mono.regular, fontSize: 15, flexShrink: 0 },
  note: { ...typeScale.caption, lineHeight: 18 },
  memoInput: {
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    maxHeight: 120, // 길어지면 칸 안에서 스크롤 — 버튼 줄이 키보드 밑으로 밀려나지 않게
    fontFamily: serif.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  footer: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  // 주요 버튼을 조금 더 넓게 — 엄지가 먼저 닿는 쪽(UX 철칙 Fitts).
  secondary: { flex: 1 },
  primary: { flex: 1.4 },
});
