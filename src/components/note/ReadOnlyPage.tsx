import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Loading } from '@/components/ui';
import { radius, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';
import { NoteCanvas, pageHeightFor } from './NoteCanvas';
import { parseDoc } from './noteDoc';
import { useNotePageQuery } from './queries';

/** 페이저의 이웃 페이지 — 편집 상태 없이 서버 문서를 그대로 그린다. 넘겨서 현재가 되면 편집 캔버스로 바뀐다. */
export function ReadOnlyPage({ clubId, pageId, width }: { clubId: number; pageId: number; width: number }) {
  const { colors } = useTheme();
  const query = useNotePageQuery(clubId, pageId);
  const doc = useMemo(() => (query.data ? parseDoc(query.data.document) : null), [query.data]);
  if (!doc) {
    const height = pageHeightFor(width);
    return (
      <View style={[styles.placeholder, { width, height, backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Loading />
      </View>
    );
  }
  return <NoteCanvas doc={doc} width={width} />;
}

const styles = StyleSheet.create({
  placeholder: { borderWidth: hairline, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
