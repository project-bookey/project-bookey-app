import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import { clubNoteApi } from '@/api/endpoints';
import type { ClubNotePage, ClubNotePageSummary } from '@/api/types';
import { confirmAsync } from '@/components/club';
import { emptyDoc, parseDoc, type NoteDoc } from './noteDoc';
import { PAPER_TOUCH_KEY, mergeDocs } from './noteMerge';
import { clubNoteKeys, useNotePageQuery } from './queries';
import { useNoteEditor } from './useNoteEditor';

/** 마지막 변경 뒤 이만큼 조용하면 저장한다. 서버는 1분 60회까지 받으니 넉넉하다. */
const AUTOSAVE_MS = 1500;
const TITLE_TOUCH_KEY = 'title';

/**
 * 페이지 하나의 서버 동기화 — 불러오기, 자동 저장(디바운스), 409 병합.
 *
 * 저장은 문서 전체 덮어쓰기 + version. 서버가 409 를 주면 최신을 다시 받아 요소 id 기준으로 병합하고 한 번 더 저장한다.
 * 그래도 409 면 사용자에게 서버 내용으로 다시 불러올지 묻는다. 병합 결과는 되돌리기 한 건으로 남는다.
 * 플러시 시점: 화면을 떠날 때(useFocusEffect 정리), 앱이 배경으로 갈 때, 페이지를 넘기기 전(saveNow), 언마운트.
 * 저장 도중 페이지가 바뀌어도 응답은 그 페이지의 캐시에만 반영하고 현재 페이지 상태는 건드리지 않는다.
 */
export function useNotePage({ clubId, pageId }: { clubId: number; pageId: number | null }) {
  const qc = useQueryClient();
  const editor = useNoteEditor(emptyDoc());
  const query = useNotePageQuery(clubId, pageId);

  const [title, setTitleState] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** 서버와 마지막으로 맞춘 문서(병합의 base)·버전·저장된 문서 참조. 전부 "현재 페이지" 것이다. */
  const baseRef = useRef<NoteDoc>(editor.docRef.current);
  const savedDocRef = useRef<NoteDoc | null>(editor.docRef.current);
  const versionRef = useRef(0);
  const titleRef = useRef<string | null>(null);
  const pageIdRef = useRef<number | null>(pageId);
  pageIdRef.current = pageId;
  const loadedPageRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const isDirty = () => editor.docRef.current !== savedDocRef.current || editor.touchedRef.current.has(TITLE_TOUCH_KEY);

  const adopt = useCallback((page: ClubNotePage, mode: 'reset' | 'replace') => {
    const doc = parseDoc(page.document);
    if (mode === 'reset') editor.reset(doc);
    else editor.replace(doc);
    baseRef.current = doc;
    savedDocRef.current = doc;
    versionRef.current = page.version;
    titleRef.current = page.title ?? null;
    setTitleState(page.title ?? null);
    editor.clearTouched();
    setDirty(false);
    setSaveError(null);
  }, [editor]);

  // 서버 데이터 도착 — 페이지가 바뀌었으면 통째로 새로, 같은 페이지면 로컬 변경이 없을 때만 받아들인다.
  useEffect(() => {
    const page = query.data;
    if (!page || pageId === null || page.id !== pageId) return;
    if (loadedPageRef.current !== pageId) {
      loadedPageRef.current = pageId;
      adopt(page, 'reset');
    } else if (!isDirty() && page.version !== versionRef.current) {
      adopt(page, 'replace');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, pageId, adopt]);

  /** 저장 응답 반영 — 캐시는 항상, 편집 상태는 아직 그 페이지를 보고 있을 때만. */
  const applyServerResult = (pid: number, doc: NoteDoc, savedTitle: string | null, res: ClubNotePageSummary) => {
    qc.setQueryData<ClubNotePage>(clubNoteKeys.page(clubId, pid), (old) => old
      ? { ...old, version: res.version, updatedAt: res.updatedAt, updatedBy: res.updatedBy, elementCount: res.elementCount, title: res.title, document: doc }
      : old);
    void qc.invalidateQueries({ queryKey: clubNoteKeys.list(clubId) });
    if (pageIdRef.current !== pid) return;
    baseRef.current = doc;
    savedDocRef.current = doc;
    versionRef.current = res.version;
    titleRef.current = savedTitle;
    editor.touchedRef.current.delete(TITLE_TOUCH_KEY);
    editor.clearTouched();
  };

  const schedule = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, AUTOSAVE_MS);
  };

  /** 409 — 최신을 받아 내 변경을 얹고 한 번 더 저장한다. 또 409 면 사용자에게 묻는다. */
  const resolveConflict = async (pid: number) => {
    const latest = await clubNoteApi.page(clubId, pid);
    if (pageIdRef.current !== pid) return;
    const theirs = parseDoc(latest.document);
    const touched = editor.touchedRef.current;
    const merged = mergeDocs(baseRef.current, editor.docRef.current, theirs, touched);
    const mergedTitle = touched.has(TITLE_TOUCH_KEY) ? titleRef.current : (latest.title ?? null);
    editor.replace(merged, { undoable: true });
    baseRef.current = theirs;
    savedDocRef.current = null;
    versionRef.current = latest.version;
    titleRef.current = mergedTitle;
    if (alive.current) setTitleState(mergedTitle);
    try {
      const res = await clubNoteApi.savePage(clubId, pid, { version: latest.version, title: mergedTitle ?? undefined, document: merged });
      applyServerResult(pid, merged, mergedTitle, res);
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'CLUB_NOTE_CONFLICT')) throw e;
      const reload = await confirmAsync(
        '다른 멤버가 방금 이 페이지를 고쳤어요. 서버 내용으로 다시 불러올까요? 내 마지막 변경은 사라져요.',
        '다시 불러오기',
      );
      if (reload && pageIdRef.current === pid) {
        const fresh = await clubNoteApi.page(clubId, pid);
        adopt(fresh, 'reset');
        qc.setQueryData(clubNoteKeys.page(clubId, pid), fresh);
      }
    }
  };

  const saveNow = useCallback(async (): Promise<void> => {
    const pid = pageIdRef.current;
    if (pid === null || savingRef.current || !isDirty()) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    savingRef.current = true;
    if (alive.current) setSaving(true);
    const doc = editor.docRef.current;
    const currentTitle = titleRef.current;
    let failed = false;
    try {
      const res = await clubNoteApi.savePage(clubId, pid, { version: versionRef.current, title: currentTitle ?? undefined, document: doc });
      applyServerResult(pid, doc, currentTitle, res);
      if (alive.current) setSaveError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CLUB_NOTE_CONFLICT') {
        try {
          await resolveConflict(pid);
          if (alive.current) setSaveError(null);
        } catch (inner) {
          failed = true;
          if (alive.current) setSaveError(inner instanceof ApiError ? inner.message : '저장하지 못했어요');
        }
      } else {
        failed = true;
        if (alive.current) setSaveError(e instanceof ApiError ? e.message : '저장하지 못했어요');
      }
    } finally {
      savingRef.current = false;
      if (alive.current) {
        setSaving(false);
        const d = isDirty();
        setDirty(d);
        // 저장 중에 또 고쳤으면 한 번 더. 실패했으면 사용자가 '다시 시도' 를 누를 때까지 기다린다.
        if (d && !failed) schedule();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, editor]);

  // 문서가 바뀔 때마다 — dirty 표시와 자동 저장 타이머.
  useEffect(() => {
    const d = isDirty();
    setDirty(d);
    if (d) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.rev]);

  const setTitle = useCallback((next: string | null) => {
    const cleaned = next && next.trim().length > 0 ? next.trim().slice(0, 60) : null;
    titleRef.current = cleaned;
    setTitleState(cleaned);
    editor.touchedRef.current.add(TITLE_TOUCH_KEY);
    setDirty(true);
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const setPaper = useCallback((paper: NoteDoc['paper']) => {
    editor.apply((d) => (d.paper === paper ? d : { ...d, paper }));
    editor.touchedRef.current.add(PAPER_TOUCH_KEY);
  }, [editor]);

  // 화면을 떠나거나 앱이 배경으로 가면 바로 저장한다.
  useFocusEffect(useCallback(() => () => {
    void saveNow();
  }, [saveNow]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void saveNow();
    });
    return () => sub.remove();
  }, [saveNow]);
  useEffect(() => () => {
    alive.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const reload = useCallback(async () => {
    const pid = pageIdRef.current;
    if (pid === null) return;
    const fresh = await clubNoteApi.page(clubId, pid);
    if (pageIdRef.current !== pid) return;
    adopt(fresh, 'reset');
    qc.setQueryData(clubNoteKeys.page(clubId, pid), fresh);
  }, [clubId, adopt, qc]);

  return {
    editor,
    page: query.data && query.data.id === pageId ? query.data : null,
    loading: pageId !== null && (query.isLoading || loadedPageRef.current !== pageId),
    error: query.error,
    title,
    setTitle,
    setPaper,
    dirty,
    saving,
    saveError,
    saveNow,
    reload,
  };
}
