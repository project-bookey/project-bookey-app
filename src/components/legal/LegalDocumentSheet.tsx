import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LegalDocument, LegalDocumentKey } from '@/api/types';
import { useLegalDocument } from '@/legal/useLegalDocument';
import { hairline, pressedStyle, radius, spacing, typeScale, type ColorTokens } from '@/theme';

/** 끝에서 이만큼 남으면 끝까지 읽은 것으로 본다. */
const END_SLACK = 24;

type Agree = {
  /** 이미 동의한 문서 — 다시 열면 버튼이 '동의 완료'로 보인다. */
  done: boolean;
  onAgree: (doc: LegalDocument) => void;
};

/**
 * 약관·정책 원문 시트. 원문은 서버에서 받는다(문서마다 version 이 있어 동의할 때 그대로 돌려준다).
 * agree 가 있으면 끝까지 읽어야 동의 버튼이 켜진다(가입 필수 문서 — 사용자 결정으로 유지).
 * 화면보다 짧아 스크롤이 생기지 않는 문서는 열자마자 다 읽은 것으로 본다.
 * 로그인 화면은 다크 고정이라 색을 prop 으로 받는다.
 */
export function LegalDocumentSheet({ docKey, colors, agree, onClose }: {
  /** null 이면 닫혀 있다. */
  docKey: LegalDocumentKey | null;
  colors: ColorTokens;
  agree?: Agree;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={docKey != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* 문서가 바뀌면 읽음 상태를 새로 잰다 — key 로 다시 마운트한다. */}
      {docKey ? <SheetBody key={docKey} docKey={docKey} colors={colors} agree={agree} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetBody({ docKey, colors, agree, onClose }: {
  docKey: LegalDocumentKey;
  colors: ColorTokens;
  agree?: Agree;
  onClose: () => void;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const doc = useLegalDocument(docKey);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  // 스크롤은 문서를 받은 뒤에만 그린다 — 로딩 표시의 높이로 '짧은 문서'라고 잘못 재지 않게.
  const fitsOnScreen = viewport > 0 && content > 0 && content <= viewport + END_SLACK;
  const readToEnd = Boolean(agree?.done) || scrolledToEnd || fitsOnScreen;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - END_SLACK) {
      setScrolledToEnd(true);
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{doc.data?.title ?? ' '}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => pressed && pressedStyle}
        >
          <Text style={styles.close}>닫기</Text>
        </Pressable>
      </View>

      {doc.data ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setContent(height)}
        >
          <Text style={styles.body}>{doc.data.body}</Text>
          <Text style={styles.end}>— 문서의 끝 —</Text>
        </ScrollView>
      ) : (
        <View style={styles.state}>
          {doc.isError ? (
            <>
              <Text style={styles.stateText}>문서를 불러오지 못했어요.</Text>
              <Pressable
                onPress={() => doc.refetch()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.retry, pressed && pressedStyle]}
              >
                <Text style={styles.retryLabel}>다시 시도</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.textMuted} />
          )}
        </View>
      )}

      <View style={styles.footer}>
        {agree ? (
          <>
            {doc.data && !readToEnd ? (
              <Text style={styles.hint}>내용을 끝까지 내려 읽어 주세요.</Text>
            ) : null}
            <Pressable
              onPress={() => doc.data && agree.onAgree(doc.data)}
              disabled={!doc.data || !readToEnd}
              accessibilityRole="button"
              accessibilityState={{ disabled: !doc.data || !readToEnd }}
              style={({ pressed }) => [
                styles.agree,
                (!doc.data || !readToEnd) && styles.agreeDisabled,
                pressed && pressedStyle,
              ]}
            >
              <Text style={styles.agreeLabel}>{agree.done ? '동의 완료' : '읽었으며 동의합니다'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.closeButton, pressed && pressedStyle]}
          >
            <Text style={styles.closeButtonLabel}>닫기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    header: {
      minHeight: 64,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderBottomWidth: hairline,
      borderBottomColor: colors.lineStrong,
    },
    title: { ...typeScale.bodyStrong, color: colors.text, flex: 1 },
    close: { ...typeScale.label, color: colors.textMuted },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: spacing.xl },
    body: { ...typeScale.body, color: colors.textMuted, lineHeight: 25 },
    end: { ...typeScale.caption, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xl },
    state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    stateText: { ...typeScale.body, color: colors.textMuted },
    retry: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.sm,
      borderWidth: hairline,
      borderColor: colors.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryLabel: { ...typeScale.label, color: colors.text },
    footer: {
      padding: spacing.lg,
      gap: spacing.sm,
      borderTopWidth: hairline,
      borderTopColor: colors.lineStrong,
    },
    hint: { ...typeScale.caption, color: colors.textFaint, textAlign: 'center' },
    agree: {
      minHeight: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agreeDisabled: { opacity: 0.35 },
    agreeLabel: { ...typeScale.bodyStrong, color: colors.onAccent },
    closeButton: {
      minHeight: 48,
      borderRadius: radius.sm,
      borderWidth: hairline,
      borderColor: colors.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonLabel: { ...typeScale.bodyStrong, color: colors.text },
  });
}
