import { ReactNode, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  View, ViewStyle,
} from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
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

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { styles } = useStyles();
  return <View style={[styles.screen, style]}>{children}</View>;
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  // 눌림 효과 — 스프링 스케일 다운(96%) + 스케일에 연동해 살짝 어두워짐
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      friction: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => springTo(0.96)}
      onPressOut={() => springTo(1)}
      disabled={isDisabled}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        style,
        {
          transform: [{ scale }],
          ...(isDisabled
            ? null
            : { opacity: scale.interpolate({ inputRange: [0.96, 1], outputRange: [0.85, 1] }) }),
        },
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
    </AnimatedPressable>
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
            style={[
              styles.segment,
              index > 0 && styles.segmentDivider,
              active && styles.segmentActive,
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
    screen: { flex: 1, backgroundColor: colors.bg },
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
      borderRadius: radius.pill,
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
    buttonLabel: { ...typeScale.label, color: colors.text },
    buttonLabelSm: { fontSize: 12 },
    buttonLabelPrimary: { color: colors.onAccent },
    buttonLabelDanger: { color: colors.danger },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceRaised,
      alignSelf: 'flex-start',
    },
    tagText: { fontFamily: mono.medium, fontSize: 10.5, letterSpacing: 0.6, color: colors.textMuted },
    track: {
      backgroundColor: colors.surfaceRaised,
      width: '100%',
      overflow: 'hidden',
      borderRadius: radius.pill,
    },
    fill: { backgroundColor: colors.accent, height: '100%', borderRadius: radius.pill },
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
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    segment: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
    segmentDivider: { borderLeftWidth: hairline, borderLeftColor: colors.line },
    segmentActive: { backgroundColor: colors.accent },
    segmentLabel: { ...typeScale.label, fontSize: 12, color: colors.textMuted },
    segmentLabelActive: { color: colors.onAccent },
    toggleTrack: {
      width: 46,
      height: 26,
      borderWidth: hairline,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.pill,
      padding: 2,
      justifyContent: 'center',
    },
    toggleTrackOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
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
  });
}
