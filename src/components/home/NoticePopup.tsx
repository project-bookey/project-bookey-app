import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Banner } from '@/api/types';
import { radius, spacing, typeScale, useTheme } from '@/theme';

const DISMISSED_KEY = 'bookey.dismissedNoticeId';

export function NoticePopup({ notice }: { notice?: Banner }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!notice) return undefined;

    AsyncStorage.getItem(DISMISSED_KEY).then((dismissedId) => {
      if (!cancelled && dismissedId !== String(notice.id)) setVisible(true);
    }).catch(() => {
      if (!cancelled) setVisible(true);
    });

    return () => { cancelled = true; };
  }, [notice]);

  if (!notice) return null;

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISSED_KEY, String(notice.id)).catch(() => {});
  };

  const openLink = () => {
    if (!notice.linkUrl) return;
    dismiss();
    if (/^https?:\/\//.test(notice.linkUrl)) {
      Linking.openURL(notice.linkUrl).catch(() => {});
    } else {
      router.push(notice.linkUrl as never);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
          <View style={styles.header}>
            <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>NOTICE</Text>
            <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="공지 닫기" hitSlop={10}>
              <Text style={[styles.close, { color: colors.textFaint }]}>×</Text>
            </Pressable>
          </View>
          <Text style={[typeScale.titleSerif, { color: colors.text }]}>{notice.title}</Text>
          {notice.subtitle ? (
            <Text style={[typeScale.body, styles.subtitle, { color: colors.textMuted }]}>{notice.subtitle}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={dismiss} style={[styles.button, { borderColor: colors.lineStrong }]}>
              <Text style={[typeScale.label, { color: colors.textMuted }]}>닫기</Text>
            </Pressable>
            {notice.linkUrl ? (
              <Pressable onPress={openLink} style={[styles.button, { backgroundColor: colors.accent }]}>
                <Text style={[typeScale.label, { color: colors.onAccent }]}>자세히 보기</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: 28, lineHeight: 28 },
  subtitle: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  button: { minWidth: 64, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
