import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
};

const DEFAULT_DATE = new Date(2000, 0, 1);
const MIN_DATE = new Date(1900, 0, 1);

function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return DEFAULT_DATE;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? DEFAULT_DATE : date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 가입·프로필에서 공통으로 쓰는 생년월일 선택기. iOS는 휠, Android는 날짜 다이얼을 연다. */
export function BirthDatePicker({ value, onChange, accessibilityLabel = '생년월일' }: Props) {
  const { colors } = useTheme();
  const [androidOpen, setAndroidOpen] = useState(false);
  const date = parseDate(value);

  const change = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setAndroidOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(formatDate(selected));
  };

  if (Platform.OS === 'web') {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textFaint}
        inputMode="numeric"
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text }]}
      />
    );
  }

  if (Platform.OS === 'android') {
    return (
      <View>
        <Pressable
          onPress={() => setAndroidOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={[styles.input, styles.button, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}
        >
          <Text style={[typeScale.body, { color: value ? colors.text : colors.textFaint }]}>
            {value || '생년월일 선택'}
          </Text>
        </Pressable>
        {androidOpen ? (
          <DateTimePicker value={date} mode="date" maximumDate={new Date()} minimumDate={MIN_DATE} onChange={change} />
        ) : null}
      </View>
    );
  }

  return (
    <DateTimePicker
      value={date}
      mode="date"
      display="spinner"
      locale="ko-KR"
      maximumDate={new Date()}
      minimumDate={MIN_DATE}
      onChange={change}
      accessibilityLabel={accessibilityLabel}
      style={styles.spinner}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  button: { justifyContent: 'center' },
  spinner: { alignSelf: 'stretch', height: 180 },
});
