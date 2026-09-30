import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Post } from '@/api/types';
import { NoteCanvas, pageDocOf, pageHeightFor } from '@/components/note';
import { radius } from '@/theme';
import { noteDocOf } from './postFormat';

/** 노트 독후감 썸네일 — 1쪽을 3:4 로 줄여 그린다(읽기 전용, 눌림은 바깥 몫). */
export function NoteThumb({ post, width }: { post: Pick<Post, 'document'>; width: number }) {
  const doc = useMemo(() => pageDocOf(noteDocOf(post), 0), [post]);
  const height = pageHeightFor(width, doc.kind);
  return (
    <View pointerEvents="none" style={[styles.thumb, { width, height }]}>
      <NoteCanvas doc={doc} width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: 'hidden', borderRadius: radius.sm },
});
