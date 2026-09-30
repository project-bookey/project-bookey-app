import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClubNotePageSummary } from '@/api/types';
import { PlusGlyph } from '@/components/collage';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, pressedStyle } from '@/theme/tokens';

/** 점으로 보여 줄 최대 페이지 수 — 넘으면 `3 / 12` 숫자로. */
const MAX_DOTS = 8;

/**
 * 페이지 줄 — 제목(없으면 n쪽) · ‹ › 화살표 · 네모 점 · 페이지 추가.
 * 보기 모드에선 스와이프로도 넘기지만, 도구를 쥔 동안(그리고 웹 마우스에선) 이 줄이 유일한 넘김 수단이다.
 */
export function PageStrip({ pages, index, title, readOnly, onPrev, onNext, onAdd, onTitle }: {
  pages: ClubNotePageSummary[];
  index: number;
  title: string | null;
  readOnly: boolean;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
  onTitle: () => void;
}) {
  const { colors } = useTheme();
  const page = pages[index];
  const label = title && title.length > 0 ? title : page ? `${page.seq}쪽` : '';
  const hasPrev = index > 0;
  const hasNext = index < pages.length - 1;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onTitle}
        disabled={readOnly}
        accessibilityRole="button"
        accessibilityLabel="페이지 제목 바꾸기"
        style={({ pressed }) => [styles.titleBtn, pressed && !readOnly ? pressedStyle : null]}
      >
        <Text numberOfLines={1} style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>{label}</Text>
      </Pressable>
      <View style={styles.nav}>
        <NavLabel label="‹ 이전" onPress={onPrev} disabled={!hasPrev} color={colors.textMuted} />
        <View style={styles.dots} accessibilityLabel={`${index + 1} / ${pages.length} 쪽`}>
          {pages.length > MAX_DOTS ? (
            <Text style={[styles.count, { color: colors.textMuted }]}>{index + 1} / {pages.length}</Text>
          ) : (
            pages.map((p, i) => (
              <View key={p.id} style={[styles.dot, { backgroundColor: i === index ? colors.ink : colors.line }]} />
            ))
          )}
          {!readOnly ? (
            <Pressable
              onPress={onAdd}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="페이지 추가"
              style={({ pressed }) => [styles.add, { borderColor: colors.line }, pressed ? pressedStyle : null]}
            >
              <PlusGlyph size={12} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <NavLabel label="다음 ›" onPress={onNext} disabled={!hasNext} color={colors.textMuted} />
      </View>
    </View>
  );
}

function NavLabel({ label, onPress, disabled, color }: { label: string; onPress: () => void; disabled: boolean; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.navBtn, disabled ? styles.disabled : null, pressed && !disabled ? pressedStyle : null]}
    >
      <Text style={[styles.navLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  titleBtn: { alignSelf: 'center', maxWidth: '100%' },
  title: { fontSize: 18, lineHeight: 26, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { minWidth: 56 },
  navLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 0.5 },
  disabled: { opacity: 0.35 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: radius.none },
  count: { fontFamily: mono.medium, fontSize: 11 },
  add: { width: 20, height: 20, marginLeft: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
