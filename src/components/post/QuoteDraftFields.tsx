import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/** 문장 길이 상한 — 독후감 본문에 조각 하나로 넣기 알맞은 길이(옛 밑줄 문장 상한과 같은 500). */
export const QUOTE_CONTENT_MAX = 500;

/**
 * 문장 넣기 초안 상태 — 문장·쪽수와 그 검증을 한곳에 모은다.
 * 화면마다 다른 조건이 생기면 호출 쪽에서 `canSubmit` 에 덧붙인다.
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
 * 문장 입력 필드 — 문장 칸 + (쪽수 · 글자 수 · trailing) 한 줄 + 쪽수 경고. 독후감의 문장 넣기 시트가 쓴다.
 * 바깥 시트·확인 버튼은 부르는 쪽 몫이라 여기서 그리지 않고, 조각 사이 간격도 감싸는 쪽의 gap 에 맡긴다
 * (그래서 조각들을 Fragment 로 그대로 내보낸다).
 */
export function QuoteDraftFields({ draft, trailing, autoFocus, contentMaxHeight }: {
  draft: ReturnType<typeof useQuoteDraft>;
  /** 메타 줄 오른쪽 끝에 붙일 것 — 문장 넣기 시트는 여기에 넣기 버튼을 넘긴다. */
  trailing?: ReactNode;
  /** 열리자마자 문장 칸에 커서를 둔다 — 시트처럼 문장을 쓰려고 연 자리에서만 켠다. */
  autoFocus?: boolean;
  /**
   * 문장 칸 높이 상한 — 스크롤 없는 시트에서만 준다. 네이티브의 여러 줄 칸은 글을 따라 자라서,
   * 상한이 없으면 긴 문장이 아래 줄(넣기 버튼)을 시트·키보드 밖으로 밀어낸다. 넘치면 칸 안에서 스크롤한다.
   */
  contentMaxHeight?: number;
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
        autoFocus={autoFocus}
        maxLength={QUOTE_CONTENT_MAX}
        accessibilityLabel="문장"
        style={[styles.contentInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }, contentMaxHeight != null ? { maxHeight: contentMaxHeight } : null]}
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
