import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator, AccessibilityRole, AccessibilityState, Image, Insets, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  View, ViewStyle,
} from 'react-native';

import {
  controlFace, controlHeight, hairline, pressedStyle, radius, spacing, typeScale, useTheme,
} from '@/theme';
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

/** 글자 링크(13px 글자 상자 약 17pt)를 위아래로 넓혀 44pt 터치 상자로 만든다. */
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

/**
 * 글자 링크 — 섹션 머리의 '전체보기 ›', 카드 끝의 '모임 노트 ›' 같은 화면 이동·제자리 링크. 13px 라벨을 본문색으로 쓴다:
 * 11px 회색이던 때는 메타 정보처럼 읽혀서 서재로 가는 유일한 길('전체보기')조차 눈에 띄지 않았다(2026-10-04).
 * 12 → 13 은 2026-10-05 버튼 비교 페이지에서 사용자가 골랐다.
 * 악센트는 쓰지 않는다 — 화면의 CTA 하나만 강조한다(UX 철칙 Von Restorff). 라벨 글리프는 linkLabel 규칙을 따른다.
 */
export function TextLink({
  label, onPress, kind = 'nav', accessibilityLabel, accessibilityRole = 'button', accessibilityState, numberOfLines,
  hitSlop = LINK_HIT_SLOP, style,
}: {
  label: string;
  onPress: () => void;
  kind?: LinkKind;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  /** 펼치기 링크 등 — 예: { expanded }. */
  accessibilityState?: AccessibilityState;
  numberOfLines?: number;
  /** null — 상자(style)가 이미 44pt 라 넓히지 않는다. */
  hitSlop?: Insets | null;
  style?: ViewStyle;
}) {
  const { styles } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop ?? undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [style, pressed && pressedStyle]}
    >
      <Text numberOfLines={numberOfLines} style={styles.textLink}>{linkLabel(label, kind)}</Text>
    </Pressable>
  );
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
 * 버튼 터치 상자는 44pt 이상(UX 철칙 Fitts). sm 은 겉모습(32pt)을 지키고 위아래 hitSlop 으로,
 * ghost 는 글자뿐이라 상자 높이를 44 로 두고 좌우 hitSlop 으로 짧은 라벨('취소')의 폭을 채운다.
 * 웹은 hitSlop 을 무시하지만 웹은 확인용 미리보기라 네이티브 기준으로 맞춘다.
 */
const SM_HIT_SLOP = { top: (44 - controlHeight.sm) / 2, bottom: (44 - controlHeight.sm) / 2 };
const GHOST_HIT_SLOP = { left: 10, right: 10 };
/** FootAction xs(겉모습 26pt) — 위아래 9 로 44pt, 좌우 4 는 짧은 라벨의 폭을 거든다(이웃 버튼과 spacing.sm 띄우면 겹치지 않는다). */
const XS_HIT_SLOP = { top: (44 - controlHeight.xs) / 2, bottom: (44 - controlHeight.xs) / 2, left: 4, right: 4 };

export function Button({
  label, onPress, variant = 'primary', disabled, loading, style, size = 'md', accessibilityLabel,
}: {
  label: string;
  /** 라벨과 다르게 읽혀야 할 때(예: '닫기' → '공지 닫기'). 없으면 라벨 그대로. */
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isDisabled ? { disabled: true } : undefined}
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
            variant === 'ghost' && styles.buttonLabelGhost,
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

/**
 * 세그먼트 — 회색 톤 트랙 안에 고른 칸을 종이색으로 까는 모양(2026-10-05 '부드러운 네모'). 팔로우·고객문의의 칸 바꾸기도
 * 이것 하나를 쓴다(예전 CapsuleTabs 를 합쳤다). 트랙 높이 44pt 를 넘겨 칸 전체가 손가락 상자다.
 */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
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
 * 라디오 표시 — 20pt 링(2px) 안에 고르면 점 10pt. 꺼짐 테두리는 control(대비 3:1). 2026-10-05 설정 알림 말투(16 채움)·
 * 공개 범위(20 링)로 갈려 있던 것을 하나로 맞췄다. 누르는 것은 이것을 품은 행이다(accessibilityRole="radio").
 */
export function RadioMark({ checked }: { checked: boolean }) {
  const { styles } = useStyles();
  return (
    <View style={[styles.radio, checked && styles.radioOn]}>
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

/** 라벨 없는 토글의 트랙(24pt)을 위아래로 넓혀 44pt 터치 상자로 만든다. */
const TOGGLE_HIT_SLOP = { top: 10, bottom: 10 };

/**
 * 직접 그린 토글. 플랫폼 기본 Switch 는 iOS/안드로이드/웹에서 색이 제각각이라
 * 디자인을 지키기 위해 직접 그린다. 라벨이 있으면 행 전체가 눌린다 — 트랙(44×24)만으로는 손가락이 빗나간다.
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
 * 카드 발치 액션 — 작은 보조 버튼(Button outline sm 과 같은 겉모습: 32pt + 위아래 hitSlop 으로 44pt).
 * 독후감 고치기·삭제, 알림·엽서·채팅 삭제, 호스트 넘기기, 채팅 선물 등이 같이 쓴다. 예전엔 10px 회색 글자뿐이라
 * 버튼인 줄 몰랐다(2026-10-04) — 상자가 곧 '누를 수 있음'의 신호다. `onPress` 가 없으면(카운터) 상자 없이 글자만 둔다.
 * '삭제' → '한 번 더'(tone danger)는 바탕까지 연한 빨강으로 바뀌어 상태가 넘어간 것이 보인다.
 * `size="xs"` 는 한 단 작은 겉모습(26pt, 11px) — 리뷰 머리 줄의 고치기·삭제처럼 글 옆에 붙는 자리용. 터치 상자는 hitSlop 으로 44pt.
 */
export function FootAction({ label, onPress, selected, tone = 'muted', accessibilityLabel, disabled, size = 'sm' }: {
  /** 버튼 라벨이라 글리프(›)를 붙이지 않는다 — Button 과 같은 규칙. */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** 켜짐(예: 좋아요) — 라벨이 악센트로, accessibilityState.selected 를 낸다. */
  selected?: boolean;
  tone?: 'accent' | 'muted' | 'faint' | 'danger';
  /** 라벨과 다르게 읽혀야 할 때(예: '책 보기' 는 '{제목} 상세'). 없으면 라벨 그대로. */
  accessibilityLabel?: string;
  size?: 'sm' | 'xs';
}) {
  const { styles, colors } = useStyles();
  const xs = size === 'xs';
  // faint(삭제 대기)도 textMuted 까지는 올린다 — textFaint 는 작은 글자 대비 기준(4.5:1)에 못 미친다.
  const color = selected || tone === 'accent'
    ? colors.accent
    : tone === 'faint' ? colors.textMuted
      : tone === 'danger' ? colors.danger
        : colors.text;

  if (!onPress) {
    return <Text style={[styles.buttonLabel, styles.buttonLabelSm, xs && styles.buttonLabelXs, { color }]}>{label}</Text>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={xs ? XS_HIT_SLOP : SM_HIT_SLOP}
      style={({ pressed }) => [
        styles.button,
        styles.buttonSm,
        xs && styles.buttonXs,
        styles.buttonOutline,
        tone === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && pressedStyle,
      ]}
      accessibilityRole="button"
      accessibilityState={selected === undefined && !disabled ? undefined : { selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.buttonLabel, styles.buttonLabelSm, xs && styles.buttonLabelXs, { color }]}>{label}</Text>
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
    // 버튼 면 — 2026-10-05 버튼 비교 페이지 결정: 48pt · 14 · 부드러운 네모(md 12, 작은 것 control 8),
    // 색은 역할 하나씩(주요 = 초록, 보조 = 회색 톤, 위험 = 연한 빨강)을 평평한 면(controlFace)으로 깐다 — 테두리·그림자 없음.
    button: {
      minHeight: controlHeight.md,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    buttonSm: { minHeight: controlHeight.sm, paddingHorizontal: spacing.md, borderRadius: radius.control },
    buttonXs: { minHeight: controlHeight.xs, paddingHorizontal: spacing.sm, borderRadius: radius.control },
    buttonPrimary: controlFace(colors.accent),
    buttonOutline: controlFace(colors.tonal),
    buttonGhost: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 0 },
    buttonDanger: controlFace(colors.dangerSoft),
    buttonDisabled: { opacity: 0.35 },
    buttonLabel: { ...typeScale.label, fontSize: 14, color: colors.text },
    buttonLabelSm: { fontSize: 12 },
    buttonLabelXs: { fontSize: 11 },
    buttonLabelPrimary: { color: colors.onAccent },
    buttonLabelGhost: { color: colors.textMuted },
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
    // 회색 톤 트랙 안에 고른 칸(thumb)을 종이색으로 깐다 — 악센트는 CTA 몫. 트랙 높이 44pt 이상.
    segmented: {
      flexDirection: 'row',
      padding: 3,
      gap: 3,
      backgroundColor: colors.tonal,
      borderRadius: radius.button,
    },
    segment: { flex: 1, minHeight: 38, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
    segmentActive: controlFace(colors.thumb),
    segmentLabel: { ...typeScale.label, fontSize: 12, color: colors.textMuted },
    segmentLabelActive: { color: colors.text },
    toggleTrack: {
      width: 44,
      height: 24,
      borderWidth: hairline,
      borderColor: colors.control,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.control,
      padding: 2,
      justifyContent: 'center',
    },
    toggleTrackOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: radius.sm,
      backgroundColor: colors.textFaint,
    },
    toggleKnobOn: { backgroundColor: colors.onInk, alignSelf: 'flex-end' },
    radio: {
      width: 20,
      height: 20,
      borderRadius: radius.round,
      borderWidth: 2,
      borderColor: colors.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.ink },
    radioDot: { width: 10, height: 10, borderRadius: radius.round, backgroundColor: colors.ink },
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
    textLink: { ...typeScale.monoLabel, fontSize: 13, color: colors.text },
  });
}
