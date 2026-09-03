/**
 * 독후감 사진 업로드 준비.
 *
 * 서버는 10MB·JPEG/PNG/WebP 만 받는다. 사진첩에서 고른 원본은 4000px HEIC 인 경우가 흔하므로
 * 여기서 한 번 줄이고 JPEG 로 다시 인코딩해 크기·형식을 동시에 맞춘다.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import type { ImagePickerOptions } from 'expo-image-picker';
import { Platform } from 'react-native';

/** 재인코딩 후 장변 상한. 광장 카드·상세에서 쓰기 충분한 크기다. */
const MAX_EDGE = 1600;
/** JPEG 품질 — 눈에 띄는 열화 없이 용량을 크게 줄이는 지점. */
const JPEG_QUALITY = 0.8;

/** 장변만 MAX_EDGE 로 지정한다 — 짧은 변은 비율대로 따라온다. */
const longEdgeTo = (width: number, height: number) =>
  width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };

/**
 * 다 쓴 ImageRef 를 놓는다 — 네이티브는 비트맵을, 웹은 렌더 결과 objectURL 을 붙들고 있다.
 * `release()` 는 웹에서 no-op 이고 웹 ImageRef 의 `uri` 는 네이티브 타입에 없는 필드라 여기서 따로 회수한다.
 */
function releaseRef(ref: ImageRef) {
  if (Platform.OS === 'web') {
    const { uri } = ref as unknown as { uri?: string };
    if (uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
  }
  ref.release();
}

/**
 * 사진 고르기 옵션. `selectionLimit` 은 남은 장수에 따라 달라지므로 호출처가 펼쳐서 덧붙인다.
 * 원본 화질로 받아 온 뒤 `prepareImage` 에서 한 번만 줄인다(이중 압축 방지).
 */
export const IMAGE_PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: true,
  quality: 1,
  base64: false,
};

/** 고른 자산을 서버 제한(10MB·JPEG/PNG/WebP)에 맞춰 줄이고 multipart 본문으로 만든다. */
export async function prepareImage(asset: {
  uri: string;
  width?: number;
  height?: number;
}): Promise<FormData> {
  const context = ImageManipulator.manipulate(asset.uri);

  // 자산이 치수를 알려 준 경우엔 렌더 전에 한 번에 줄인다.
  const { width, height } = asset;
  const known = width !== undefined && height !== undefined && width > 0 && height > 0;
  if (known && Math.max(width, height) > MAX_EDGE) {
    context.resize(longEdgeTo(width, height));
  }

  let rendered = await context.renderAsync();
  // 웹 파일 선택처럼 치수가 0·undefined 로 오는 자산은 축소를 건너뛰던 자리 — 렌더된 ImageRef 가
  // 실제 치수를 들고 있으므로 그 값으로 판정하고, 그 ImageRef 자체를 원본 삼아 다시 줄인다.
  if (!known && Math.max(rendered.width, rendered.height) > MAX_EDGE) {
    const resized = await ImageManipulator.manipulate(rendered)
      .resize(longEdgeTo(rendered.width, rendered.height))
      .renderAsync();
    releaseRef(rendered);
    rendered = resized;
  }

  try {
    // 크기와 무관하게 항상 JPEG 로 다시 인코딩한다 — HEIC 처럼 서버가 못 받는 형식을 여기서 없앤다.
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

    const form = new FormData();
    if (Platform.OS === 'web') {
      // 웹의 saveAsync 는 objectURL 을 만들어 준다 — Blob 을 꺼낸 즉시 되돌려주지 않으면 탭이 닫힐 때까지 남는다.
      const blob = await (await fetch(image.uri)).blob();
      URL.revokeObjectURL(image.uri);
      form.append('file', blob, 'photo.jpg');
    } else {
      // 네이티브 fetch 는 { uri, name, type } 형태를 파일 파트로 알아본다.
      form.append('file', { uri: image.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    return form;
  } finally {
    // 저장한 파일·Blob 은 그대로 남는다 — 원본을 물고 있는 ImageRef 만 GC 를 기다리지 않고 놓는다.
    releaseRef(rendered);
  }
}
