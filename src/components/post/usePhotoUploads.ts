import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
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

/** 네이티브에서 사진첩 권한을 거부했을 때 띠 아래에 다는 한 줄 — 웹은 권한이 없어 뜨지 않는다. */
const PERMISSION_NOTICE = '사진첩 접근을 허용해 주세요';
/** 서버가 이유를 주지 않았을 때의 한 줄 — 이유가 있으면 서버 문장을 그대로 보여 준다. */
const UPLOAD_NOTICE = '사진을 올리지 못했어요 · 다시 시도';
/**
 * 서버 사진 저장소가 꺼져 있을 때의 오류 코드(503). 앱 문제가 아니라 서버 설정이라 다시 올려도 결과가 같다 —
 * 이때만 '다시'와 고르기를 잠근다. 서버 설정만 바꾸면 다시 켜지므로 앱에 기능 플래그를 박아 두지 않는다.
 */
const STORAGE_DISABLED = 'STORAGE_DISABLED';

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
  /** 고르기 창이 떠 있는 동안 참 — 고스트 타일을 잠그는 데 쓴다. */
  picking: boolean;
  /** 띠 아래에 보일 한 줄 안내(권한 거부·업로드 실패 이유) — 없으면 null. */
  notice: string | null;
  /** 다시 올려 볼 만하면 참 — 서버 저장소가 꺼져 있으면 거짓이라 '다시'와 고르기를 잠근다. */
  retryable: boolean;
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
    // 정리에서 내려간 깃발을 다시 세운다 — StrictMode 는 마운트 직후 한 번 정리했다가 다시 실행한다.
    alive.current = true;
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
  // 고르기 창은 한 번에 하나만 — 두 번 눌러도 창이 겹치지 않게 ref 로 막고, 잠금은 state 로 그린다.
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);

  const patch = useCallback((key: string, next: Partial<PhotoUpload>) => {
    // 이미 뗀 타일(키 없음)이면 아무 일도 없다 — 늦게 온 결과가 되살아나지 않는다.
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...next } : p)));
  }, []);

  const upload = useCallback(async (key: string, asset: PickedAsset) => {
    try {
      const form = await prepareImage(asset);
      const image = await postApi.uploadImage(form);
      if (!alive.current) return;
      patch(key, { status: 'done', image });
      // 한 장이라도 올라갔으면 앞선 실패 이야기는 지운다 — 서버 저장소가 다시 켜진 경우다.
      setNotice(null);
      setRetryable(true);
    } catch (error) {
      if (!alive.current) return;
      patch(key, { status: 'failed' });
      // 실패한 이유를 그대로 보여 준다 — 안 그러면 '다시'만 보고 뜻 없이 계속 누르게 된다.
      setNotice(error instanceof ApiError ? error.message : UPLOAD_NOTICE);
      if (error instanceof ApiError && error.code === STORAGE_DISABLED) setRetryable(false);
    }
  }, [patch]);

  const pick = useCallback(async () => {
    // 고르기 창이 이미 떠 있으면 무시한다 — 창이 겹치면 남은 장수 계산이 어긋난다.
    if (pickingRef.current) return;
    if (max - count.current <= 0) return;
    pickingRef.current = true;
    setPicking(true);
    // 창이 닫히는 순간 잠금을 푼다 — 올라가는 동안에도 더 고를 수 있어야 한다.
    const release = () => {
      pickingRef.current = false;
      if (alive.current) setPicking(false);
    };
    let tiles: PhotoUpload[] = [];
    try {
      // 웹은 사진첩 권한이 없다(항상 허용) — 네이티브만 묻는다.
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          if (alive.current) setNotice(PERMISSION_NOTICE);
          return;
        }
      }
      if (alive.current) setNotice(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        ...IMAGE_PICKER_OPTIONS,
        selectionLimit: max - count.current,
      });
      if (result.canceled) return;
      // 웹 파일 창은 selectionLimit 을 모른다 — 남은 장수만큼만 받는다.
      const chosen = result.assets.slice(0, Math.max(0, max - count.current));
      if (chosen.length === 0) return;
      tiles = chosen.map((asset): PhotoUpload => {
        const key = `${asset.uri}#${seq.current++}`;
        assets.current.set(key, { uri: asset.uri, width: asset.width, height: asset.height });
        return { key, localUri: asset.uri, status: 'uploading' };
      });
      setPhotos((prev) => [...prev, ...tiles]);
    } finally {
      release();
    }
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
    picking,
    notice,
    retryable,
    imageIds: photos.flatMap((p) => (p.status === 'done' && p.image ? [p.image.id] : [])),
  };
}
