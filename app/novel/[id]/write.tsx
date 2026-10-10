import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { ApiError } from '@/api/client';
import { novelApi } from '@/api/endpoints';
import type { NovelDraft, NovelDetail, NovelWrite } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { confirmAsync, notify } from '@/components/club';
import { KeyboardArea, KeyboardDock } from '@/components/keyboard';
import { Button, EmptyState, Field, Loading, TextLink } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

export default function NovelWriteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['novels', Number(id)], queryFn: () => novelApi.get(Number(id)), refetchInterval: 30000 });
  const draft = useQuery({ queryKey: ['novels', Number(id), 'draft'], queryFn: () => novelApi.draft(Number(id)), enabled: query.data?.canWrite === true, staleTime: Infinity });
  const session = useRef<{ detail: NovelDetail; draft: NovelDraft } | null>(null);
  if (!session.current && query.data?.canWrite && draft.data) session.current = { detail: query.data, draft: draft.data };
  const writable = query.data?.canWrite === true && query.data.turnNumber === session.current?.draft.turnNumber;
  return <PaperScreen><Stack.Screen options={{ gestureEnabled: false }} />{session.current ? <NovelEditor id={Number(id)} initial={session.current.draft} novelTitle={session.current.detail.novel.title} chapterNumber={session.current.detail.novel.chapterCount + 1} writable={writable} /> : <><SubHeader category="집필" />{query.isLoading || query.data?.canWrite && draft.isLoading ? <Loading /> : <EmptyState title={query.data && !query.data.canWrite ? '지금은 집필 차례가 아니에요' : '원고를 불러오지 못했어요'} description={(query.error ?? draft.error) instanceof ApiError ? ((query.error ?? draft.error) as ApiError).message : undefined} action={<Button label="다시 확인" variant="outline" onPress={() => { void query.refetch(); void draft.refetch(); }} />} />}</>}</PaperScreen>;
}

function NovelEditor({ id, initial, novelTitle, chapterNumber, writable }: {
  id: number; initial: { title: string; body: string; turnNumber: number; savedAt?: string }; novelTitle: string; chapterNumber: number; writable: boolean;
}) {
  const router = useRouter(); const navigation = useNavigation(); const cache = useQueryClient(); const { colors } = useTheme();
  const [title, setTitle] = useState(initial.title); const [body, setBody] = useState(initial.body);
  const [ready, setReady] = useState(false); const [status, setStatus] = useState('원고를 불러오고 있어요.');
  const [error, setError] = useState<string | null>(null); const [leaving, setLeaving] = useState(false);
  const key = `bookey.novel.draft.${id}.${initial.turnNumber}`;
  const latest = useRef<NovelWrite>({ turnNumber: initial.turnNumber, title, body });
  const saved = useRef(JSON.stringify(latest.current)); const queue = useRef<Promise<unknown>>(Promise.resolve());
  const published = useRef(false); const submitting = useRef(false); const alive = useRef(true);
  const localQueue = useRef<Promise<unknown>>(Promise.resolve());
  const previous = useQuery({ queryKey: ['novels', id, 'chapter', chapterNumber - 1], queryFn: () => novelApi.chapter(id, chapterNumber - 1), enabled: chapterNumber > 1 });
  const [showPrevious, setShowPrevious] = useState(false);
  useEffect(() => {
    alive.current = true;
    let canceled = false;
    void AsyncStorage.getItem(key).then(value => {
      if (canceled) return;
      try {
        const local = value ? JSON.parse(value) as { title?: unknown; body?: unknown; savedAt?: unknown } : null;
        if (local && typeof local.title === 'string' && typeof local.body === 'string' && typeof local.savedAt === 'number'
            && local.savedAt > (initial.savedAt ? new Date(initial.savedAt).getTime() : 0)) {
          const restored = { turnNumber: initial.turnNumber, title: local.title, body: local.body };
          latest.current = restored; setTitle(local.title); setBody(local.body);
        }
      } catch { /* 읽을 수 없는 기기 사본 대신 서버 원고를 쓴다. */ }
      setReady(true); setStatus('임시 저장됨');
    }).catch(() => { if (!canceled) { setReady(true); setStatus('서버 원고를 불러왔어요.'); } });
    return () => { canceled = true; alive.current = false; };
  }, [key, initial.savedAt, initial.turnNumber]);
  const persist = useCallback(async () => {
    const snapshot = { ...latest.current }; const signature = JSON.stringify(snapshot);
    if (published.current) return;
    if (!writable) { await localQueue.current; return; }
    const work = queue.current.catch(() => {}).then(async () => {
      if (published.current || signature === saved.current) return;
      if (alive.current) setStatus('저장 중…');
      await novelApi.saveDraft(id, snapshot);
      saved.current = signature;
      if (alive.current) { setStatus('임시 저장됨'); setError(null); }
    });
    queue.current = work;
    try { await work; }
    catch (e) {
      if (alive.current) { setStatus('저장하지 못했어요.'); setError(e instanceof ApiError ? e.message : '기기에 원고를 보관했어요. 연결을 확인하고 다시 저장해 주세요.'); }
      throw e;
    }
  }, [id, writable]);
  const edit = (nextTitle: string, nextBody: string) => {
    setTitle(nextTitle); setBody(nextBody);
    const snapshot = { turnNumber: initial.turnNumber, title: nextTitle, body: nextBody };
    latest.current = snapshot; setStatus('저장 대기 중…');
    localQueue.current = localQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify({ ...snapshot, savedAt: Date.now() })));
  };
  useEffect(() => {
    if (!ready || submitting.current) return;
    const timer = setTimeout(() => { void persist().catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [title, body, ready, persist]);
  usePreventRemove(ready && !leaving, ({ data }) => {
    if (published.current) { navigation.dispatch(data.action); return; }
    void localQueue.current.then(() => persist()).then(() => { navigation.dispatch(data.action); }).catch(() => notify('원고를 저장하지 못해 이 화면에 남았어요. 다시 저장해 주세요.'));
  });
  const publish = useMutation({
    mutationFn: async () => {
      submitting.current = true;
      try {
        await queue.current.catch(() => {}); await persist();
        const result = await novelApi.publish(id, { ...latest.current });
        published.current = true; await localQueue.current.catch(() => {});
        await AsyncStorage.removeItem(key).catch(() => {});
        return result;
      } finally { submitting.current = false; }
    },
    onSuccess: result => { setLeaving(true); void cache.invalidateQueries({ queryKey: ['novels'] }); router.replace(`/novel/${id}/chapter/${result.chapterNumber}`); },
    onError: e => setError(e instanceof ApiError ? e.message : '회차를 올리지 못했어요. 원고를 확인하고 다시 시도해 주세요.'),
  });
  return <><SubHeader category={`${chapterNumber}화 집필`} /><KeyboardArea><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={[typeScale.titleSerif, { color: colors.text }]}>{novelTitle}</Text>
    {chapterNumber > 1 ? <><TextLink label={showPrevious ? '이전 이야기 접기' : '이전 이야기 확인'} kind="action" onPress={() => setShowPrevious(v => !v)} />{showPrevious ? previous.data ? <View style={[styles.previous, { borderColor: colors.line }]}><Text style={[typeScale.bodyStrong, { color: colors.text }]}>{previous.data.title}</Text><Text selectable style={[typeScale.quote, { color: colors.textMuted }]}>{previous.data.body}</Text></View> : <Text style={[typeScale.caption, { color: colors.textMuted }]}>{previous.isLoading ? '이전 이야기를 불러오고 있어요.' : '이전 이야기를 불러오지 못했어요.'}</Text> : null}</> : null}
    {!writable ? <Text style={[typeScale.caption, { color: colors.danger }]}>집필 차례가 종료됐어요. 작성한 원고는 기기에 보관했으며 본문을 길게 눌러 복사할 수 있어요.</Text> : null}
    <Field label="회차 제목" placeholder="이번 이야기의 제목" value={title} onChangeText={v => edit(v, body)} maxLength={120} editable={ready && writable && !publish.isPending} />
    <Field label="본문" placeholder="여기서 이야기를 이어 써 주세요." value={body} onChangeText={v => edit(title, v)} multiline maxLength={20000} textAlignVertical="top" style={styles.editor} editable={ready && writable && !publish.isPending} />
    <Text style={[typeScale.caption, { color: colors.textMuted }]}>{body.length.toLocaleString()} / 20,000자 · {status}</Text>
  </ScrollView><KeyboardDock style={[styles.dock, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>{error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}<View style={styles.buttons}><Button label="임시 저장" variant="outline" style={styles.flex} disabled={!ready || !writable || publish.isPending} onPress={() => { void persist().catch(() => {}); }} /><Button label="회차 올리기" style={styles.flex} loading={publish.isPending} disabled={!ready || !writable || !title.trim() || !body.trim()} onPress={async () => { if (await confirmAsync('올린 회차는 수정할 수 없어요. 릴레이노벨은 다음 사람에게 차례가 넘어가요.', '올리기', '회차를 올릴까요?')) publish.mutate(); }} /></View></KeyboardDock></KeyboardArea></>;
}
const styles = StyleSheet.create({ content: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }, editor: { minHeight: 320 }, previous: { borderWidth: hairline, padding: spacing.md, gap: spacing.md }, dock: { ...layout.content, borderTopWidth: hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }, buttons: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 } });
