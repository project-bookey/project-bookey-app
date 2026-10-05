import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { onboardingApi } from '@/api/endpoints';
import type { BookSummary } from '@/api/types';
import { markOnboardingSeen } from '@/lib/onboarding';
import { useOnboarding } from '@/store/onboarding';
import Svg, { Path } from 'react-native-svg';
import { Check } from 'lucide-react-native';

import { Chip } from '@/components/collage';
import { Button } from '@/components/ui';
import { darkColors, ForceThemeMode, hairline, iconStroke, pressedStyle, radius, spacing, typeScale } from '@/theme';
import { serif } from '@/theme/tokens';

/** 온보딩 책 선택 개수 — "5권 고르기". */
const BOOK_PICK_TARGET = 5;
/** 카테고리 선택 상한. */
const CATEGORY_MAX = 5;

const FALLBACK_CATEGORIES = [
  '소설', '에세이', '시', '인문학', '역사', '과학',
  '자기계발', '경제/경영', '컴퓨터/IT', '예술', '여행', '만화',
];

/** 첫 인사 뒤에는 실제 화면을 따라가는 스팟라이트 투어가 별도로 시작된다. */
const GUIDE_STEPS: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: 'WELCOME',
    title: '만나서 반가워요',
    body: 'Bookey는 읽기로 한 책을\n끝까지 읽게 도와주는 독서 앱이에요.\n취향을 알려 주시면 바로 시작할게요.',
  },
];

/**
 * 온보딩 — 인사 → 가이드 → 선호 카테고리 → 책 5권 고르기 → 가입(본인인증)으로 이어진다.
 * 기기당 1회. 여기서 고른 것은 가입 성공 직후 서버에 반영된다(login.tsx).
 */
export default function OnboardingScreen() {
  // 다크 고정 화면 — 공용 Button·Chip 도 다크 색을 받게 감싼다.
  return (
    <ForceThemeMode mode="dark">
      <OnboardingFlow />
    </ForceThemeMode>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  /** 0..2 가이드, 3 카테고리, 4 책 고르기. */
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const { categories, bookIds, setCategories, toggleBook } = useOnboarding();

  const CATEGORY_STEP = GUIDE_STEPS.length;
  const BOOK_STEP = GUIDE_STEPS.length + 1;
  const totalSteps = GUIDE_STEPS.length + 2;
  const categoryOptions = useQuery({
    queryKey: ['onboardingCategories'],
    queryFn: onboardingApi.categories,
    enabled: step >= CATEGORY_STEP,
    staleTime: 1000 * 60 * 60,
  });
  const categoryItems = categoryOptions.data && categoryOptions.data.length > 0
    ? categoryOptions.data
    : FALLBACK_CATEGORIES;

  const goTo = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const finish = (signup: boolean) => {
    markOnboardingSeen();
    router.replace(signup ? { pathname: '/login', params: { signup: '1' } } : '/login');
  };

  const toggleCategory = (category: string) => {
    if (categories.includes(category)) {
      setCategories(categories.filter((c) => c !== category));
    } else if (categories.length < CATEGORY_MAX) {
      setCategories([...categories, category]);
    }
  };

  /** 고른 카테고리의 책을 모아 중복을 제거한다. 부족하면 전체 목록으로 채운다. */
  const books = useQuery({
    queryKey: ['onboardingBooks', categories],
    enabled: step === BOOK_STEP,
    queryFn: async () => {
      const byCategory = await Promise.all(categories.map((c) => onboardingApi.books(c, 20)));
      const merged = new Map<number, BookSummary>();
      byCategory.flat().forEach((book) => merged.set(book.id, book));
      if (merged.size < 10) {
        (await onboardingApi.books(undefined, 30)).forEach((book) => {
          if (!merged.has(book.id)) merged.set(book.id, book);
        });
      }
      return [...merged.values()];
    },
  });
  const bookItems = books.data ?? [];
  /** 시드가 적은 개발 환경에서도 막히지 않게 — 목표는 5권, 책이 모자라면 있는 만큼. */
  const requiredPicks = Math.min(BOOK_PICK_TARGET, Math.max(bookItems.length, 1));

  const canProceed =
    step === CATEGORY_STEP ? categories.length > 0
      : step === BOOK_STEP ? bookItems.length === 0 || bookIds.length >= requiredPicks
        : true;

  const ctaLabel =
    step === BOOK_STEP ? `${bookIds.length} / ${requiredPicks}권 담고 가입하기`
      : step === CATEGORY_STEP ? '다음'
        : '다음';

  const pressCta = () => {
    if (step === BOOK_STEP) {
      finish(true);
    } else {
      goTo(step + 1);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.wordmark}>bookey</Text>
        <Pressable
          onPress={() => finish(false)}
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[typeScale.monoLabel, { color: darkColors.textMuted }]}>
            건너뛰기
          </Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        {step < CATEGORY_STEP ? (
          <View style={styles.guide}>
            <View style={styles.markWrap}>
              <BookGlyph size={34} color={darkColors.accent} />
            </View>
            <Text style={[typeScale.monoEyebrow, { color: darkColors.accent }]}>
              {GUIDE_STEPS[step].eyebrow}
            </Text>
            <Text style={styles.title}>{GUIDE_STEPS[step].title}</Text>
            <Text style={styles.copy}>{GUIDE_STEPS[step].body}</Text>
          </View>
        ) : step === CATEGORY_STEP ? (
          <View style={styles.pickerStep}>
            <Text style={[typeScale.monoEyebrow, { color: darkColors.accent }]}>TASTE</Text>
            <Text style={styles.title}>어떤 책을 좋아하세요?</Text>
            <Text style={styles.copy}>고른 취향에 맞춰 광장과 추천 책을 보여 드려요. (최대 {CATEGORY_MAX}개)</Text>
            <View style={styles.categoryGrid}>
              {categoryItems.map((category) => {
                const selected = categories.includes(category);
                // 탐색 분야·문의 분류와 같은 공용 칩 — 고르면 잉크로 뒤집힌다.
                return (
                  <Chip key={category} label={category} active={selected} onPress={() => toggleCategory(category)} />
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.pickerStep}>
            <Text style={[typeScale.monoEyebrow, { color: darkColors.accent }]}>SHELF</Text>
            <Text style={styles.title}>읽고 싶은 책 {BOOK_PICK_TARGET}권만 골라 볼까요?</Text>
            <Text style={styles.copy}>가입하면 서재의 '읽고 싶음'에 담아 드려요.</Text>
            {books.isLoading ? (
              <View style={styles.booksLoading}>
                <ActivityIndicator color={darkColors.accent} />
              </View>
            ) : (
              <ScrollView style={styles.bookScroll} contentContainerStyle={styles.bookGrid}>
                {bookItems.map((book) => {
                  const selected = bookIds.includes(book.id);
                  return (
                    <Pressable
                      key={book.id}
                      onPress={() => toggleBook(book.id, BOOK_PICK_TARGET)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      style={styles.bookCell}
                    >
                      <View style={[styles.bookCover, {
                        borderColor: selected ? darkColors.accent : darkColors.lineStrong,
                        borderWidth: selected ? 2 : hairline,
                        backgroundColor: darkColors.surface,
                      }]}>
                        {book.coverUrl ? (
                          <Image source={{ uri: book.coverUrl }} style={styles.bookImage} />
                        ) : (
                          <Text style={[typeScale.caption, styles.bookFallback, { color: darkColors.textMuted }]}
                                numberOfLines={4}>
                            {book.title}
                          </Text>
                        )}
                        {selected ? (
                          <View style={[styles.bookCheck, { backgroundColor: darkColors.ink }]}>
                            <Check size={13} color={darkColors.onInk} {...iconStroke} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={[typeScale.caption, { color: darkColors.textMuted }]} numberOfLines={1}>
                        {book.title}
                      </Text>
                    </Pressable>
                  );
                })}
                {bookItems.length === 0 ? (
                  <Text style={[typeScale.body, { color: darkColors.textMuted }]}>
                    아직 보여 드릴 책이 없어요. 가입한 뒤에 골라도 돼요.
                  </Text>
                ) : null}
              </ScrollView>
            )}
          </View>
        )}
      </Animated.View>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityLabel={`${step + 1} / ${totalSteps} 단계`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, {
                backgroundColor: i === step ? darkColors.accent : darkColors.lineStrong,
                width: i === step ? 20 : 6,
              }]}
            />
          ))}
        </View>

        <Button
          label={step === BOOK_STEP && bookItems.length === 0 ? '가입하러 가기' : ctaLabel}
          onPress={pressCta}
          disabled={!canProceed}
        />
        {/* 기존 회원이 빠져나가는 길 — 글자만 있던 때는 눈에 띄지 않아 주요 버튼 아래 보조 버튼으로 둔다. */}
        <Button label="이미 계정이 있어요" variant="outline" onPress={() => finish(false)} />
      </View>
    </View>
  );
}

/** 첫 인사 마크 — 펼친 책(구역 네비 '서가' 아이콘과 같은 꼴). 이모지는 플랫폼마다 그림이 달라 선으로 그린다. */
function BookGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M5 6.5h5.5A2.5 2.5 0 0 1 13 9v9.5a2.5 2.5 0 0 0-2.5-2.5H5z" stroke={color} {...iconStroke} />
      <Path d="M19 6.5h-3.5A2.5 2.5 0 0 0 13 9v9.5a2.5 2.5 0 0 1 2.5-2.5H19z" stroke={color} {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: darkColors.bg,
    padding: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: {
    fontFamily: serif.extraBold,
    fontSize: 20,
    color: darkColors.text,
    letterSpacing: 0.5,
  },
  body: { flex: 1, justifyContent: 'center' },
  guide: { gap: spacing.md },
  markWrap: {
    width: 72, height: 72, borderRadius: radius.md,
    borderWidth: hairline, borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontFamily: serif.bold, fontSize: 26, lineHeight: 36, color: darkColors.text },
  copy: { ...typeScale.body, color: darkColors.textMuted, lineHeight: 24 },
  pickerStep: { flex: 1, gap: spacing.md, paddingTop: spacing.xl },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  booksLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bookScroll: { flex: 1, marginTop: spacing.sm },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.lg },
  bookCell: { width: 96, gap: spacing.xs },
  bookCover: {
    width: 96, height: 138, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  bookImage: { width: '100%', height: '100%' },
  bookFallback: { padding: spacing.sm, textAlign: 'center' },
  bookCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  bottom: { gap: spacing.sm },
  dots: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dot: { height: 6, borderRadius: radius.none },
  pressed: pressedStyle,
});
