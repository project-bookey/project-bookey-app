import { StyleSheet, Text, View } from 'react-native';

import { TiltCover } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';

/** 완독·하차 시트에 띄울 책 — 표지·제목과 읽은 기간·시간 한 줄. */
export type FinishedBook = {
  title: string;
  coverUrl?: string | null;
  /** '9.12 → 10.4 · 6시간 20분' — 모르면 없다. */
  meta?: string;
};

/** 시트 머리 — 표지와 한 마디 인사, 제목, 읽은 기간. 한 묶음이라 안쪽 간격은 좁게. 하차·고치기 시트가 쓴다. */
export function ClosingBookHead({ book, heading }: { book: FinishedBook; heading: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.head}>
      <TiltCover uri={book.coverUrl} title={book.title} width={56} tilt={-3} entering={false} />
      <View style={styles.headText}>
        <Text style={[typeScale.titleSerif, { color: colors.text }]}>{heading}</Text>
        <Text numberOfLines={2} style={[typeScale.label, { color: colors.textMuted }]}>{book.title}</Text>
        {book.meta ? (
          <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.textFaint }]}>{book.meta}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headText: { flex: 1, gap: spacing.xs },
});
