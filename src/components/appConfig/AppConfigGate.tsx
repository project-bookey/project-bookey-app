import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appConfigApi } from '@/api/endpoints';
import type { AppConfig, AppPlatform, MaintenanceNotice } from '@/api/types';
import { DotGridBackground } from '@/components/collage';
import { Button, Eyebrow, IconMeta } from '@/components/ui';
import { useAppConfigGate } from '@/store/appConfigGate';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { appPlatform, currentAppVersion, maintenanceRange, storeUrlFor } from './appRelease';

/** '나중에'를 누른 권장 버전 — 그 버전으로는 다시 묻지 않는다(더 새 버전이 나오면 다시 묻는다). */
const SKIP_VERSION_KEY = 'bookey.appConfig.skipVersion';
/** 이미 본 점검 예고('id:시작 시각') — 관리자가 시각을 고치면 다시 알린다. */
const SEEN_MAINTENANCE_KEY = 'bookey.appConfig.seenMaintenance';
/** 이번 실행에서 이미 띄운 안내 — 앱이 앞으로 올 때마다 다시 묻지 않게. */
const promptedThisRun = new Set<string>();

const QUERY_KEY = ['appConfig'] as const;

/**
 * 앱 설정 확인 — 앱을 켤 때와 다시 앞으로 올 때 서버에 묻는다(관리자 '앱 버전 · 점검').
 *
 * - 점검 중 · 강제 업데이트: 앱 전체를 덮는 화면. 닫을 수 없고, 점검은 1분마다 다시 물어 끝나면 저절로 걷힌다.
 * - 점검 예고 · 권장 업데이트: 기본 대화상자로 한 번만 알린다.
 * - 묻지 못하면(오프라인·서버 오류) 아무것도 막지 않는다 — 설정 하나 때문에 앱을 못 쓰게 하지 않는다.
 *
 * 웹은 미리보기라 묻지 않는다.
 */
export function AppConfigGate() {
  const platform = appPlatform();
  return platform ? <Gate platform={platform} /> : null;
}

function Gate({ platform }: { platform: AppPlatform }) {
  const queryClient = useQueryClient();
  const setGate = useAppConfigGate((s) => s.update);
  const version = useMemo(currentAppVersion, []);
  // 'pending' = 첫 확인 전, 'showing' = 안내를 띄운 중, 'idle' = 띄울 것이 없거나 다 닫았다.
  const [prompt, setPrompt] = useState<'pending' | 'showing' | 'idle'>('pending');

  const config = useQuery({
    queryKey: [...QUERY_KEY, platform, version],
    queryFn: () => appConfigApi.get(platform, version),
    staleTime: 60_000,
    // 점검 중이면 1분마다 다시 물어 끝나는 대로 풀어 준다.
    refetchInterval: (query) => (query.state.data?.maintenance?.active ? 60_000 : false),
  });
  const data = config.data;
  const blocked = !!data?.maintenance?.active || !!data?.updateRequired;

  // 앱이 다시 앞으로 오면 묻는다 — 1분 안에 물었으면 캐시로 충분하다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') queryClient.refetchQueries({ queryKey: QUERY_KEY, stale: true });
    });
    return () => subscription.remove();
  }, [queryClient]);

  // 점검 예고 → 권장 업데이트 순으로, 아직 안 띄운 것만 띄운다.
  useEffect(() => {
    if (!config.isFetched) return;
    if (!data || blocked) {
      setPrompt('idle');
      return;
    }
    let cancelled = false;
    (async () => {
      const queue = await duePrompts(data, platform, version);
      if (cancelled) return;
      if (queue.length === 0) {
        setPrompt('idle');
        return;
      }
      setPrompt('showing');
      for (const show of queue) await show();
      if (!cancelled) setPrompt('idle');
    })();
    return () => { cancelled = true; };
  }, [config.isFetched, data, blocked, platform, version]);

  useEffect(() => {
    setGate({ settled: config.isFetched && prompt === 'idle', blocked });
  }, [config.isFetched, prompt, blocked, setGate]);

  if (!data || !blocked) return null;
  return (
    <BlockingScreen
      config={data}
      platform={platform}
      version={version}
      checking={config.isFetching}
      onRetry={() => config.refetch()}
    />
  );
}

/** 띄울 안내를 고른다 — 이번 실행에서 띄웠거나 기기에 '봤다'고 남은 것은 뺀다. */
async function duePrompts(config: AppConfig, platform: AppPlatform, version?: string): Promise<(() => Promise<void>)[]> {
  const queue: (() => Promise<void>)[] = [];

  const upcoming = config.maintenance && !config.maintenance.active ? config.maintenance : null;
  if (upcoming) {
    const key = `${upcoming.id}:${upcoming.startsAt}`;
    const seen = await AsyncStorage.getItem(SEEN_MAINTENANCE_KEY).catch(() => null);
    if (seen !== key && !promptedThisRun.has(`maintenance:${key}`)) {
      promptedThisRun.add(`maintenance:${key}`);
      queue.push(async () => {
        await ask(upcoming.title, `${maintenanceRange(upcoming)}\n\n${upcoming.message}`, [{ text: '확인', value: 'ok' }]);
        AsyncStorage.setItem(SEEN_MAINTENANCE_KEY, key).catch(() => {});
      });
    }
  }

  const url = storeUrlFor(config, platform);
  if (config.updateRecommended && !config.updateRequired && url) {
    const latest = config.latestVersion;
    const skipped = await AsyncStorage.getItem(SKIP_VERSION_KEY).catch(() => null);
    if (skipped !== latest && !promptedThisRun.has(`update:${latest}`)) {
      promptedThisRun.add(`update:${latest}`);
      const message = [
        config.updateMessage || '업데이트하면 새로 나온 기능을 쓸 수 있어요.',
        version ? `지금 ${version} · 새 버전 ${latest}` : null,
      ].filter(Boolean).join('\n\n');
      queue.push(async () => {
        const choice = await ask('새 버전이 나왔어요', message, [
          { text: '나중에', value: 'later', style: 'cancel' },
          { text: '업데이트', value: 'update' },
        ]);
        if (choice === 'update') {
          Linking.openURL(url).catch(() => {});
        } else {
          AsyncStorage.setItem(SKIP_VERSION_KEY, latest).catch(() => {});
        }
      });
    }
  }

  return queue;
}

/** 기본 대화상자를 Promise 로 — 누른 단추의 value. 바깥을 눌러 닫으면(Android) 첫 단추로 본다. */
function ask<T extends string>(
  title: string,
  message: string,
  buttons: { text: string; value: T; style?: 'cancel' | 'default' }[],
): Promise<T> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) })),
      { cancelable: true, onDismiss: () => resolve(buttons[0].value) },
    );
  });
}

/** 앱 전체를 덮는 화면 — 점검 중이 강제 업데이트보다 먼저다(점검 중에는 업데이트해도 쓸 수 없다). */
function BlockingScreen({ config, platform, version, checking, onRetry }: {
  config: AppConfig;
  platform: AppPlatform;
  version?: string;
  checking: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const maintenance = config.maintenance?.active ? config.maintenance : null;
  const url = storeUrlFor(config, platform);

  return (
    // 닫을 수 없다 — Android 뒤로 가기도 막는다.
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <DotGridBackground />
        <ScrollView
          contentContainerStyle={[styles.body, { paddingTop: insets.top + spacing.xl * 2 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[layout.content, styles.copy]}>
            {maintenance ? <MaintenanceCopy maintenance={maintenance} /> : (
              <UpdateCopy config={config} version={version} hasStore={!!url} />
            )}
          </View>
        </ScrollView>
        {maintenance || url ? (
          <View style={[styles.dock, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={layout.content}>
              {maintenance ? (
                <Button label="다시 확인" onPress={onRetry} loading={checking} />
              ) : (
                <Button label="업데이트" onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }} />
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function MaintenanceCopy({ maintenance }: { maintenance: MaintenanceNotice }) {
  const { colors } = useTheme();
  return (
    <>
      <Eyebrow>점검 중</Eyebrow>
      <Text style={[typeScale.titleSerif, { color: colors.text }]}>{maintenance.title}</Text>
      <Text style={[typeScale.body, { color: colors.textMuted }]}>{maintenance.message}</Text>
      <IconMeta icon={Clock} accessibilityLabel={`점검 시간 ${maintenanceRange(maintenance)}`} color={colors.textMuted}>
        {maintenanceRange(maintenance)}
      </IconMeta>
      <Text style={[typeScale.caption, styles.caption, { color: colors.textFaint }]}>
        점검이 끝나면 저절로 다시 쓸 수 있어요.
      </Text>
    </>
  );
}

function UpdateCopy({ config, version, hasStore }: { config: AppConfig; version?: string; hasStore: boolean }) {
  const { colors } = useTheme();
  return (
    <>
      <Eyebrow>업데이트</Eyebrow>
      <Text style={[typeScale.titleSerif, { color: colors.text }]}>새 버전으로 업데이트해 주세요</Text>
      <Text style={[typeScale.body, { color: colors.textMuted }]}>
        {config.updateMessage || '지금 버전은 더 이상 쓸 수 없어요. 업데이트하면 기록을 그대로 이어서 쓸 수 있어요.'}
      </Text>
      {version ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          지금 {version} · 새 버전 {config.latestVersion}
        </Text>
      ) : null}
      {!hasStore ? (
        <Text style={[typeScale.body, styles.caption, { color: colors.text }]}>
          App Store에서 Bookey를 찾아 업데이트해 주세요.
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  copy: { gap: spacing.sm },
  caption: { marginTop: spacing.md },
  dock: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
