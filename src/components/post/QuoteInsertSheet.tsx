import { Pressable, StyleSheet, Text } from 'react-native';

import { NoteSheet } from '@/components/note/NoteSheet';
import { QuoteDraftFields, type useQuoteDraft } from '@/components/post/QuoteDraftFields';
import { pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 문장 넣기 시트 — 독후감 본문 커서 자리에 넣을 문장을 그 자리에서 옮겨 적는다.
 *
 * 여기서 쓴 문장은 독후감 본문에 글로만 남는다. 문장·쪽수 칸과 그 검증은 QuoteDraftFields 가 맡고,
 * 하단 시트는 노트 도구 시트를 그대로 쓴다.
 * 열림과 초안은 부모가 쥔다 — 바탕을 잘못 눌러 닫혀도 다시 열면 쓰던 문장이 그대로 있다.
 */
export function QuoteInsertSheet({ draft, onInsert, onClose }: {
  draft: ReturnType<typeof useQuoteDraft>;
  /** 넣기 — 부모가 초안을 본문에 넣고, 초안을 비우고, 시트를 닫는다. */
  onInsert: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const disabled = !draft.canSubmit;

  return (
    <NoteSheet visible title="문장 넣기" onClose={onClose}>
      <QuoteDraftFields
        draft={draft}
        autoFocus
        // 시트에는 스크롤이 없다 — 칸이 자라 넣기 버튼을 밀어내지 않게 노트 편집 시트의 글 칸과 같은 상한을 둔다.
        contentMaxHeight={180}
        trailing={(
          <Pressable
            onPress={onInsert}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="본문에 넣기"
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: colors.accent, opacity: disabled ? 0.35 : 1 },
              pressed ? pressedStyle : null,
            ]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>넣기</Text>
          </Pressable>
        )}
      />
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
        본문에서 커서가 있던 자리에 들어가요 · 넣은 뒤에도 본문에서 고칠 수 있어요
      </Text>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  // 강조색 네모 버튼 — 메타 줄 오른쪽 끝에 붙는다.
  submit: {
    marginLeft: 'auto',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
});
