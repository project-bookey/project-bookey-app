import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Lock, Users } from 'lucide-react-native';
import type { NovelSummary, NovelStatus } from '@/api/types';
import { Card, Tag } from '@/components/ui';
import { iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

export const novelStatusLabel: Record<NovelStatus, string> = { RECRUITING: '모집 중', ONGOING: '연재 중', COMPLETED: '완결' };
export function NovelCover({ uri, title, large = false }: { uri?: string | null; title: string; large?: boolean }) {
  const { colors } = useTheme();
  return uri ? <Image source={{ uri }} accessibilityLabel={`${title} 표지`} style={[styles.cover, large && styles.large]} /> : (
    <View style={[styles.cover, large && styles.large, styles.placeholder, { backgroundColor: colors.paperAlt, borderColor: colors.line }]}>
      <BookOpen size={large ? 32 : 23} color={colors.textFaint} {...iconStroke} />
      {large ? <Text numberOfLines={3} style={[typeScale.quote, styles.coverTitle, { color: colors.textMuted }]}>{title || '나의 이야기'}</Text> : null}
    </View>
  );
}
export function NovelCard({ novel, onPress }: { novel: NovelSummary; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${novel.title}, ${novelStatusLabel[novel.status]}`} style={({ pressed }) => pressed && pressedStyle}>
      <Card>
        <View style={styles.row}>
          <NovelCover uri={novel.coverUrl} title={novel.title} />
          <View style={styles.body}>
            <View style={styles.tags}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>{novel.genre}</Text>
              <Tag label={novelStatusLabel[novel.status]} fg={novel.status === 'RECRUITING' ? colors.accent : colors.textMuted} bg={novel.status === 'RECRUITING' ? colors.accentSoft : colors.tonal} />
              {!novel.isPublic ? <Lock size={12} color={colors.textMuted} {...iconStroke} /> : null}
            </View>
            <Text numberOfLines={2} style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>{novel.title}</Text>
            <Text numberOfLines={2} style={[typeScale.caption, styles.description, { color: colors.textMuted }]}>{novel.description || '첫 문장으로 이야기를 시작해 보세요.'}</Text>
          </View>
        </View>
        <View style={[styles.footer, { borderTopColor: colors.line }]}>
          <Text numberOfLines={1} style={[typeScale.caption, styles.author, { color: colors.textMuted }]}>{novel.ownerNickname} · {novel.chapterCount}화</Text>
          {novel.kind === 'RELAY' ? <View style={styles.tags}><Users size={13} color={colors.textMuted} {...iconStroke} /><Text style={[typeScale.caption, { color: colors.textMuted }]}>{novel.memberCount}/{novel.memberLimit}명</Text></View> : null}
          <Text style={[typeScale.label, { color: colors.text }]}>{novel.myTurn ? '이어 쓰기 ›' : '작품 보기 ›'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md }, body: { flex: 1, gap: spacing.sm },
  cover: { width: 78, height: 112, borderRadius: radius.sm }, large: { width: 126, height: 182 },
  placeholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, gap: spacing.md },
  coverTitle: { textAlign: 'center', paddingHorizontal: spacing.sm },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 18, lineHeight: 25 }, description: { lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.md },
  author: { flex: 1 },
});
