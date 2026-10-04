import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { kstTime } from '@/components/clubLog';
import { useBottomBarPadding } from '@/components/keyboard';
import { EmptyState } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, iconStroke, mono, pressedStyle } from '@/theme/tokens';

/**
 * 채팅 공용 부품 — 클럽 채팅과 1:1 대화방이 같은 말풍선·같은 입력 줄을 쓰도록 모은다.
 * 상대 말은 종이(surface)에 헤어라인, 내 말은 잉크 반전. 민트(accent)는 쓰지 않는다 —
 * 보내기도 잉크 네모에 선 아이콘이다. 이름·시각은 모노.
 */

/** 대화 목록 안쪽 여백 — 두 채팅이 같은 폭·같은 간격으로 말풍선을 놓는다. */
export const chatListContent = { ...layout.content, padding: spacing.lg, gap: spacing.md } as const;

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
      {...props}
      style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }, style]}
    />
  );
}

/**
 * 보내기 — 48pt 잉크 네모에 위 화살표 선 아이콘. 쓸 말이 없으면 가라앉고,
 * 보내는 중에는 잉크를 유지한 채 스피너를 돌린다(중복 전송은 막는다).
 */
export function ChatSendButton({ onPress, disabled = false, loading = false }: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const filled = !disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="보내기"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.send,
        { backgroundColor: filled ? colors.ink : colors.surfaceRaised },
        pressed ? pressedStyle : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onInk} />
      ) : (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={filled ? colors.onInk : colors.textFaint}>
          <Path d="M12 19V5M6 11l6-6 6 6" {...iconStroke} />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
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
  send: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
