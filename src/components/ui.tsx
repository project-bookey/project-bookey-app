import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  View, ViewStyle,
} from 'react-native';

import { hairline, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import type { ColorTokens, ThemeMode } from '@/theme';
import { mono, serif } from '@/theme/tokens';

/**
 * 공용 프리미티브. 콜라주 토큰 기반이며 다크/라이트 모두에서 동작한다.
 * 스타일 시트는 모드별로 한 번만 만들어 캐시한다 — 모듈 로드 시점에 색을
 * 캡처하면 테마 전환이 반영되지 않기 때문이다.
 *
 * 전제: colors 는 mode 의 순수 함수다(같은 mode → 항상 같은 팔레트 객체).
 * 사용자별 팔레트나 런타임 색 오버라이드가 생기면 이 캐시 키를 함께 바꿔야 한다.
 */
const sheetCache = new Map<ThemeMode, ReturnType<typeof makeStyles>>();

function useStyles() {
  const { mode, colors, cardShadow } = useTheme();
  const styles = useMemo(() => {
    const cached = sheetCache.get(mode);
    if (cached) return cached;
    const created = makeStyles(colors, cardShadow);
    sheetCache.set(mode, created);
    return created;
  }, [mode, colors, cardShadow]);
  return { styles, colors };
}

export type LinkKind = 'nav' | 'action';

/**
 * 링크 라벨 규칙의 단일 출처 — 화면 이동(nav)은 " ›" 를 달고, 제자리 동작(action: 더 보기·다시 시도·쓰기)은
 * 글리프 없이 글자만. "→" 는 링크에 쓰지 않는다(기간·쪽수 같은 범위 구분에만). Button 라벨에도 글리프를 넣지 않는다.
 */
export function linkLabel(label: string, kind: LinkKind = 'nav'): string {
  return kind === 'nav' ? `${label} ›` : label;
}

/** 재생·일시정지 CTA 의 ▶/⏸ — 읽기를 시작·재개하는 버튼에만 붙인다. 상태 표시("진행 중")에는 쓰지 않는다. */
export function playLabel(label: string, glyph: '▶' | '⏸' = '▶'): string {
  return `${glyph} ${label}`;
}

/** 카드 — 종이 한 장. 얇은 테두리와 깊은 그림자로 책상 위에 올라온 느낌을 준다. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { styles } = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 아이브로우 — 모노 대문자 라벨. plain 이면 악센트 없이 뮤트 톤으로만 쓴다. */
export function Eyebrow({ children, plain }: { children: ReactNode; plain?: boolean }) {
  const { styles } = useStyles();
  return <Text style={[styles.eyebrow, plain && styles.eyebrowPlain]}>{children}</Text>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { styles } = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

/** 겹괘선 — 장 구분에 쓰는 두 줄. */
export function DoubleRule() {
  const { styles } = useStyles();
  return (
    <View style={styles.doubleRule}>
      <View style={styles.doubleRuleThick} />
      <View style={styles.doubleRuleThin} />
    </View>
  );
}

/** 구분자 — 장식 기호 없이 헤어라인 한 줄. */
export function OrnamentDivider() {
  const { styles } = useStyles();
  return <View style={styles.divider} />;
}

export function Button({
  label, onPress, variant = 'primary', disabled, loading, style, size = 'md',
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}) {
  const { styles, colors } = useStyles();
  const isDisabled = disabled || loading;
  // 눌림 — 종이 단(2px) 위에 놓인 버튼이 1px 옮겨 앉아 단이 1px 로 준다(물리적 눌림).
  // 고스트는 단이 없어 흐려지기만 하고, 비활성은 아무 반응도 하지 않는다.
  const plate = variant !== 'ghost' && !isDisabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        style,
        plate && styles.buttonPlate,
        pressed && !isDisabled && (plate ? styles.buttonSat : pressedStyle),
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.onAccent : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            size === 'sm' && styles.buttonLabelSm,
            variant === 'primary' && styles.buttonLabelPrimary,
            variant === 'danger' && styles.buttonLabelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Tag({ label, fg, bg }: { label: string; fg?: string; bg?: string }) {
  const { styles } = useStyles();
  return (
    <View style={[styles.tag, bg ? { backgroundColor: bg } : null]}>
      <Text style={[styles.tagText, fg ? { color: fg } : null]}>{label}</Text>
    </View>
  );
}

/** 진행바 — 트랙 위에 악센트 채움. */
export function ProgressBar({ value, height = 6 }: { value?: number | null; height?: number }) {
  const { styles } = useStyles();
  const clamped = Math.max(0, Math.min(1, value ?? 0));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

export function Numeral({ children, style }: { children: ReactNode; style?: object }) {
  const { styles } = useStyles();
  return <Text style={[styles.numeral, style]}>{children}</Text>;
}

export function Field({ label, hint, error, ...props }: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const { styles, colors } = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.segmented}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              index > 0 && styles.segmentDivider,
              active && styles.segmentActive,
              pressed && !active && pressedStyle,
            ]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 직접 그린 토글. 플랫폼 기본 Switch 는 iOS/안드로이드/웹에서 색이 제각각이라
 * 디자인을 지키기 위해 직접 그린다.
 */
export function Toggle({ value, onChange, label, description }: {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}) {
  const { styles } = useStyles();
  const control = (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggleTrack, value && styles.toggleTrackOn]}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );

  if (!label) {
    return control;
  }
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      {control}
    </View>
  );
}

export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyRule} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  const { styles, colors } = useStyles();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  );
}

export function Rule({ style }: { style?: ViewStyle }) {
  const { styles } = useStyles();
  return <View style={[styles.rule, style]} />;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  const { styles } = useStyles();
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue}>{value}</Text>
    </View>
  );
}

/**
 * 푸터 액션 확장 터치 영역(네이티브 전용).
 * 웹은 hitSlop 을 무시하므로 실제 여백(styles.footAction)으로 상자를 키우고,
 * 네이티브는 그 위에 hitSlop 을 더 얹어 넉넉하게 잡는다.
 */
const FOOT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/**
 * 카드 푸터 액션 — 10px 모노 라벨 + 36px 터치 상자. 밑줄 카드·독후감 카드의 푸터가 같이 쓴다.
 * 10px 활자라 글자 상자(16px)만으로는 손가락이 닿지 않는다 — 여백으로 36px 까지 넓히되,
 * 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다. `onPress` 가 없으면 글자만 같은 상자에 놓는다.
 */
export function FootAction({ label, onPress, selected, tone = 'muted', accessibilityLabel, kind }: {
  label: string;
  onPress?: () => void;
  /** 링크 종류 — 주면 linkLabel 규칙(글리프·밑줄)을 따른다. 카운터('좋아요 9')는 비워 둔다. */
  kind?: LinkKind;
  /** 켜짐(예: 좋아요) — 라벨이 악센트로, accessibilityState.selected 를 낸다. */
  selected?: boolean;
  tone?: 'accent' | 'muted' | 'faint' | 'danger';
  /** 라벨과 다르게 읽혀야 할 때(예: '책 보기 →' 는 '{제목} 상세'). 없으면 라벨 그대로. */
  accessibilityLabel?: string;
}) {
  const { styles, colors } = useStyles();
  const color = selected || tone === 'accent'
    ? colors.accent
    : tone === 'faint' ? colors.textFaint
      : tone === 'danger' ? colors.danger
        : colors.textMuted;
  const text = kind ? linkLabel(label, kind) : label;

  if (!onPress) {
    return <Text style={[styles.footLabel, styles.footAction, { color }]}>{text}</Text>;
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={FOOT_HIT_SLOP}
      style={({ pressed }) => [styles.footAction, pressed && pressedStyle]}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.footLabel, { color }]}>{text}</Text>
    </Pressable>
  );
}

export function formatDuration(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분`;
  return `${total}초`;
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return '기록 없음';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function percent(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

function makeStyles(colors: ColorTokens, cardShadow: ViewStyle) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: hairline,
      borderColor: colors.line,
      borderRadius: radius.lg,
      padding: spacing.lg,
      overflow: 'hidden',
      ...cardShadow,
    },
    eyebrow: { ...typeScale.monoEyebrow, color: colors.accent },
    eyebrowPlain: { color: colors.textMuted },
    sectionTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24, color: colors.text },
    doubleRule: { gap: 2 },
    doubleRuleThick: { height: 2, backgroundColor: colors.lineStrong },
    doubleRuleThin: { height: hairline, backgroundColor: colors.line },
    divider: { height: hairline, backgroundColor: colors.line },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    button: {
      minHeight: 46,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    buttonSm: { minHeight: 34, paddingHorizontal: spacing.md },
    buttonPrimary: { backgroundColor: colors.accent },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: hairline,
      borderColor: colors.lineStrong,
    },
    buttonGhost: { backgroundColor: 'transparent', minHeight: 32, paddingHorizontal: 0 },
    buttonDanger: {
      backgroundColor: 'transparent',
      borderWidth: hairline,
      borderColor: colors.danger,
    },
    buttonDisabled: { opacity: 0.35 },
    // 종이 단 위에 놓인 버튼 — 평상시 2px 단, 눌리면 1px 옮겨 앉아 단이 1px 로 준다(2번 종이 겹침과 같은 언어).
    buttonPlate: { boxShadow: `2px 2px 0 ${colors.lineStrong}` },
    buttonSat: { transform: [{ translateX: 1 }, { translateY: 1 }], boxShadow: `1px 1px 0 ${colors.lineStrong}` },
    buttonLabel: { ...typeScale.label, color: colors.text },
    buttonLabelSm: { fontSize: 12 },
    buttonLabelPrimary: { color: colors.onAccent },
    buttonLabelDanger: { color: colors.danger },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceRaised,
      alignSelf: 'flex-start',
    },
    tagText: { fontFamily: mono.medium, fontSize: 10.5, letterSpacing: 0.6, color: colors.textMuted },
    track: {
      backgroundColor: colors.surfaceRaised,
      width: '100%',
      overflow: 'hidden',
      borderRadius: radius.sm,
    },
    fill: { backgroundColor: colors.accent, height: '100%', borderRadius: radius.sm },
    numeral: { ...typeScale.monoNumeral, color: colors.text },
    field: { marginBottom: spacing.lg },
    fieldLabel: { ...typeScale.monoEyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    fieldHint: { ...typeScale.caption, color: colors.textFaint, marginTop: spacing.xs },
    fieldError: { ...typeScale.caption, color: colors.danger, marginTop: spacing.xs },
    input: {
      backgroundColor: colors.surface,
      borderWidth: hairline,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontFamily: serif.regular,
      fontSize: 15,
      color: colors.text,
    },
    inputError: { borderColor: colors.danger },
    segmented: {
      flexDirection: 'row',
      borderWidth: hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    segment: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
    segmentDivider: { borderLeftWidth: hairline, borderLeftColor: colors.line },
    segmentActive: { backgroundColor: colors.ink },
    segmentLabel: { ...typeScale.label, fontSize: 12, color: colors.textMuted },
    segmentLabelActive: { color: colors.onInk },
    toggleTrack: {
      width: 46,
      height: 26,
      borderWidth: hairline,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.sm,
      padding: 2,
      justifyContent: 'center',
    },
    toggleTrackOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: radius.sm,
      backgroundColor: colors.textFaint,
    },
    toggleKnobOn: { backgroundColor: colors.onAccent, alignSelf: 'flex-end' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    toggleLabel: { ...typeScale.label, color: colors.text },
    toggleDescription: { ...typeScale.caption, color: colors.textFaint, lineHeight: 16 },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyRule: { width: 28, height: 2, backgroundColor: colors.accent, marginBottom: spacing.lg },
    emptyTitle: { ...typeScale.titleSerif, fontSize: 18, color: colors.text, textAlign: 'center' },
    emptyDescription: {
      ...typeScale.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 21,
    },
    loading: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
    rule: { height: hairline, backgroundColor: colors.line },
    keyValue: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingVertical: spacing.sm,
    },
    keyValueLabel: { ...typeScale.caption, color: colors.textMuted },
    keyValueValue: { ...typeScale.monoNumeral, color: colors.text },
    footLabel: { ...typeScale.monoLabel, fontSize: 10, letterSpacing: 0.4 },
    // 여백으로 손가락 상자를 키우되, 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다.
    footAction: { paddingVertical: 10, paddingHorizontal: 6, marginVertical: -6, marginHorizontal: -6 },
  });
}
