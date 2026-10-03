import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, TextInputProps,
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

/**
 * 아이브로우 — 모노 대문자 라벨. 뮤트 톤으로만 쓴다 — 악센트는 화면의 CTA·진행·링크 몫이라
 * 섹션 라벨까지 칠하면 정작 눌러야 할 하나가 묻힌다(UX 철칙 Von Restorff).
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <Text style={styles.eyebrow}>{children}</Text>;
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

/**
 * 버튼 터치 상자는 44pt 이상(UX 철칙 Fitts). sm 은 겉모습(34pt)을 지키고 위아래 hitSlop 으로,
 * ghost 는 글자뿐이라 상자 높이를 44 로 두고 좌우 hitSlop 으로 짧은 라벨('취소')의 폭을 채운다.
 * 웹은 hitSlop 을 무시하지만 웹은 확인용 미리보기라 네이티브 기준으로 맞춘다.
 */
const SM_HIT_SLOP = { top: 5, bottom: 5 };
const GHOST_HIT_SLOP = { left: 10, right: 10 };

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
  // 눌림 — 앱의 다른 글자·아이콘 버튼과 같은 규칙으로 흐려진다(pressedStyle). 비활성은 반응하지 않는다.
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={variant === 'ghost' ? GHOST_HIT_SLOP : size === 'sm' ? SM_HIT_SLOP : undefined}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        style,
        pressed && !isDisabled && pressedStyle,
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

export function Field({ label, hint, error, style, ...props }: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const { styles, colors } = useStyles();
  // 바깥 여백은 두지 않는다 — 칸 사이 간격은 쓰는 화면이 gap 으로 정한다. 여백을 품고 있으면 화면의 gap 과
  // 겹쳐 같은 묶음의 칸끼리 다른 묶음보다 멀어진다(UX 철칙 Proximity).
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, error ? styles.inputError : null, style]}
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

/** 라벨 없는 토글의 트랙(26pt)을 위아래로 넓혀 44pt 터치 상자로 만든다. */
const TOGGLE_HIT_SLOP = { top: 9, bottom: 9 };

/**
 * 직접 그린 토글. 플랫폼 기본 Switch 는 iOS/안드로이드/웹에서 색이 제각각이라
 * 디자인을 지키기 위해 직접 그린다. 라벨이 있으면 행 전체가 눌린다 — 트랙(46×26)만으로는 손가락이 빗나간다.
 */
export function Toggle({ value, onChange, label, description }: {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}) {
  const { styles } = useStyles();
  const track = (
    <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </View>
  );

  if (!label) {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onChange(!value)}
        hitSlop={TOGGLE_HIT_SLOP}
      >
        {track}
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.toggleRow, pressed && pressedStyle]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      {track}
    </Pressable>
  );
}


export function EmptyState({ title, description, action, illustration = false }: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.empty}>
      {illustration ? (
        <Image
          source={require('../../assets/illustrations/book-lover.png')}
          resizeMode="contain"
          accessibilityLabel="책을 읽는 사람"
          style={styles.emptyIllustration}
        />
      ) : null}
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
 * 카드 푸터 액션 — 10px 모노 라벨 + 36px 터치 상자. 독후감 카드 푸터 등이 같이 쓴다.
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
    eyebrow: { ...typeScale.monoEyebrow, color: colors.textMuted },
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
    buttonGhost: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 0 },
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
      paddingHorizontal: spacing.sm,
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
    // 선택은 잉크로 뒤집는다 — 악센트는 CTA 몫. 높이는 손가락 기준 44pt.
    segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
    toggleTrackOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: radius.sm,
      backgroundColor: colors.textFaint,
    },
    toggleKnobOn: { backgroundColor: colors.onInk, alignSelf: 'flex-end' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
    toggleLabel: { ...typeScale.label, color: colors.text },
    toggleDescription: { ...typeScale.caption, color: colors.textFaint, lineHeight: 16 },
    empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyIllustration: { width: 184, height: 143, marginBottom: spacing.lg },
    // 장식 막대는 회색 — 빈 상태 아래의 행동 버튼이 화면의 유일한 강조가 되게(UX 철칙 Von Restorff).
    emptyRule: { width: 28, height: 2, backgroundColor: colors.lineStrong, marginBottom: spacing.lg },
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
