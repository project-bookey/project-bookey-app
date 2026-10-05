import type { ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { addDays, kstTime, todayKst } from '@/components/clubLog';
import { useBottomBarPadding } from '@/components/keyboard';
import { EmptyState } from '@/components/ui';
import { controlHeight, controlFace, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, iconStroke, mono, pressedStyle } from '@/theme/tokens';

/**
 * 채팅 공용 부품 — 클럽 채팅과 1:1 대화방이 같은 말풍선·같은 입력 줄을 쓰도록 모은다.
 * 상대 말은 종이(surface)에 헤어라인, 내 말은 잉크 반전. 민트(accent)는 쓰지 않는다 —
 * 보내기도 잉크 네모에 선 아이콘이다. 이름·시각은 모노.
 */

/** 대화 목록 안쪽 여백 — 두 채팅이 같은 폭·같은 간격으로 말풍선을 놓는다. */
export const chatListContent = { ...layout.content, padding: spacing.lg, gap: spacing.md } as const;

/** 입력 상자 안 단추(이모티콘·보내기) 한 변 — 상자 높이 48 에서 위아래 4씩 남는다. */
export const COMPOSER_KEY = 40;
/** 40pt 단추를 44pt 터치 상자로. */
export const COMPOSER_SLOP = { top: 2, bottom: 2, left: 2, right: 2 } as const;

/** 말풍선 한 장 — 상대는 종이에 헤어라인, 나는 잉크 반전. */
export function ChatBubble({ mine, body, sender, createdAt }: {
  mine: boolean;
  body: string;
  /** 상대 말에만 붙는다. 1:1 처럼 머리에 이미 이름이 있으면 비운다. */
  sender?: string;
  createdAt?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.ink }
            : { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.line },
        ]}
      >
        {!mine && sender ? (
          <Text numberOfLines={1} style={[styles.who, { color: colors.textFaint }]}>{sender}</Text>
        ) : null}
        <Text style={[typeScale.body, { color: mine ? colors.onInk : colors.text }]}>{body}</Text>
        <ChatTime createdAt={createdAt} onInk={mine} />
      </View>
    </View>
  );
}

/**
 * 1:1 대화방 말풍선(2026-10-05 시안 A) — 카드 모서리(md), 시각은 말풍선 안이 아니라 옆 바닥에 둔다.
 * 같은 사람이 같은 분에 이어 보낸 말은 묶고, 시각은 묶음의 마지막 말풍선에만 단다(time 을 비운다).
 * 클럽 채팅은 그대로 ChatBubble 을 쓴다.
 */
export function DirectBubble({ mine, body, time }: { mine: boolean; body: string; time?: string }) {
  const { colors } = useTheme();
  const stamp = time ? <ChatSideTime time={time} /> : null;
  return (
    <View style={[styles.directRow, mine && styles.rowMine]}>
      {mine ? stamp : null}
      <View
        style={[
          styles.bubble,
          styles.directBubble,
          mine
            ? { backgroundColor: colors.ink }
            : { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.line },
        ]}
      >
        <Text style={[typeScale.body, { color: mine ? colors.onInk : colors.text }]}>{body}</Text>
      </View>
      {mine ? null : stamp}
    </View>
  );
}

/** 말풍선·이모티콘 옆 바닥에 다는 시각(KST 'HH:mm'). */
export function ChatSideTime({ time }: { time: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.outTime, { color: colors.textFaint }]}>{time}</Text>;
}

/** 날짜가 바뀌는 자리의 가운데 날짜 줄 — '오늘' · '어제' · '10월 4일 토요일'(올해가 아니면 연도도). */
export function ChatDaySeparator({ createdAt }: { createdAt: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dayRow}>
      <Text style={[typeScale.caption, styles.dayChip, { color: colors.textMuted, backgroundColor: colors.tonal }]}>
        {chatDayLabel(createdAt)}
      </Text>
    </View>
  );
}

const KST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** KST 날짜 'YYYY-MM-DD' — 날짜 줄을 넣을지 가를 때 쓴다. */
export function chatDayKey(isoInstant: string): string {
  return KST_DAY.format(new Date(isoInstant));
}

function chatDayLabel(isoInstant: string): string {
  const key = chatDayKey(isoInstant);
  const today = todayKst();
  if (key === today) return '오늘';
  if (key === addDays(today, -1)) return '어제';
  const [y, m, d] = key.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const head = key.slice(0, 4) === today.slice(0, 4) ? '' : `${y}년 `;
  return `${head}${m}월 ${d}일 ${weekday}요일`;
}

/** 보낸 시각(KST, 24시간) — 말풍선 오른쪽 아래. 잉크 위에서는 mid 로 낮춘다. */
export function ChatTime({ createdAt, onInk = false }: { createdAt?: string; onInk?: boolean }) {
  const { colors } = useTheme();
  if (!createdAt) return null;
  return (
    <Text style={[styles.time, { color: onInk ? colors.mid : colors.textFaint }]}>{kstTime(createdAt)}</Text>
  );
}

/** 빈 대화 — inverted 목록은 빈 상태도 뒤집혀 그려지므로 한 번 더 뒤집는다. */
export function ChatEmpty({ description }: { description: string }) {
  return (
    <View style={styles.flip}>
      <EmptyState title="아직 대화가 없어요" description={description} />
    </View>
  );
}

/** 보내기 실패 같은 오류 한 줄 — 입력 줄 바로 위에 붙인다. */
export function ChatError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="alert" style={[typeScale.caption, styles.error, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

/**
 * 입력 줄 — 화면 하단에 붙고 홈 인디케이터만큼 띄운다(키보드 위에 붙어 있을 땐 그 몫을 거둔다).
 * 화면의 KeyboardArea 안에 둔다. 안에 입력창·보내기 등을 나란히 놓는다.
 */
export function ChatInputBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const paddingBottom = useBottomBarPadding(spacing.md);
  return (
    <View
      style={[
        styles.inputBar,
        {
          borderTopColor: colors.line,
          backgroundColor: colors.bg,
          paddingBottom,
        },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * 웹 미리보기에서만 한 줄로 시작 — 브라우저는 여러 줄 입력칸(textarea)을 기본 두 줄 높이로 그린다.
 * 기기에서는 내용에 맞춰 자라므로 건드리지 않는다(react-native-web 은 numberOfLines 를 rows 로 옮긴다).
 */
const WEB_ONE_ROW: Partial<TextInputProps> = Platform.OS === 'web' ? { numberOfLines: 1 } : {};

/** 메시지 입력창 — 여러 줄, 1000자. 높이는 보내기 네모(48)에 맞춘다. */
export function ChatInput({ style, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholder="메시지 보내기"
      placeholderTextColor={colors.textFaint}
      multiline
      maxLength={1000}
      accessibilityLabel="메시지 입력"
      {...WEB_ONE_ROW}
      {...props}
      style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }, style]}
    />
  );
}

/**
 * 1:1 대화방 입력 상자(2026-10-05 시안 A) — 이모티콘 · 입력 · 보내기를 테두리 하나에 묶는다.
 * ChatInputBar 안에 두고, 안에 넣는 입력창은 테두리 없이(composerInput) 쓴다.
 */
export function ChatComposer({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.composer, { borderColor: colors.control, backgroundColor: colors.surface }]}>{children}</View>
  );
}

/** ChatComposer 안 입력창 — 테두리·면은 상자가 그리므로 비운다. */
export const composerInputStyle = {
  borderWidth: 0,
  backgroundColor: 'transparent',
  minHeight: COMPOSER_KEY,
  paddingVertical: spacing.sm + 2,
  paddingHorizontal: spacing.xs,
} as const;

/**
 * 보내기 — 48pt 잉크 네모(공용 버튼과 같은 controlFace·md 모서리)에 위 화살표 선 아이콘. 쓸 말이 없으면
 * 공용 버튼의 비활성처럼 흐려지고(0.35), 보내는 중에는 잉크를 유지한 채 스피너를 돌린다(중복 전송은 막는다).
 * compact 는 ChatComposer 안의 40pt(위아래 hitSlop 으로 44).
 */
export function ChatSendButton({ onPress, disabled = false, loading = false, compact = false, accessibilityLabel = '보내기' }: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  /** 채팅이 아닌 입력줄(클럽 메모 댓글)에서 쓸 때 읽어 줄 말 — 기본 '보내기'. */
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const dimmed = disabled && !loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={compact ? COMPOSER_SLOP : undefined}
      style={({ pressed }) => [
        styles.send,
        compact ? styles.sendCompact : null,
        controlFace(colors.ink),
        dimmed ? styles.dimmed : null,
        pressed ? pressedStyle : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onInk} />
      ) : (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onInk}>
          <Path d="M12 19V5M6 11l6-6 6 6" {...iconStroke} />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  directRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs + 2 },
  directBubble: { borderRadius: radius.md, maxWidth: '74%' },
  outTime: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.3, paddingBottom: 2 },
  dayRow: { alignItems: 'center', paddingVertical: spacing.sm },
  dayChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.control, overflow: 'hidden' },
  composer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: hairline,
    borderRadius: radius.button,
  },
  sendCompact: { width: COMPOSER_KEY, height: COMPOSER_KEY, borderRadius: radius.control },
  rowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    gap: 3,
  },
  who: { fontFamily: mono.medium, fontSize: 9.5, letterSpacing: 0.4 },
  time: { fontFamily: mono.regular, fontSize: 9.5, letterSpacing: 0.3, alignSelf: 'flex-end', marginTop: 2 },
  flip: { transform: [{ scaleY: -1 }] },
  error: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: hairline,
  },
  input: {
    ...typeScale.body,
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: hairline,
    borderRadius: radius.sm,
  },
  send: { width: controlHeight.md, height: controlHeight.md, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.35 },
});
