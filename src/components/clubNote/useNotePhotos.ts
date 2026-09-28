import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
import { clubNoteApi } from '@/api/endpoints';
import { IMAGE_PICKER_OPTIONS, prepareImage } from '@/api/upload';
import { notify } from '@/components/club';
import { tiltFor } from '@/theme/tokens';
import {
  CANVAS, DEFAULT_PHOTO_W, addElement, newId, nextZ, photoHeightFor, type NoteDoc,
} from './noteDoc';
import type { ApplyOptions } from './useNoteEditor';

/** 업로드 중이거나 실패한 사진 — 문서 밖에 산다. 성공해야 photo 요소가 된다(반쯤 올라간 사진이 저장·병합에 섞이지 않게). */
export type PendingPhoto = {
  key: string;
  asset: ImagePicker.ImagePickerAsset;
  x: number;
  y: number;
  w: number;
  h: number;
  status: 'uploading' | 'failed';
  message?: string;
};

/**
 * 사진 고르기 → 줄여서 올리기 → 요소로 넣기. 업로드 응답의 id·url 이 문서에 들어가야 서버가 그 사진을 페이지에 붙인다.
 * 서버 저장소가 꺼져 있으면(STORAGE_DISABLED) 이 세션 동안 사진 도구를 잠근다.
 */
export function useNotePhotos({ clubId, apply, onInserted }: {
  clubId: number;
  apply: (mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => void;
  onInserted?: (id: string) => void;
}) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [disabled, setDisabled] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const upload = useCallback(async (key: string) => {
    const item = pendingRef.current.find((p) => p.key === key);
    if (!item) return;
    try {
      const form = await prepareImage(item.asset);
      const image = await clubNoteApi.uploadImage(clubId, form);
      if (!alive.current) return;
      const h = photoHeightFor(item.w, image.width ?? item.asset.width, image.height ?? item.asset.height);
      apply((d) => addElement(d, {
        id: key, z: nextZ(d), type: 'photo', x: item.x, y: item.y, rot: tiltFor(d.elements.length),
        w: item.w, h, imageId: image.id, url: image.url,
      }));
      setPending((list) => list.filter((p) => p.key !== key));
      onInserted?.(key);
    } catch (e) {
      if (!alive.current) return;
      const message = e instanceof ApiError ? e.message : '사진을 올리지 못했어요';
      if (e instanceof ApiError && e.code === 'STORAGE_DISABLED') setDisabled(true);
      setPending((list) => list.map((p) => (p.key === key ? { ...p, status: 'failed', message } : p)));
    }
  }, [clubId, apply, onInserted]);

  const pick = useCallback(async () => {
    if (disabled) return;
    // 웹은 파일 선택기라 권한 프롬프트가 없다.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        notify('사진을 붙이려면 사진 보관함 접근을 허용해 주세요.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_OPTIONS, allowsMultipleSelection: false, selectionLimit: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const w = DEFAULT_PHOTO_W;
    const h = photoHeightFor(w, asset.width, asset.height);
    const jitter = (pendingRef.current.length % 3) * 24;
    const item: PendingPhoto = {
      key: newId(), asset, w, h, x: (CANVAS.w - w) / 2 + jitter, y: (CANVAS.h - h) / 2 + jitter, status: 'uploading',
    };
    pendingRef.current = [...pendingRef.current, item];
    setPending(pendingRef.current);
    void upload(item.key);
  }, [disabled, upload]);

  const retry = useCallback((key: string) => {
    setPending((list) => list.map((p) => (p.key === key ? { ...p, status: 'uploading', message: undefined } : p)));
    void upload(key);
  }, [upload]);

  const remove = useCallback((key: string) => {
    setPending((list) => list.filter((p) => p.key !== key));
  }, []);

  return { pending, pick, retry, remove, disabled };
}
