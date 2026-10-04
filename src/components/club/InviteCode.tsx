import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { StickyNote } from '@/components/collage';
import { Button } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

import { notify } from './dialogs';

/** 복사했다는 표시를 라벨에 남겨 두는 시간 — 대화상자를 띄우지 않고 라벨만 잠깐 바꾼다. */
const COPIED_MS = 2000;

/**
 * 초대 코드 — 초록 스티키 메모 위에 올려 한눈에 찾게 한다(클럽 정보 · 클럽 설정).
 * 도서 상세의 평점 메모처럼 기울이지 않는다 — 옮겨 적을 글자라 반듯해야 읽기 쉽다.
 */
export function InviteCodeNote({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <StickyNote rotate={0} style={styles.note}>
      <Text style={[styles.code, { color: colors.onNote }]} selectable>{code}</Text>
    </StickyNote>
  );
}

/** 초대 코드 복사 — 초대 코드 메모 오른쪽에 둔다. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      notify('복사하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return <Button label={copied ? '복사했어요' : '복사'} size="sm" variant="outline" onPress={copy} />;
}

const styles = StyleSheet.create({
  note: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  code: { fontFamily: mono.semiBold, fontSize: 18, letterSpacing: 2 },
});
