/**
 * 독후감 사진 업로드 준비.
 *
 * 서버는 10MB·JPEG/PNG/WebP 만 받는다. 사진첩에서 고른 원본은 4000px HEIC 인 경우가 흔하므로
 * 여기서 한 번 줄이고 JPEG 로 다시 인코딩해 크기·형식을 동시에 맞춘다.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerOptions } from 'expo-image-picker';
import { Platform } from 'react-native';

/** 재인코딩 후 장변 상한. 광장 카드·상세에서 쓰기 충분한 크기다. */
const MAX_EDGE = 1600;
/** JPEG 품질 — 눈에 띄는 열화 없이 용량을 크게 줄이는 지점. */
const JPEG_QUALITY = 0.8;

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

  // 크기를 아는 경우에만 줄인다 — 장변만 지정하면 나머지는 비율대로 따라온다.
  const { width, height } = asset;
  if (width !== undefined && height !== undefined && Math.max(width, height) > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }

  const rendered = await context.renderAsync();
  // 크기와 무관하게 항상 JPEG 로 다시 인코딩한다 — HEIC 처럼 서버가 못 받는 형식을 여기서 없앤다.
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('file', await (await fetch(image.uri)).blob(), 'photo.jpg');
  } else {
    // 네이티브 fetch 는 { uri, name, type } 형태를 파일 파트로 알아본다.
    form.append('file', { uri: image.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return form;
}
