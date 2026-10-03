import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/store/auth';
import { APP_TOUR_STEPS, useAppTour } from '@/store/appTour';
import { hairline, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { measureTourTarget, TourRect } from './TourTarget';

const PAD = 8;
const SHADE = 'rgba(0, 0, 0, 0.72)';

/** 둘러보기를 시작하지 않는 화면 — 로그인·가입·비밀번호 찾기처럼 계정 문을 지나가는 단계들. */
const TOUR_DEFERRED_ROUTES: readonly string[] = ['/login', '/password-reset', '/onboarding', '/profile-photo'];

export function AppTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const userId = useAuth((state) => state.user?.id);
  const status = useAuth((state) => state.status);
  const { active, step, startIfFirstLogin, next, prev, stop, markSeen } = useAppTour();
  const [rect, setRect] = useState<TourRect | null>(null);
  const item = APP_TOUR_STEPS[step];

  // 가입 직후 프로필 기본 정보 단계(/profile-photo)·로그인·온보딩 화면에선 둘러보기를 미룬다 — 시작하자마자
  // 첫 단계 화면(/home)으로 옮겨 가 그 단계를 덮어 버린다. 홈 등 앱 안으로 들어오면 그때 시작한다.
  useEffect(() => {
    if (status !== 'authenticated' || userId == null || TOUR_DEFERRED_ROUTES.includes(pathname)) return;
    void startIfFirstLogin(userId);
  }, [status, userId, pathname, startIfFirstLogin]);

  useEffect(() => {
    if (!active) return;
    setRect(null);
    if (pathname !== item.route) router.navigate(item.route as never);
    let cancelled = false;
    let attempts = 0;
    const locate = async () => {
      const measured = await measureTourTarget(item.target);
      if (cancelled) return;
      if (measured) {
        setRect(measured);
      } else if (attempts++ < 12) {
        setTimeout(locate, 120);
      }
    };
    const timer = setTimeout(locate, pathname === item.route ? 80 : 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, step, pathname, item, router]);

  if (!active || !rect) return null;

  const screen = Dimensions.get('window');
  const hole = {
    x: Math.max(0, rect.x - PAD),
    y: Math.max(0, rect.y - PAD),
    width: Math.min(screen.width, rect.width + PAD * 2),
    height: Math.min(screen.height, rect.height + PAD * 2),
  };
  const tooltipBelow = hole.y + hole.height + 180 < screen.height;
  const finish = step === APP_TOUR_STEPS.length - 1;
  const close = async () => {
    if (userId != null) await markSeen(userId);
    stop();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <View style={[styles.shade, { left: 0, top: 0, right: 0, height: hole.y }]} />
      <View style={[styles.shade, { left: 0, top: hole.y, width: hole.x, height: hole.height }]} />
      <View style={[styles.shade, { left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }]} />
      <View style={[styles.shade, { left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }]} />
      <View pointerEvents="none" style={[styles.focus, {
        left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderColor: colors.accent,
      }]} />
      <View style={[styles.tooltip, {
        left: spacing.lg,
        right: spacing.lg,
        top: tooltipBelow ? hole.y + hole.height + spacing.md : undefined,
        bottom: tooltipBelow ? undefined : screen.height - hole.y + spacing.md,
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.lineStrong,
      }]}>
        <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>{step + 1} / {APP_TOUR_STEPS.length}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[typeScale.body, { color: colors.textMuted }]}>{item.body}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void close()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && pressedStyle]}
          >
            <Text style={[typeScale.label, { color: colors.textMuted }]}>건너뛰기</Text>
          </Pressable>
          {/* 지난 설명을 다시 볼 길 — 앞으로만 갈 수 있는 둘러보기는 드물다(Jakob). 첫 단계엔 갈 곳이 없어 숨긴다. */}
          {step > 0 ? (
            <Pressable
              onPress={prev}
              accessibilityRole="button"
              style={({ pressed }) => [styles.prev, { borderColor: colors.lineStrong }, pressed && pressedStyle]}
            >
              <Text style={[typeScale.label, { color: colors.text }]}>이전</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => { if (finish) void close(); else next(); }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.next, { backgroundColor: colors.accent }, pressed && pressedStyle]}
          >
            <Text style={[typeScale.label, { color: colors.onAccent }]}>{finish ? '마치기' : '다음'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 9999, elevation: 9999 },
  shade: { position: 'absolute', backgroundColor: SHADE },
  focus: { position: 'absolute', borderWidth: 2, borderRadius: radius.lg },
  tooltip: { position: 'absolute', borderWidth: hairline, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  // 건너뛰기는 왼쪽 끝으로 — 이전·다음 짝과 떨어뜨려 실수로 둘러보기를 끝내지 않게.
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, marginRight: 'auto' },
  prev: {
    minWidth: 64,
    minHeight: 44,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: { minWidth: 82, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
