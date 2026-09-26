import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/store/auth';
import { APP_TOUR_STEPS, useAppTour } from '@/store/appTour';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { measureTourTarget, TourRect } from './TourTarget';

const PAD = 8;
const SHADE = 'rgba(0, 0, 0, 0.72)';

export function AppTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const userId = useAuth((state) => state.user?.id);
  const status = useAuth((state) => state.status);
  const { active, step, startIfFirstLogin, next, stop, markSeen } = useAppTour();
  const [rect, setRect] = useState<TourRect | null>(null);
  const item = APP_TOUR_STEPS[step];

  useEffect(() => {
    if (status === 'authenticated' && userId != null) void startIfFirstLogin(userId);
  }, [status, userId, startIfFirstLogin]);

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
        <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>{step + 1} / {APP_TOUR_STEPS.length}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[typeScale.body, { color: colors.textMuted }]}>{item.body}</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => void close()} style={styles.skip}>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>건너뛰기</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (finish) void close(); else next(); }}
            style={[styles.next, { backgroundColor: colors.accent }]}
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
  tooltip: { position: 'absolute', borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { ...typeScale.titleSerif, fontSize: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  skip: { padding: spacing.sm },
  next: { minWidth: 82, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
