# 도서 상세 진척도 직접 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-09-01-progress-edit-design.md`)대로 도서 상세 '내 진척' 카드에서 진행 바 드래그 + 큰 숫자 탭 입력으로 현재 페이지를 수정할 수 있게 한다.

**Architecture:** `app/book/[id].tsx`의 진척 숫자+바 블록을 화면 로컬 컴포넌트 `ProgressEditor`로 묶는다. 드래그는 PanResponder(터치 시작 locationX + dx, onLayout 너비)로 쪽수를 환산하고, 숫자는 탭 시 같은 자리 TextInput으로 전환. 저장은 기존 `libraryApi.updateProgress` — 응답(갱신된 ReadingRecord)을 `setQueryData`로 즉시 캐시 반영해 깜빡임을 막는다.

**Tech Stack:** Expo(RN) + TypeScript strict + react-query. 새 의존성 없음, API 변경 없음.

## Global Constraints

- **커밋 규칙**: AI 어트리뷰션 금지, 첫 줄 "신규:"/"수정:" 접두 + 한국어 요약 (CLAUDE.md + 커밋 스타일).
- 새 토큰만 사용 — 색 `accent`/`line`/`warn`, 서체 `sans.extraBold`(숫자). 외부 슬라이더 라이브러리 금지.
- 클램프 0~totalPages · `totalPages ≤ 0`이면 드래그 비활성(표시 전용), 숫자 입력은 상한 없이 허용.
- 실패 시 서버 값 복원 + warn 캡션 "처리하지 못했어요 · 다시 시도".
- 검증 게이트: `npm run typecheck` exit 0. 테스트 스위트 없음 — 추가하지 않는다.

---

### Task 1: ProgressEditor 컴포넌트 + 화면 연결

**Files:**
- Modify: `app/book/[id].tsx` — import 2곳, 진척 카드의 숫자+바 블록(현재 108~124행) 교체, `ProgressEditor` 컴포넌트 추가(KV 함수 위), styles 교체·추가

**Interfaces:**
- Consumes: `libraryApi.updateProgress(recordId, currentPage)` (기존), `percent()` (기존 유틸), 쿼리 키 `['library','record',rid]` · `['library']` · `['review','preview',rid]`
- Produces: `ProgressEditor({ rid: number; progress: NonNullable<ReadingRecord['progress']>; colors: ColorTokens })` — 화면 로컬, export 없음

- [ ] **Step 1: import 수정**

`react` import에 `useRef` 추가, `react-native` import에 `PanResponder` 추가, 타입 import에 `ReadingRecord` 추가:

```tsx
import { useRef, useState } from 'react';
import {
  Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
// ...
import type { BookDetail, BookSummary, ReadingRecord, ReadingStatus, VerificationLevel } from '@/api/types';
```

- [ ] **Step 2: 진척 카드의 숫자+바 블록 교체**

`BookDetailScreen` 안 `<View style={styles.progressNumbers}>…</View>`와 `<View style={[styles.track, …]}>…</View>` 두 블록(108~124행)을 한 줄로 교체:

```tsx
            <ProgressEditor rid={rid!} progress={progress} colors={colors} />
```

- [ ] **Step 3: ProgressEditor 컴포넌트 추가**

`KV` 함수 정의 바로 위에 추가:

```tsx
/** 내 진척 수정기 — 큰 숫자 탭(정밀 입력) + 진행 바 드래그/탭(대략 조절)으로 현재 페이지를 고친다. */
function ProgressEditor({ rid, progress, colors }: {
  rid: number;
  progress: NonNullable<ReadingRecord['progress']>;
  colors: ColorTokens;
}) {
  const queryClient = useQueryClient();
  const total = progress.totalPages ?? 0;
  const serverPage = progress.currentPage ?? 0;

  // 드래그·저장 중 로컬 값 — null이면 서버 값 표시. ref는 PanResponder 핸들러(최초 렌더 클로저)용.
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const setDraftBoth = (v: number | null) => { draftRef.current = v; setDraft(v); };

  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [text, setText] = useState('');

  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const totalRef = useRef(total);
  totalRef.current = total;

  const save = useMutation({
    mutationFn: (page: number) => libraryApi.updateProgress(rid, page),
    onSuccess: (updated) => {
      // 응답이 갱신된 기록 전체 — 바로 캐시에 넣어 재조회 사이 깜빡임을 막는다
      queryClient.setQueryData(['library', 'record', rid], updated);
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'preview', rid] });
      setDraftBoth(null);
    },
    onError: () => setDraftBoth(null),
  });

  const commit = (page: number | null) => {
    if (page == null || page === serverPage) { setDraftBoth(null); return; }
    setDraftBoth(page);
    save.mutate(page);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const pageAtX = (x: number) => {
    if (widthRef.current <= 0 || totalRef.current <= 0) return null;
    const ratio = Math.min(1, Math.max(0, x / widthRef.current));
    return Math.round(ratio * totalRef.current);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => totalRef.current > 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      startXRef.current = evt.nativeEvent.locationX;
      setDragging(true);
      setDraftBoth(pageAtX(startXRef.current));
    },
    onPanResponderMove: (_evt, gesture) => {
      setDraftBoth(pageAtX(startXRef.current + gesture.dx));
    },
    onPanResponderRelease: () => {
      setDragging(false);
      commitRef.current(draftRef.current);
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      setDraftBoth(null);
    },
  })).current;

  const page = draft ?? serverPage;
  const ratio = total > 0
    ? Math.min(1, Math.max(0, page / total))
    : Math.min(1, Math.max(0, progress.completionRate ?? 0));

  const startEdit = () => {
    editingRef.current = true;
    setEditing(true);
    setText(String(page));
  };
  // onSubmitEditing과 onBlur가 연달아 와도 ref 가드로 한 번만 저장한다
  const confirmEdit = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const parsed = Number.parseInt(text, 10);
    if (!Number.isFinite(parsed)) return;
    commit(Math.max(0, total > 0 ? Math.min(parsed, total) : parsed));
  };

  return (
    <>
      <View style={styles.progressNumbers}>
        {editing ? (
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirmEdit}
            onBlur={confirmEdit}
            accessibilityLabel="현재 페이지 입력"
            style={[styles.bigNumber, styles.bigNumberInput, {
              fontFamily: sans.extraBold, color: colors.text, borderBottomColor: colors.accent,
            }]}
          />
        ) : (
          <Pressable
            onPress={startEdit}
            accessibilityRole="button"
            accessibilityLabel="현재 페이지 수정"
            hitSlop={8}
          >
            <Text style={[styles.bigNumber, { fontFamily: sans.extraBold, color: colors.text }]}>{page}</Text>
          </Pressable>
        )}
        <Text style={[typeScale.body, { color: colors.textFaint }]}>
          {total > 0 ? ` / ${total}쪽` : '쪽'}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textMuted, marginLeft: 'auto' }]}>
          {percent(ratio)}
        </Text>
      </View>

      <View
        {...pan.panHandlers}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        accessibilityRole="adjustable"
        accessibilityLabel="진척도 조절"
        accessibilityValue={{ min: 0, max: total, now: page }}
        style={styles.trackTouch}
      >
        <View pointerEvents="none" style={[styles.track, dragging && styles.trackActive, { backgroundColor: colors.line }]}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
        {dragging ? (
          <View pointerEvents="none" style={[styles.thumb, { left: `${ratio * 100}%`, backgroundColor: colors.accent }]} />
        ) : null}
      </View>

      {save.isError && !save.isPending ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>처리하지 못했어요 · 다시 시도</Text>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: styles 교체·추가**

`track`·`fill`을 바꾸고 `bigNumberInput`·`trackTouch`·`trackActive`·`thumb`를 추가:

```tsx
  bigNumberInput: { padding: 0, minWidth: 56, borderBottomWidth: 1 },
  track: { height: 4, borderRadius: radius.none, overflow: 'hidden' },
  trackTouch: { height: 32, justifyContent: 'center' },
  trackActive: { height: 8 },
  fill: { height: '100%' },
  thumb: { position: 'absolute', top: '50%', width: 4, height: 20, marginTop: -10, marginLeft: -2 },
```

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: exit 0, 출력 없음

- [ ] **Step 6: Commit**

```bash
git add app/book/[id].tsx docs/superpowers/plans/2026-09-01-progress-edit.md
git commit -m "신규: 도서 상세 진척도 바 드래그·숫자 탭으로 직접 수정"
```

---

### Task 2: 웹 육안 검증

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1 결과 화면, 백엔드(`localhost:8080`) + `npm run web`(`localhost:8081`)

- [ ] **Step 1: 백엔드·웹 기동 후 도서 상세 진입** (record 있는 책, 예: 미드나잇 라이브러리)

- [ ] **Step 2: 스펙 검증 체크리스트**

- 바 탭 → 숫자·%·바가 그 위치로 이동, 손 떼면 저장(새로고침 후 유지)
- 바 드래그 → 드래그 중 바 두꺼워지고 썸 마커 표시, 숫자 실시간 갱신
- 숫자 탭 → 입력창 전환(전체 선택), 확정 시 저장 · 숫자 아님/빈 값이면 원복만
- totalPages 초과 입력 → totalPages로 클램프
- 백엔드 중지 후 저장 시도 → 이전 값 복원 + warn 캡션
- 다크/라이트 모두 확인
