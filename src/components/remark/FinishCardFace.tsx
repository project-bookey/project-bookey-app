import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { MemoScrap, TiltCover } from '@/components/collage';
import { ScrapAuthor } from '@/components/home/ScrapAuthor';
import { useAuth } from '@/store/auth';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, serif } from '@/theme/tokens';

import { REMARK_MAX } from './queries';

/** 카드 옆 표지 폭 — 홈 '오늘의 글'의 표지 스크랩(HomeScraps 의 COVER_W)과 같다. */
const COVER_W = 72;

/**
 * 내 완독 카드의 얼굴 — 홈 '오늘의 글'이 다른 독자에게 보여 주는 완독 조각(FinishScrap)과 같은 짜임이다.
 * 작성자 행(내 닉네임 · 완독 · 책 제목 · 다 읽은 때) 밑에 한 줄평 자리(children)를 두고, 오른쪽에 표지를 붙인다.
 *
 * 완독 카드 시트와 '내 진도' 카드에서 적거나 고칠 때는 한 줄평 자리에 입력칸(RemarkCardInput)을,
 * 보여 줄 때는 남긴 한 줄평(RemarkCardQuote)을 넣는다. 내 완독 카드 모음(/finish-cards)도 같은 얼굴이다.
 * 카드는 기울이지 않는다 — 입력칸이 들면 커서·선택 핸들이 비뚤어진다. 콜라주 맛은 옆 표지의 기울기가 낸다.
 */
export function FinishCardFace({ title, coverUrl, when, children }: {
  title: string;
  coverUrl?: string | null;
  /** 작성자 행 오른쪽 — '방금' · '3일 전'. */
  when: string;
  children: ReactNode;
}) {
  const me = useAuth((state) => state.user);
  return (
    <View style={styles.row}>
      <MemoScrap rotate={0} style={styles.card}>
        <ScrapAuthor nickname={me?.nickname ?? ''} avatarUrl={me?.avatarUrl} where={title} kind="완독" when={when} />
        {children}
      </MemoScrap>
      {/* 표지는 그림일 뿐 — 작성자 행이 이미 책 제목을 읽어 준다. 세 플랫폼 모두 가지째 숨긴다. */}
      <View
        style={styles.coverSlot}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TiltCover uri={coverUrl} title={title} width={COVER_W} tilt={2} entering={false} />
      </View>
    </View>
  );
}

/** 카드 안 한 줄평 — 남겼으면 따옴표 친 글, 없으면 홈 완독 조각처럼 다 읽었다는 말로 채운다. */
export function RemarkCardQuote({ body }: { body?: string | null }) {
  const { colors } = useTheme();
  return body ? (
    <Text style={[styles.quote, { color: colors.text }]}>“{body}”</Text>
  ) : (
    <Text style={[styles.quote, { color: colors.textMuted }]}>마지막 장까지 다 읽었어요</Text>
  );
}

/**
 * 카드 안 한 줄평 입력칸 — 여는 따옴표 장식 + 글 칸. 완독 카드 시트와 '내 진도' 카드가 같은 칸을 쓴다.
 * 한 문장이라 줄바꿈은 받지 않는다(엔터는 키보드를 내린다) — 한 줄평 칸(RemarkField)과 같다.
 */
export function RemarkCardInput({ value, onChange, autoFocus, onFocus, onContentSizeChange }: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onFocus?: TextInputProps['onFocus'];
  onContentSizeChange?: TextInputProps['onContentSizeChange'];
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.inputRow}>
      <Text style={[styles.quoteMark, { color: colors.textFaint }]} aria-hidden>“</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\s*\n\s*/g, ' '))}
        placeholder="예: 마지막 장을 덮고 한참 앉아 있었어요"
        placeholderTextColor={colors.textFaint}
        maxLength={REMARK_MAX}
        multiline
        autoFocus={autoFocus}
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        accessibilityLabel="한 줄평"
        onFocus={onFocus}
        onContentSizeChange={onContentSizeChange}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.text }]}
      />
    </View>
  );
}

/** 입력칸 밑 글자 수 줄 — 카드 바로 밑에 붙는다. */
export function RemarkCardCount({ length }: { length: number }) {
  const { colors } = useTheme();
  return (
    <Text style={[typeScale.caption, { color: colors.textFaint }]}>
      {`${length}/${REMARK_MAX}자 · 책 정보 화면에 다른 독자의 것과 번갈아 보여요`}
    </Text>
  );
}

const styles = StyleSheet.create({
  // 홈 '오늘의 글' 한 쌍과 같다 — 카드가 남는 폭을 쓰고 표지는 오른쪽에 붙는다.
  row: { flexDirection: 'row', gap: spacing.md },
  card: { flex: 1 },
  coverSlot: { justifyContent: 'center' },
  quote: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  // 여는 따옴표는 장식 — 입력칸 첫 줄 높이에 맞춘다(칸 위 여백 sm + 줄높이 22 의 가운데).
  quoteMark: { fontFamily: serif.regular, fontSize: 22, lineHeight: 30, marginTop: 2 },
  input: {
    flex: 1,
    // 60자면 카드 폭에서 서너 줄 — 처음부터 세 줄 자리(22×3 + 위아래 여백)를 둔다. 웹 칸은 저절로 늘지 않아
    // 두 줄 자리면 쓰는 도중에 칸 안에서 스크롤된다. 네이티브는 넘치면 maxHeight 까지 늘어난다.
    minHeight: 82,
    maxHeight: 120,
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
});
