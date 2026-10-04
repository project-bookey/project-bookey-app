import { StyleSheet } from 'react-native';

import type { RemarkKind } from '@/api/types';
import { Field } from '@/components/ui';
import { useTheme } from '@/theme';

import { REMARK_MAX } from './queries';

/** 빈 칸에 띄울 보기 — 다 읽은 마음과 내려놓는 마음은 결이 달라 따로 둔다. */
const PLACEHOLDER: Record<RemarkKind, string> = {
  FINISHED: '예: 마지막 장을 덮고 한참 앉아 있었어요',
  ABANDONED: '예: 지금의 나와는 맞지 않았어요. 언젠가 다시',
};

/**
 * 한 마디 칸 — 한 문장이라 줄바꿈은 받지 않는다(엔터는 키보드를 내린다). 글자 수는 클럽 한 줄 소개처럼 도움말 줄에 센다.
 * 완독 시트·하차 시트·고치기 시트가 같은 칸을 쓴다.
 */
export function RemarkField({ value, onChange, kind }: {
  value: string;
  onChange: (value: string) => void;
  kind: RemarkKind;
}) {
  const { colors } = useTheme();
  return (
    <Field
      label="책을 덮으며 한 마디"
      hint={`${value.length}/${REMARK_MAX}자 · 이 책 페이지에 돌아가며 보여요`}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\s*\n\s*/g, ' '))}
      placeholder={PLACEHOLDER[kind]}
      maxLength={REMARK_MAX}
      multiline
      submitBehavior="blurAndSubmit"
      returnKeyType="done"
      accessibilityLabel="한 마디"
      style={[styles.input, { backgroundColor: colors.surfaceDeep }]}
    />
  );
}

const styles = StyleSheet.create({
  // 60자면 좁은 폰에서 세 줄 남짓 — 처음부터 두 줄 자리를 두고, 넘치면 칸 안에서 늘어난다.
  input: { minHeight: 72, maxHeight: 120, lineHeight: 22, textAlignVertical: 'top' },
});
