import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { spacing } from '@/theme';
import { NoteSheet } from './NoteSheet';

/** 페이지 제목 입력 — 60자. 비우면 제목 없이 n쪽으로 보인다. */
export function TitlePrompt({ visible, initial, onSubmit, onClose }: {
  visible: boolean;
  initial: string | null;
  onSubmit: (title: string | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  useEffect(() => {
    if (visible) setValue(initial ?? '');
  }, [visible, initial]);
  const submit = () => {
    onSubmit(value.trim().length > 0 ? value.trim() : null);
    onClose();
  };
  return (
    <NoteSheet visible={visible} title="페이지 제목" onClose={onClose}>
      <Field
        label="제목"
        value={value}
        onChangeText={setValue}
        maxLength={60}
        autoFocus
        placeholder="예: 9월 28일 첫 모임"
        accessibilityLabel="페이지 제목"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button label="취소" variant="ghost" onPress={onClose} />
        <Button label="저장" onPress={submit} />
      </View>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
