import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LegalDocumentKey, SignupConsent } from '@/api/types';
import { linkLabel } from '@/components/ui';
import { useLegalDocument } from '@/legal/useLegalDocument';
import { hairline, pressedStyle, radius, spacing, typeScale, type ColorTokens } from '@/theme';

import { LegalDocumentSheet } from './LegalDocumentSheet';

/** 가입 동의 초안 — 문서 동의는 동의한 문서의 version 을 담는다(null = 아직). */
export type ConsentDraft = {
  age: boolean;
  terms: string | null;
  privacy: string | null;
  /** [선택] 광고성 정보 수신 — 켜면 그 문서의 version. */
  marketing: string | null;
};

export const EMPTY_CONSENT: ConsentDraft = { age: false, terms: null, privacy: null, marketing: null };

/** 필수 셋(만 14세·약관·개인정보 수집·이용)을 다 채웠는지. */
export function consentComplete(draft: ConsentDraft): boolean {
  return draft.age && draft.terms != null && draft.privacy != null;
}

export function toSignupConsent(draft: ConsentDraft): SignupConsent {
  return {
    termsAgreed: draft.terms != null,
    termsVersion: draft.terms ?? undefined,
    privacyAgreed: draft.privacy != null,
    privacyVersion: draft.privacy ?? undefined,
    ageConfirmed: draft.age,
    marketingAgreed: draft.marketing != null,
    marketingVersion: draft.marketing ?? undefined,
  };
}

type Sheet = { key: LegalDocumentKey; agreeAs?: 'terms' | 'privacy' };

/**
 * 가입 동의 묶음 — 이메일 가입 폼과 소셜 가입 동의 시트가 함께 쓴다.
 * [필수] 만 14세 이상(바로 체크) · 이용약관 · 개인정보 수집·이용(끝까지 읽어야 동의 — 사용자 결정)
 * [선택] 광고성 정보 수신(바로 체크, 원문은 '보기'). 아래에 개인정보처리방침 전문 링크.
 * 제3자 제공 동의는 없다 — 지금은 제공하는 곳이 없고, 제휴 기능을 열 때 그 화면에서 따로 받는다.
 */
export function SignupConsentBox({ colors, value, onChange, disabled = false }: {
  colors: ColorTokens;
  value: ConsentDraft;
  onChange: (next: ConsentDraft) => void;
  disabled?: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // 광고 수신은 바로 체크하므로 문서 version 을 미리 받아 둔다.
  const marketingDoc = useLegalDocument('marketing');

  const toggleMarketing = () => {
    if (value.marketing != null) {
      onChange({ ...value, marketing: null });
      return;
    }
    if (marketingDoc.data) {
      onChange({ ...value, marketing: marketingDoc.data.version });
    } else {
      void marketingDoc.refetch();
    }
  };

  const check = (on: boolean) => (
    <View style={[styles.check, on && styles.checkOn]}>
      <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
    </View>
  );

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>약관 동의</Text>

      <Pressable
        onPress={() => onChange({ ...value, age: !value.age })}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.age, disabled }}
        style={({ pressed }) => [styles.row, pressed && pressedStyle]}
      >
        {check(value.age)}
        <Text style={styles.label}>[필수] 만 14세 이상입니다</Text>
      </Pressable>

      {([
        ['terms', 'terms', '[필수] 이용약관'],
        ['privacy', 'privacy-consent', '[필수] 개인정보 수집·이용'],
      ] as const).map(([field, key, label]) => (
        <Pressable
          key={field}
          onPress={() => setSheet({ key, agreeAs: field })}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label} 전문 보기`}
          accessibilityState={{ checked: value[field] != null, disabled }}
          style={({ pressed }) => [styles.row, pressed && pressedStyle]}
        >
          {check(value[field] != null)}
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.view}>{linkLabel('전문 보기')}</Text>
        </Pressable>
      ))}

      <View style={styles.row}>
        <Pressable
          onPress={toggleMarketing}
          disabled={disabled}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value.marketing != null, disabled }}
          style={({ pressed }) => [styles.rowMain, pressed && pressedStyle]}
        >
          {check(value.marketing != null)}
          <Text style={styles.label}>[선택] 광고성 정보 수신 (앱 푸시·이메일)</Text>
        </Pressable>
        <Pressable
          onPress={() => setSheet({ key: 'marketing' })}
          accessibilityRole="button"
          accessibilityLabel="광고성 정보 수신 동의 내용 보기"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={({ pressed }) => pressed && pressedStyle}
        >
          <Text style={styles.view}>{linkLabel('보기')}</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>필수 문서는 끝까지 읽어야 동의할 수 있어요.</Text>
      <Pressable
        onPress={() => setSheet({ key: 'privacy-policy' })}
        accessibilityRole="link"
        style={({ pressed }) => [styles.policy, pressed && pressedStyle]}
      >
        <Text style={styles.view}>{linkLabel('개인정보처리방침 전문')}</Text>
      </Pressable>

      <LegalDocumentSheet
        docKey={sheet?.key ?? null}
        colors={colors}
        onClose={() => setSheet(null)}
        agree={sheet?.agreeAs
          ? {
              done: value[sheet.agreeAs] != null,
              onAgree: (doc) => {
                onChange({ ...value, [sheet.agreeAs as 'terms' | 'privacy']: doc.version });
                setSheet(null);
              },
            }
          : undefined}
      />
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    box: {
      borderWidth: hairline,
      borderColor: colors.lineStrong,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    heading: { ...typeScale.label, color: colors.text, marginBottom: spacing.xs },
    row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowMain: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // 선택 상태는 잉크로 뒤집는다(디자인 규칙 — accent 는 CTA 몫).
    check: {
      width: 20,
      height: 20,
      borderRadius: radius.sm,
      borderWidth: hairline,
      borderColor: colors.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    checkMark: { color: colors.onInk, fontSize: 13, fontWeight: '700' },
    label: { ...typeScale.caption, color: colors.text, flex: 1 },
    view: { ...typeScale.caption, color: colors.textMuted },
    hint: { ...typeScale.caption, color: colors.textFaint, marginTop: spacing.xs },
    policy: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  });
}
