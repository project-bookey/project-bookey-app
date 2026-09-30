import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { PostVisibility } from '@/api/types';
import { BookPicker, useBookPicker } from '@/components/book/BookPicker';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Eyebrow, Field, Segmented } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';
import { POST_TITLE_MAX, visibilityCaption, visibilityOptions } from './postFormat';

/**
 * 노트 독후감 올리기 전 시트 — 편집기의 '다음'. 책(없어도 됨) · 제목 · 공개 범위를 고르고 올린다.
 * 상태는 부모(편집기)가 쥔다 — 닫았다 다시 열어도 고른 것이 남는다. 모달은 제 창이라 SafeAreaProvider 를 다시 둔다.
 */
export function NotePublishSheet({
  picker, bookLocked, title, onTitle, visibility, onVisibility, inClub, currentVisibility,
  summary, notice, error, editing, submitting, canSubmit, onSubmit, onClose,
}: {
  picker: ReturnType<typeof useBookPicker>;
  /** 책이 있던 글을 고칠 때 — 책을 바꿀 수만 있고 뺄 수 없다(서버 규칙). */
  bookLocked: boolean;
  title: string;
  onTitle: (v: string) => void;
  visibility: PostVisibility;
  onVisibility: (v: PostVisibility) => void;
  inClub: boolean;
  /** 고치는 글의 원래 공개 범위(링크 공개 유지용). */
  currentVisibility?: PostVisibility;
  /** '노트 3쪽 · 사진 2장 · 문장 1개' 같은 한 줄. */
  summary: string;
  /** 막힌 이유(사진 올라가는 중 등). */
  notice: string | null;
  error: string | null;
  editing: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const book = picker.selected;
  const label = editing ? '고치기' : '올리기';
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <PaperScreen>
          <SubHeader category={editing ? '노트 고치기' : '노트 올리기'} onBack={onClose} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{summary}</Text>

            {/* ① 책 — 없어도 된다 */}
            <View style={styles.section}>
              <Eyebrow>책</Eyebrow>
              <BookPicker picker={picker} />
              {book == null ? (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>책 없이 올려도 돼요</Text>
              ) : !bookLocked ? (
                <Pressable
                  onPress={() => picker.pick(null)}
                  accessibilityRole="button"
                  accessibilityLabel="책 빼기"
                  style={({ pressed }) => [styles.unpick, pressed ? pressedStyle : null]}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>책 빼기 ×</Text>
                </Pressable>
              ) : null}
            </View>

            {/* ② 제목 */}
            <Field
              label="제목"
              value={title}
              onChangeText={onTitle}
              placeholder="한 줄로 남기는 제목"
              maxLength={POST_TITLE_MAX}
              accessibilityLabel="제목"
            />

            {/* ③ 공개 범위 */}
            <View style={styles.section}>
              <Eyebrow>공개 범위</Eyebrow>
              <Segmented options={visibilityOptions(inClub, currentVisibility)} value={visibility} onChange={onVisibility} />
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>{visibilityCaption(visibility, inClub)}</Text>
            </View>

            {notice ? <Text style={[typeScale.caption, { color: colors.textMuted }]}>{notice}</Text> : null}
            {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
            <Button label={label} onPress={onSubmit} disabled={!canSubmit} loading={submitting} />
          </ScrollView>
        </PaperScreen>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  unpick: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginVertical: -spacing.xs },
});
