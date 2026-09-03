import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { postApi } from '@/api/endpoints';
import type { PostImage } from '@/api/types';
import { IMAGE_PICKER_OPTIONS, prepareImage } from '@/api/upload';

/** 글 하나에 붙일 수 있는 사진 장수 — 서버 상한과 같은 값. */
export const POST_IMAGE_MAX = 10;

/** 사진 타일 하나 — 고른 직후엔 로컬 uri 로 그리고, 올라가면 서버가 준 image 를 든다. */
export type PhotoUpload = {
  key: string;
  localUri?: string;
  status: 'uploading' | 'done' | 'failed';
  image?: PostImage;
};

/** 다시 올릴 때 필요한 만큼만 남긴 자산. */
type PickedAsset = { uri: string; width?: number; height?: number };

/**
 * 독후감 사진 업로드 — 고르기·병렬 업로드·다시 올리기·떼기.
 *
 * 사진은 고르는 즉시 한 장씩 따로 올린다(useMutation 이 아니라 Promise 병렬) — 열 장을 고르면 열 타일이
 * 동시에 돌고, 하나가 실패해도 나머지는 그대로 붙는다. 뗀 사진은 서버에 지우라고 하지 않는다 —
 * 글에 안 붙은 사진은 24시간 뒤 배치가 회수한다. `initial` 은 수정 화면이 넘기는, 이미 붙어 있던 사진이다.
 */
export function usePhotoUploads(initial: PostImage[], max = POST_IMAGE_MAX): {
  photos: PhotoUpload[];
  pick: () => Promise<void>;
  retry: (key: string) => void;
  remove: (key: string) => void;
  /** 올라가는 중인 사진이 하나라도 있으면 참. */
  busy: boolean;
  /** 올라간 사진의 id — 타일 순서 그대로. */
  imageIds: number[];
} {
  const [photos, setPhotos] = useState<PhotoUpload[]>(() =>
    initial.map((image) => ({ key: `server:${image.id}`, status: 'done', image })),
  );
  // 다시 올리기용 원본 자산 — 렌더와 무관하니 상태에 두지 않는다.
  const assets = useRef(new Map<string, PickedAsset>());
  // 같은 파일을 두 번 골라도 키가 겹치지 않게 순번을 붙인다.
  const seq = useRef(0);
  // 화면을 떠난 뒤 도착한 업로드 결과는 버린다. 웹은 고른 파일의 objectURL 도 이때 돌려준다.
  const alive = useRef(true);
  useEffect(() => {
    const held = assets.current;
    return () => {
      alive.current = false;
      if (Platform.OS === 'web') {
        for (const asset of held.values()) if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
      }
      held.clear();
    };
  }, []);
  // pick 은 비동기라 고르기 창이 닫힌 시점의 장수를 ref 로 본다.
  const count = useRef(photos.length);
  count.current = photos.length;

  const patch = useCallback((key: string, next: Partial<PhotoUpload>) => {
    // 이미 뗀 타일(키 없음)이면 아무 일도 없다 — 늦게 온 결과가 되살아나지 않는다.
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...next } : p)));
  }, []);

  const upload = useCallback(async (key: string, asset: PickedAsset) => {
    try {
      const form = await prepareImage(asset);
      const image = await postApi.uploadImage(form);
      if (alive.current) patch(key, { status: 'done', image });
    } catch {
      if (alive.current) patch(key, { status: 'failed' });
    }
  }, [patch]);

  const pick = useCallback(async () => {
    if (max - count.current <= 0) return;
    // 웹은 사진첩 권한이 없다(항상 허용) — 네이티브만 묻는다.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_OPTIONS,
      selectionLimit: max - count.current,
    });
    if (result.canceled) return;
    // 웹 파일 창은 selectionLimit 을 모른다 — 남은 장수만큼만 받는다.
    const chosen = result.assets.slice(0, Math.max(0, max - count.current));
    if (chosen.length === 0) return;
    const tiles = chosen.map((asset): PhotoUpload => {
      const key = `${asset.uri}#${seq.current++}`;
      assets.current.set(key, { uri: asset.uri, width: asset.width, height: asset.height });
      return { key, localUri: asset.uri, status: 'uploading' };
    });
    setPhotos((prev) => [...prev, ...tiles]);
    await Promise.all(tiles.map((tile) => upload(tile.key, assets.current.get(tile.key)!)));
  }, [max, upload]);

  const retry = useCallback((key: string) => {
    const asset = assets.current.get(key);
    if (!asset) return;
    patch(key, { status: 'uploading' });
    void upload(key, asset);
  }, [patch, upload]);

  const remove = useCallback((key: string) => {
    const asset = assets.current.get(key);
    assets.current.delete(key);
    if (Platform.OS === 'web' && asset?.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }, []);

  return {
    photos,
    pick,
    retry,
    remove,
    busy: photos.some((p) => p.status === 'uploading'),
    imageIds: photos.flatMap((p) => (p.status === 'done' && p.image ? [p.image.id] : [])),
  };
}
