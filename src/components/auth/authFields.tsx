import {
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle,
} from 'react-native';

import { spacing, typeScale, type ColorTokens } from '@/theme';

/*
 * 가입·비밀번호 찾기 화면이 같이 쓰는 입력 부품 — 두 화면 모두 다크 고정이라 색은 colors 로 받는다(SignupConsentBox 와 같은 방식).
 * 칸에 걸린 오류는 그 칸 밑에, 인증 코드의 남은 입력 시간은 칸 안 오른쪽에 둔다 — 두 화면이 같은 자리·같은 문구를 쓰게(Jakob).
 */

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value) && value.length <= 255;

/** 인증 코드 입력 시간이 끝났을 때 코드 칸 밑에 띄우는 경고. */
export const CODE_EXPIRED_MESSAGE = '입력 시간이 지났어요. 코드를 다시 받아 주세요.';

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
});
