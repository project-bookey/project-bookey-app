import { StyleSheet, TextInput, View } from 'react-native';

import type { MemberProgress } from '@/api/types';
import { Button, Segmented } from '@/components/ui';
import { radius, sans, serif, spacing, typeScale, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';
import { MemberPickerRow } from './MemberPickerRow';
import { NoteSheet } from './NoteSheet';
import { PenSwatches } from './PenSwatches';
import type { NoteFont, NoteSize, PenColor, QuoteElement, SpeechElement, TextElement } from './noteDoc';

/** 편집 시트가 바꾸는 필드 — 텍스트·말풍선·문장 공용. 부모가 patchElement 로 적용한다. */
export type EditorPatch = {
  text?: string;
  font?: NoteFont;
  size?: NoteSize;
  color?: PenColor;
  align?: 'left' | 'center';
  tail?: 'left' | 'right';
  userId?: number;
  nickname?: string;
  avatarUrl?: string;
  /** 문장 조각의 쪽 — 칸을 비우면 undefined 로 지운다. */
  page?: number;
};

const SIZE_OPTIONS: { value: NoteSize; label: string }[] = [
  { value: 's', label: '작게' }, { value: 'm', label: '보통' }, { value: 'l', label: '크게' },
];
const TEXT_FONTS: { value: NoteFont; label: string }[] = [
  { value: 'sans', label: '고딕' }, { value: 'serif', label: '명조' }, { value: 'mono', label: '모노' },
];
const SPEECH_FONTS: { value: 'sans' | 'serif'; label: string }[] = [
  { value: 'sans', label: '고딕' }, { value: 'serif', label: '명조' },
];
/** 쪽 칸 자릿수 — 다섯 자리면 충분하다. */
const PAGE_DIGITS = 5;

/** 쪽 칸 글자 → 쪽. 숫자만 남기고, 비었거나 0 이면 쪽 없음. */
function pageFrom(text: string): number | undefined {
  const page = Number(text.replace(/\D/g, '').slice(0, PAGE_DIGITS));
  return page >= 1 ? page : undefined;
}

/**
 * 텍스트·말풍선·문장 편집 시트 — 인라인 입력 대신 시트를 쓴다(회전한 제스처 뷰 안의 TextInput 은 안드로이드·웹 포커스가 불안하다).
 * 타이핑은 즉시 캔버스에 반영되고(onPatch), 닫힐 때 부모가 빈 글이면 요소를 지운다.
 */
export function TextEditorSheet({ element, members, onPatch, onClose }: {
  element: TextElement | SpeechElement | QuoteElement | null;
  members: MemberProgress[];
  onPatch: (patch: EditorPatch) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const isSpeech = element?.type === 'speech';
  const isQuote = element?.type === 'quote';
  const family = element && element.type !== 'quote'
    ? element.font === 'serif' ? serif.regular : element.font === 'mono' ? mono.regular : sans.regular
    : serif.regular;
  return (
    <NoteSheet visible={element !== null} title={isSpeech ? '말풍선' : isQuote ? '문장' : '텍스트'} onClose={onClose}>
      {element?.type === 'quote' ? (
        <QuoteFields element={element} onPatch={onPatch} onClose={onClose} />
      ) : element ? (
        <>
          {/* 화자 고르기는 고를 사람이 둘 이상일 때만(클럽 독후감) — 혼자면 늘 나. */}
          {element.type === 'speech' && members.length > 1 ? (
            <MemberPickerRow
              members={members}
              selectedUserId={element.userId}
              onPick={(m) => onPatch({ userId: m.userId, nickname: m.nickname, avatarUrl: m.avatarUrl })}
            />
          ) : null}
          <TextInput
            value={element.text}
            onChangeText={(text) => onPatch({ text })}
            multiline
            autoFocus
            maxLength={500}
            placeholder={isSpeech ? '누가 뭐라고 했나요?' : '적고 싶은 말'}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { color: colors.text, borderColor: colors.lineStrong, fontFamily: family }]}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              {element.type === 'speech' ? (
                <Segmented options={SPEECH_FONTS} value={element.font} onChange={(font) => onPatch({ font })} />
              ) : (
                <Segmented options={TEXT_FONTS} value={element.font} onChange={(font) => onPatch({ font })} />
              )}
            </View>
            <View style={styles.half}>
              <Segmented options={SIZE_OPTIONS} value={element.size} onChange={(size) => onPatch({ size })} />
            </View>
          </View>
          <View style={styles.row}>
            {element.type === 'text' ? (
              <>
                <PenSwatches value={element.color} onChange={(color) => onPatch({ color })} />
                <View style={styles.grow}>
                  <Segmented
                    options={[{ value: 'left', label: '왼쪽' }, { value: 'center', label: '가운데' }]}
                    value={element.align}
                    onChange={(align) => onPatch({ align })}
                  />
                </View>
              </>
            ) : (
              <View style={styles.grow}>
                <Segmented
                  options={[{ value: 'left', label: '꼬리 왼쪽' }, { value: 'right', label: '꼬리 오른쪽' }]}
                  value={element.tail}
                  onChange={(tail) => onPatch({ tail })}
                />
              </View>
            )}
          </View>
          <Button label="완료" onPress={onClose} />
        </>
      ) : null}
    </NoteSheet>
  );
}

/**
 * 문장 조각 칸 — 책 속 문장(조각과 같은 명조) + 쪽(선택). 글자 수 상한은 텍스트·말풍선과 같다.
 * 쪽 칸은 요소 값을 그대로 보여 준다 — 숫자 말고는 받지 않고, 비우면 쪽이 지워진다.
 */
function QuoteFields({ element, onPatch, onClose }: {
  element: QuoteElement;
  onPatch: (patch: EditorPatch) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <TextInput
        value={element.text}
        onChangeText={(text) => onPatch({ text })}
        multiline
        autoFocus
        maxLength={500}
        placeholder="마음에 걸린 문장을 옮겨 적어 보세요."
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="문장"
        style={[styles.input, { color: colors.text, borderColor: colors.lineStrong, fontFamily: serif.regular }]}
      />
      <TextInput
        value={element.page != null ? String(element.page) : ''}
        onChangeText={(text) => onPatch({ page: pageFrom(text) })}
        placeholder="쪽(선택)"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        maxLength={PAGE_DIGITS}
        accessibilityLabel="쪽수"
        style={[styles.pageInput, { color: colors.text, borderColor: colors.lineStrong }]}
      />
      <Button label="완료" onPress={onClose} />
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 88,
    maxHeight: 180,
    borderWidth: hairline,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  // 밑줄 오려두기의 쪽 칸과 같은 폭·숫자 활자.
  pageInput: {
    width: 84,
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.monoNumeral,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  half: { flex: 1 },
  grow: { flex: 1 },
});
