import {
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle,
} from 'react-native';

import type { EmailCodeResponse } from '@/api/types';
import { spacing, typeScale, type ColorTokens } from '@/theme';

/*
 * 가입·비밀번호 찾기 화면이 같이 쓰는 입력 부품 — 두 화면 모두 다크 고정이라 색은 colors 로 받는다(SignupConsentBox 와 같은 방식).
 * 칸에 걸린 오류는 그 칸 밑에, 인증 코드의 남은 입력 시간은 칸 안 오른쪽에 둔다 — 두 화면이 같은 자리·같은 문구를 쓰게(Jakob).
 */

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value) && value.length <= 255;

/** 인증 코드 입력 시간이 끝났을 때 코드 칸 밑에 띄우는 경고. */
export const CODE_EXPIRED_MESSAGE = '입력 시간이 지났어요. 코드를 다시 받아 주세요.';

/** 같은 이메일로 1시간 안에 받은 코드 수와 그 상한 — '다시 받기' 버튼에 'used/limit' 으로 붙인다. */
export type CodeSends = { used: number; limit: number };

/**
 * 코드 발급 응답에서 받은 수를 꺼낸다(서버가 1시간 상한을 센다). 서버가 횟수를 세지 못했거나(resendsLeft 없음)
 * 상한을 주지 않는 옛 서버면 null — 버튼에 숫자를 붙이지 않는다.
 */
export const codeSendsOf = (res: EmailCodeResponse): CodeSends | null =>
  res.resendsLeft == null || !(res.sendLimit > 0)
    ? null
    : { used: res.sendLimit - res.resendsLeft, limit: res.sendLimit };

/** 화면 읽기 프로그램이 읽을 버튼 이름 — '3/5' 는 분수로 읽히니 말로 풀어 쓴다. */
export const resendA11yLabel = (label: string, sends: CodeSends | null) =>
  sends ? `${label}, ${sends.limit}번 중 ${sends.used}번 받음` : label;

/**
 * 코드 받기 버튼 글자 — 받은 수를 'used/limit' 으로 붙이고, 상한까지 받았으면 그 숫자를 붉게 쓴다.
 * 다 받아도 버튼은 막지 않는다 — 언제 풀리는지 모르니, 누르면 서버가 '잠시 후 다시 받아 주세요'로 답한다.
 */
export function ResendLabel({ label, sends, colors, style }: {
  label: string;
  sends: CodeSends | null;
  colors: ColorTokens;
  style: StyleProp<TextStyle>;
}) {
  return (
    <Text style={style}>
      {label}
      {sends ? (
        <Text style={[styles.sendCount, { color: sends.used >= sends.limit ? colors.danger : colors.textMuted }]}>
          {` ${sends.used}/${sends.limit}`}
        </Text>
      ) : null}
    </Text>
  );
}

/** 남은 초를 '2:59' 꼴로. */
const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** 칸 밑 경고 한 줄 — 없으면 자리를 차지하지 않는다. */
export function FieldError({ message, colors }: { message?: string; colors: ColorTokens }) {
  return message
    ? <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">{message}</Text>
    : null;
}

/**
 * 인증 코드 칸 — timing 이면 칸 안 오른쪽에 남은 입력 시간을 센다. 끝나면(0초) 시간이 붉게 바뀐다.
 * 경고 문구는 쓰는 화면이 FieldError 로 칸 밑에 둔다. 칸 겉모습(inputStyle)도 쓰는 화면의 입력칸과 맞춘다.
 */
export function TimedCodeInput({ colors, inputStyle, timing, secondsLeft, error, ...props }: TextInputProps & {
  colors: ColorTokens;
  inputStyle: StyleProp<TextStyle>;
  timing: boolean;
  secondsLeft: number;
  error?: string;
}) {
  const expired = timing && secondsLeft === 0;
  return (
    <View style={styles.wrap}>
      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6자리"
        placeholderTextColor={colors.textFaint}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        {...props}
        style={[inputStyle, timing ? styles.timed : null, error ? { borderColor: colors.danger } : null]}
      />
      {timing ? (
        <View style={styles.clock} pointerEvents="none">
          <Text
            style={[styles.clockLabel, { color: expired ? colors.danger : colors.textMuted }]}
            accessibilityLabel={`남은 시간 ${Math.floor(secondsLeft / 60)}분 ${secondsLeft % 60}초`}
          >
            {formatClock(secondsLeft)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { ...typeScale.caption },
  wrap: { flex: 1, justifyContent: 'center' },
  // 칸 안 오른쪽 타이머 자리('2:59' 너비 + 여백)만큼 글자를 비운다.
  timed: { paddingRight: 64 },
  clock: { position: 'absolute', right: spacing.md },
  clockLabel: { ...typeScale.label, fontVariant: ['tabular-nums'] },
  sendCount: { fontVariant: ['tabular-nums'] },
});
