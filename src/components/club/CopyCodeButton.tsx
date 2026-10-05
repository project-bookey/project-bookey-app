import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react-native';

import { Button } from '@/components/ui';

import { notify } from './dialogs';

/** 복사했다는 표시(✓)를 남겨 두는 시간 — 대화상자를 띄우지 않고 아이콘만 잠깐 바꾼다. */
const COPIED_MS = 2000;

/**
 * 초대 코드 복사 — 클럽 정보와 클럽 설정의 초대 코드 줄 맨 오른쪽에 둔다.
 * 초록(primary)으로 채워 한눈에 찾게 한다(사용자 결정, 2026-10-05). 글자 없이 복사 아이콘만, 누르면 잠깐 체크로 바뀐다
 * (2026-10-05 사용자 결정 — 아이콘만 봐도 알 만한 것은 글자를 뺀다). 읽어 주는 말은 '초대 코드 복사' → '복사했어요'.
 */
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

  return (
    <Button
      icon={copied ? Check : Copy}
      accessibilityLabel={copied ? '복사했어요' : '초대 코드 복사'}
      size="sm"
      variant="primary"
      onPress={copy}
    />
  );
}
