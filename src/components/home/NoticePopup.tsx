import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useRouter } from '@/navigation';

import type { Banner } from '@/api/types';
import { useAppTour } from '@/store/appTour';
import { Button } from '@/components/ui';
import { hairline, radius, sans, serif, spacing, typeScale, useTheme } from '@/theme';
import { InlineMarkdownText } from './InlineMarkdownText';

const DISMISSED_KEY = 'bookey.dismissedNoticeId';

export function NoticePopup({ notice }: { notice?: Banner }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  // 앱 둘러보기와 겹치지 않게 — 둘러보기를 띄울지 확인이 끝나고 둘러보기가 꺼진 뒤에만 띄운다.
  // 메인 탭이 두 벌 떠 있을 때(프로필 사진 변경 뒤 등) 가려진 쪽은 띄우지 않는다.
  const tourBusy = useAppTour((s) => !s.checked || s.active);
  const isFocused = useIsFocused();

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
    <Modal visible={visible && !tourBusy && isFocused} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
          {/* 닫는 길은 아래 '닫기' 하나 — 위 × 까지 두면 같은 동작의 입구가 둘이다(UX 철칙 Hick). */}
          <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>NOTICE</Text>
          <Text style={[typeScale.titleSerif, { color: colors.text }]}>
            <InlineMarkdownText text={notice.title} strongStyle={styles.titleStrong} />
          </Text>
          {notice.subtitle ? (
            <Text style={[typeScale.body, styles.subtitle, { color: colors.textMuted }]}>
              <InlineMarkdownText text={notice.subtitle} strongStyle={styles.subtitleStrong} />
            </Text>
          ) : null}
          <View style={styles.actions}>
            {/* [닫기][자세히 보기] — 주요 버튼이 오른쪽. */}
            <Button label="닫기" accessibilityLabel="공지 닫기" variant="outline" onPress={dismiss} />
            {notice.linkUrl ? <Button label="자세히 보기" onPress={openLink} /> : null}
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
    borderWidth: hairline,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  subtitle: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  titleStrong: { fontFamily: serif.extraBold },
  subtitleStrong: { fontFamily: sans.semiBold },
});
