/**
 * View 하나를 PNG 로 떠서 공유·저장한다 — 주간 읽기로그 카드와 클럽 노트 페이지가 같이 쓴다.
 *
 * 네이티브: view-shot 이 임시 파일로 뜨고 expo-sharing 시트로 넘긴다.
 * 웹: captureRef 가 DOM 노드를 html2canvas 로 그려 data URI 를 주면, 파일 공유를 지원하는 브라우저(모바일 사파리·크롬)는
 * 공유 시트로, 아니면 PNG 로 내려받는다. 원격 이미지는 CORS 헤더가 있어야 캔버스에 그려진다.
 */
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type SharePngOptions = {
  /** 내보내는 픽셀 크기 — 캡처 대상의 비율과 같아야 한다. */
  width: number;
  height: number;
  /** 내려받기·공유 파일 이름(.png 포함). */
  fileName: string;
  /** 공유 시트 제목. */
  title: string;
};

/** unavailable = 이 기기에 공유 수단이 없음, cancelled = 사용자가 시트를 닫음(실패로 알리지 않는다). */
export type SharePngResult = 'shared' | 'downloaded' | 'unavailable' | 'cancelled';

export async function sharePng(ref: RefObject<View | null>, opts: SharePngOptions): Promise<SharePngResult> {
  const node = ref.current;
  if (!node) throw new Error('캡처할 뷰가 아직 없습니다.');
  const size = { width: opts.width, height: opts.height };
  try {
    if (Platform.OS === 'web') return await shareOnWeb(node, size, opts);
    const uri = await captureRef(node, { format: 'png', quality: 1, result: 'tmpfile', ...size });
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: opts.title, UTI: 'public.png' });
    return 'shared';
  } catch (e) {
    // 사용자가 공유 창을 닫으면 AbortError — 호출처가 실패로 알리지 않게 결과로 돌려준다.
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    throw e;
  }
}

async function shareOnWeb(
  node: View,
  size: { width: number; height: number },
  opts: SharePngOptions,
): Promise<SharePngResult> {
  const dataUri = await captureRef(node, { format: 'png', quality: 1, result: 'data-uri', ...size });
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], opts.fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: opts.title });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
