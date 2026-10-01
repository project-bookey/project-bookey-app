import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaperScreen, SubHeader } from '@/components/collage';
import type { NoteKind } from '@/components/note';
import { Button, Eyebrow } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';

type Mode = 'TEXT' | 'NOTE';

const MODES: { value: Mode; label: string; caption: string }[] = [
  { value: 'TEXT', label: '글로 쓰기', caption: '마크다운으로 쓰고 사진·오려둔 문장을 넣어요' },
  { value: 'NOTE', label: '노트로 꾸미기', caption: '종이 위에 글·사진·스티커·펜으로 꾸며요 · 6페이지까지' },
];

const KINDS: { value: NoteKind; label: string; caption: string }[] = [
  { value: 'grid', label: '격자노트', caption: '도트 격자 종이 — 자유롭게 붙이고 그려요' },
  { value: 'lined', label: '줄노트', caption: '줄 친 종이 — 글을 길게 쓰기 좋아요' },
  { value: 'large', label: '대형노트', caption: '아주 넓은 종이 — 한 구역씩 끌어 가며 쓰고, 줄여서 전체를 봐요' },
];

/**
 * 독후감 모드 고르기 — 새 글의 첫 화면. 글로 쓰기(텍스트) / 노트로 꾸미기(+ 노트 종류) 중 하나를 고르고 '시작'.
 * 선택은 잉크로 반전한다. 책·클럽 파라미터는 고른 화면으로 그대로 넘긴다(replace — 뒤로 가면 들어온 곳으로).
 */
export function PostModeChooser({ bookId, clubId }: { bookId?: number; clubId?: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode | null>(null);
  const [kind, setKind] = useState<NoteKind>('grid');

  const carry = {
    ...(bookId != null ? { bookId: String(bookId) } : {}),
    ...(clubId != null ? { clubId: String(clubId) } : {}),
  };
  const start = () => {
    if (mode === 'TEXT') router.replace({ pathname: '/post/new', params: { ...carry, format: 'TEXT' } });
    else if (mode === 'NOTE') router.replace({ pathname: '/post/note', params: { ...carry, kind } });
  };

  return (
    <PaperScreen>
      <SubHeader category="독후감 쓰기" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Eyebrow>어떻게 쓸까요</Eyebrow>
          {clubId != null ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>클럽 독후감 — 클럽 멤버가 봐요. 광장에도 올릴지는 마지막에 골라요</Text>
          ) : null}
          {MODES.map((m) => (
            <Choice
              key={m.value}
              label={m.label}
              caption={m.caption}
              selected={mode === m.value}
              onPress={() => setMode(m.value)}
              large
            />
          ))}
        </View>

        {mode === 'NOTE' ? (
          <View style={styles.section}>
            <Eyebrow>노트 종류</Eyebrow>
            {KINDS.map((k) => (
              <Choice key={k.value} label={k.label} caption={k.caption} selected={kind === k.value} onPress={() => setKind(k.value)} />
            ))}
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>노트 종류는 시작한 뒤엔 바꿀 수 없어요</Text>
          </View>
        ) : null}

        <Button label="시작" onPress={start} disabled={mode === null} />
      </ScrollView>
    </PaperScreen>
  );
}

/** 고르기 한 칸 — 종이 조각. 고르면 잉크로 반전한다. */
function Choice({ label, caption, selected, onPress, large = false }: {
  label: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
  large?: boolean;
}) {
  const { colors } = useTheme();
  const fg = selected ? colors.onInk : colors.text;
  const sub = selected ? colors.onInk : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.choice,
        large ? styles.choiceLarge : null,
        selected
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: colors.surface, borderColor: colors.line },
        pressed && !selected ? pressedStyle : null,
      ]}
    >
      <Text style={[large ? styles.labelLarge : typeScale.bodyStrong, { color: fg }]}>{label}</Text>
      <Text style={[typeScale.caption, { color: sub }]}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  choice: { borderWidth: hairline, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  choiceLarge: { paddingVertical: spacing.lg },
  labelLarge: { ...typeScale.titleSerif, fontSize: 19, lineHeight: 26 },
});
