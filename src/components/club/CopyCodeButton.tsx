import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui';

import { notify } from './dialogs';

/** 복사했다는 표시를 라벨에 남겨 두는 시간 — 대화상자를 띄우지 않고 라벨만 잠깐 바꾼다. */
const COPIED_MS = 2000;

/** 초대 코드 복사 — 클럽 정보와 클럽 설정의 초대 코드 줄 오른쪽에 둔다. */
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
