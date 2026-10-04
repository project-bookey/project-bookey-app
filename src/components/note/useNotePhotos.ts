import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
import { IMAGE_PICKER_OPTIONS, prepareImage } from '@/api/upload';
import { notify } from '@/components/club';
import { tiltFor } from '@/theme/tokens';
import {
  CANVAS, DEFAULT_PHOTO_W, addElement, newId, nextZ, photoHeightFor, type CanvasSize, type NoteDoc,
} from './noteDoc';
import type { AnchorFn } from './useNoteInserts';
import type { ApplyOptions } from './useNoteEditor';

/**
 * 사진 올리기 함수 — prepareImage 가 만든 multipart 폼을 받아 서버가 준 사진을 돌려준다.
 * 모임 노트는 `meetingNoteApi` 의 사진 올리기.
 */
export type NoteImageUpload = (form: FormData) => Promise<{
  id: number;
  url: string;
  width?: number | null;
  height?: number | null;
}>;

/** 문서 변경 함수 — 편집기의 apply 와 같은 모양. */
type Apply = (mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => void;

/** 업로드 중이거나 실패한 사진 — 문서 밖에 산다. 성공해야 photo 요소가 된다(반쯤 올라간 사진이 문서에 섞이지 않게). */
export type PendingPhoto = {
  key: string;
  asset: ImagePicker.ImagePickerAsset;
  /** 고를 때 열려 있던 페이지(여러 페이지 노트). 화면은 지금 페이지 것만 그린다. 한 페이지 편집이면 undefined. */
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: 'uploading' | 'failed';
  message?: string;
};

/**
 * 서버 사진 저장소가 꺼져 있을 때의 오류 코드(503). 앱 문제가 아니라 서버 설정이라 다시 올려도 결과가 같다 —
 * 이때만 사진 도구를 잠근다(독후감 사진 업로드 usePhotoUploads 와 같은 처리).
 */
const STORAGE_DISABLED = 'STORAGE_DISABLED';
/** 서버가 이유를 주지 않았을 때의 한 줄. */
const UPLOAD_NOTICE = '사진을 올리지 못했어요';

/**
 * 사진 고르기 → 줄여서 올리기 → 요소로 넣기. 업로드 응답의 id·url 이 문서에 들어가야 서버가 그 사진을 글에 붙인다.
 * 올리는 함수는 밖에서 받는다(upload) — 이 훅은 어느 API 인지 모른다.
 * 서버 저장소가 꺼져 있으면(STORAGE_DISABLED) 이 세션 동안 사진 도구를 잠근다(disabled).
 *
 * 여러 페이지 노트: pageId(지금 페이지)와 applyTo(페이지 id 로 바꾸기)를 주면, 올라가는 사이 페이지를 넘겨도
 * 사진은 고를 때의 페이지에 붙는다. 없으면 완료 시점의 apply(지금 문서)에 붙인다.
 * canvas 는 문서의 논리 크기(가운데 자리 계산용), getAnchor 는 줌 무대에서 지금 보이는 가운데.
 * limit 을 주면 붙인 장수(count)+올라가는 장수가 max 에 닿았을 때 더 고르지 않는다.
 */
export function useNotePhotos({ upload, apply, applyTo, pageId, canvas = CANVAS, getAnchor, limit, onInserted }: {
  upload: NoteImageUpload;
  apply: Apply;
  applyTo?: (pageId: string, mutate: (d: NoteDoc) => NoteDoc) => void;
  pageId?: string;
  canvas?: CanvasSize;
  getAnchor?: AnchorFn;
  limit?: { max: number; count: () => number };
  onInserted?: (id: string) => void;
}) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [disabled, setDisabled] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const latest = useRef({ upload, apply, applyTo, pageId, canvas, getAnchor, limit, onInserted });
  latest.current = { upload, apply, applyTo, pageId, canvas, getAnchor, limit, onInserted };
  const alive = useRef(true);
  useEffect(() => {
    // StrictMode 는 마운트 직후 한 번 정리했다가 다시 실행한다 — 깃발을 다시 세운다.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const send = useCallback(async (key: string) => {
    const item = pendingRef.current.find((p) => p.key === key);
    if (!item) return;
    try {
      const form = await prepareImage(item.asset);
      const image = await latest.current.upload(form);
      if (!alive.current) return;
      // 이미 지운 자리면(업로드 중 '지우기') 붙이지 않는다.
      if (!pendingRef.current.some((p) => p.key === key)) return;
      const h = photoHeightFor(item.w, image.width ?? item.asset.width, image.height ?? item.asset.height);
      const mutate = (d: NoteDoc): NoteDoc => addElement(d, {
        id: key, z: nextZ(d), type: 'photo', x: item.x, y: item.y, rot: tiltFor(d.elements.length),
        w: item.w, h, imageId: image.id, url: image.url,
      });
      const { applyTo: to, apply: run } = latest.current;
      if (item.pageId !== undefined && to) to(item.pageId, mutate);
      else run(mutate);
      pendingRef.current = pendingRef.current.filter((p) => p.key !== key);
      setPending(pendingRef.current);
      latest.current.onInserted?.(key);
    } catch (e) {
      if (!alive.current) return;
      const message = e instanceof ApiError ? e.message : UPLOAD_NOTICE;
      if (e instanceof ApiError && e.code === STORAGE_DISABLED) setDisabled(true);
      setPending((list) => list.map((p) => (p.key === key ? { ...p, status: 'failed', message } : p)));
    }
  }, []);

  const pick = useCallback(async () => {
    if (disabled) return;
    const lim = latest.current.limit;
    if (lim && lim.count() + pendingRef.current.length >= lim.max) {
      notify(`사진은 ${lim.max}장까지 붙일 수 있어요.`);
      return;
    }
    // 웹은 파일 선택기라 권한 프롬프트가 없다.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        notify('사진을 붙이려면 설정에서 사진 접근을 허용해 주세요.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_OPTIONS, allowsMultipleSelection: false, selectionLimit: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset || !alive.current) return;
    const { canvas: c, getAnchor: anchorFn, pageId: page } = latest.current;
    const w = Math.min(DEFAULT_PHOTO_W, c.w);
    const h = photoHeightFor(w, asset.width, asset.height);
    const [cx, cy] = anchorFn?.() ?? [c.w / 2, c.h / 2];
    const jitter = (pendingRef.current.length % 3) * 24;
    const item: PendingPhoto = {
      key: newId(), asset, pageId: page, w, h, x: cx - w / 2 + jitter, y: cy - h / 2 + jitter, status: 'uploading',
    };
    pendingRef.current = [...pendingRef.current, item];
    setPending(pendingRef.current);
    void send(item.key);
  }, [disabled, send]);

  const retry = useCallback((key: string) => {
    pendingRef.current = pendingRef.current.map((p) => (p.key === key ? { ...p, status: 'uploading', message: undefined } : p));
    setPending(pendingRef.current);
    void send(key);
  }, [send]);

  const remove = useCallback((key: string) => {
    pendingRef.current = pendingRef.current.filter((p) => p.key !== key);
    setPending(pendingRef.current);
  }, []);

  /** 페이지를 지울 때 — 그 페이지에 올라가던 사진 자리도 거둔다. */
  const removeForPage = useCallback((page: string) => {
    pendingRef.current = pendingRef.current.filter((p) => p.pageId !== page);
    setPending(pendingRef.current);
  }, []);

  return {
    pending,
    pick,
    retry,
    remove,
    removeForPage,
    disabled,
    /** 올라가는 중인 사진이 하나라도 있으면 참 — 올리기(게시) 버튼을 잠그는 데 쓴다. */
    busy: pending.some((p) => p.status === 'uploading'),
  };
}
