import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/** 문장 길이 상한 — 서버 계약과 같은 값. */
export const QUOTE_CONTENT_MAX = 500;

/**
 * 오려두기 초안 상태 — 문장·쪽수와 그 검증을 한곳에 모은다.
 * 광장(책 고르기 있음)과 도서 상세 밑줄 탭(책이 이미 정해짐)이 같은 규칙을 쓰기 위한 것으로,
 * 책 선택 여부처럼 화면마다 다른 조건은 호출 쪽에서 `canSubmit` 에 덧붙인다.
 */
export function useQuoteDraft() {
  const [content, setContent] = useState('');
  const [pageText, setPageText] = useState('');

  const trimmedPage = pageText.trim();
  const pageValue = trimmedPage === '' ? undefined : Number(trimmedPage);
  const pageValid = pageValue === undefined || (Number.isInteger(pageValue) && pageValue >= 1);
  const body = content.trim();
  const canSubmit = body.length > 0 && body.length <= QUOTE_CONTENT_MAX && pageValid;

  return { content, setContent, pageText, setPageText, body, pageValue, pageValid, canSubmit };
}

/**
 * 오려두기 입력 필드 — 문장 칸 + (쪽수 · 글자 수 · trailing) 한 줄 + 쪽수 경고.
 * 광장과 도서 상세가 이 필드를 공유한다. 바깥 카드·책 고르기·확인 버튼은 화면마다 달라서 여기서 그리지 않고,
 * 조각 사이 간격도 감싸는 Card 의 gap 에 맡긴다(그래서 조각들을 Fragment 로 그대로 내보낸다).
 */
export function QuoteDraftFields({ draft, trailing }: {
  draft: ReturnType<typeof useQuoteDraft>;
  /** 메타 줄 오른쪽 끝에 붙일 것 — 광장은 여기에 오려두기 알약을 넘긴다. */
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const { content, setContent, pageText, setPageText, pageValid } = draft;

  return (
    <>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="마음에 걸린 문장을 옮겨 적어 보세요."
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={QUOTE_CONTENT_MAX}
        accessibilityLabel="문장"
        style={[styles.contentInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }]}
      />

      <View style={styles.meta}>
        <TextInput
          value={pageText}
          onChangeText={setPageText}
          placeholder="쪽(선택)"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          accessibilityLabel="쪽수"
          style={[styles.pageInput, {
            backgroundColor: colors.surfaceDeep,
            borderColor: pageValid ? colors.line : colors.danger,
            color: colors.text,
          }]}
        />
        <Text style={[typeScale.monoLabel, {
          color: content.length >= QUOTE_CONTENT_MAX ? colors.warn : colors.textFaint,
        }]}>
          {content.length}/{QUOTE_CONTENT_MAX}
        </Text>
        {trailing}
      </View>

      {!pageValid ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>쪽수는 1 이상의 숫자로 적어 주세요.</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // 옮겨 적는 칸이라 본문도 인용 활자 — quote 토큰을 15/1.65 로 줄여 쓴다.
  contentInput: {
    minHeight: 92,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typeScale.quote,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageInput: {
    width: 84,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.monoNumeral,
  },
});
