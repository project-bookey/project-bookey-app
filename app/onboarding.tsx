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
import { darkColors, hairline, radius, spacing, typeScale } from '@/theme';
import { serif } from '@/theme/tokens';

/** 온보딩 책 선택 개수 — "5권 고르기". */
const BOOK_PICK_TARGET = 5;
/** 카테고리 선택 상한. */
const CATEGORY_MAX = 5;

const CATEGORIES = [
  '소설', '에세이', '시', '인문학', '역사', '과학',
  '자기계발', '경제/경영', '컴퓨터/IT', '예술', '여행', '만화',
];

/** 안내 카드 단계 — 그 뒤로 카테고리·책 고르기 단계가 이어진다. */
const GUIDE_STEPS: { mark: string; eyebrow: string; title: string; body: string }[] = [
  {
    mark: '📖',
    eyebrow: 'WELCOME',
    title: '만나서 반가워요',
    body: 'bookey는 읽기로 한 책을\n진짜로 다 읽게 만드는 독서 앱이에요.\n잠깐만 구경하고 시작할까요?',
  },
  {
    mark: '🔥',
    eyebrow: 'READ',
    title: '재촉이 완독을 만들어요',
    body: '목표를 세우면 부키가 다정하게,\n때로는 츤데레처럼 재촉해요.\n타이머로 읽은 기록이 그대로 쌓입니다.',
  },
  {
    mark: '✉️',
    eyebrow: 'FEED & POSTCARD',
    title: '읽은 사람들과 연결돼요',
    body: '실제로 읽은 사람의 독후감이 피드에 흐르고,\n마음이 닿으면 딱 16글자의 엽서를 보내요.\n답장이 오면 서로 팔로우되고 채팅이 열립니다.',
  },
];

/**
 * 온보딩 — 인사 → 가이드 → 선호 카테고리 → 책 5권 고르기 → 가입(본인인증)으로 이어진다.
 * 기기당 1회. 여기서 고른 것은 가입 성공 직후 서버에 반영된다(login.tsx).
 */
export default function OnboardingScreen() {
  const router = useRouter();
  /** 0..2 가이드, 3 카테고리, 4 책 고르기. */
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const { categories, bookIds, setCategories, toggleBook } = useOnboarding();

  const CATEGORY_STEP = GUIDE_STEPS.length;
  const BOOK_STEP = GUIDE_STEPS.length + 1;
  const totalSteps = GUIDE_STEPS.length + 2;

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
        <Pressable onPress={() => finish(false)} accessibilityRole="button" hitSlop={10}>
          <Text style={[typeScale.monoLabel, { color: darkColors.textFaint }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        {step < CATEGORY_STEP ? (
          <View style={styles.guide}>
            <View style={styles.markWrap}>
              <Text style={styles.mark}>{GUIDE_STEPS[step].mark}</Text>
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
            <Text style={styles.copy}>골라주시면 피드와 추천이 그 취향을 따라가요. (최대 {CATEGORY_MAX}개)</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => {
                const selected = categories.includes(category);
                return (
                  <Pressable
                    key={category}
                    onPress={() => toggleCategory(category)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={[styles.categoryChip, {
                      borderColor: selected ? darkColors.accent : darkColors.lineStrong,
                      backgroundColor: selected ? darkColors.accentSoft : darkColors.surface,
                    }]}
                  >
                    <Text style={[typeScale.label, {
                      color: selected ? darkColors.accent : darkColors.textMuted,
                    }]}>
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.pickerStep}>
            <Text style={[typeScale.monoEyebrow, { color: darkColors.accent }]}>SHELF</Text>
            <Text style={styles.title}>읽고 싶은 책 {BOOK_PICK_TARGET}권만 골라볼까요?</Text>
            <Text style={styles.copy}>가입하면 서재의 "읽고 싶은 책"에 담아드려요.</Text>
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
                          <View style={[styles.bookCheck, { backgroundColor: darkColors.accent }]}>
                            <Text style={{ color: darkColors.onAccent, fontSize: 12 }}>✓</Text>
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
                    아직 보여드릴 책이 없어요. 그냥 가입하고 골라도 돼요.
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

        <Pressable
          onPress={pressCta}
          disabled={!canProceed}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, {
            backgroundColor: canProceed ? darkColors.accent : darkColors.surface,
          }, pressed && styles.pressed]}
        >
          <Text style={[typeScale.bodyStrong, {
            color: canProceed ? darkColors.onAccent : darkColors.textFaint,
          }]}>
            {step === BOOK_STEP && bookItems.length === 0 ? '가입하러 가기' : ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => finish(false)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
        >
          <Text style={[typeScale.label, { color: darkColors.textMuted }]}>
            이미 계정이 있어요
          </Text>
        </Pressable>
      </View>
    </View>
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
    width: 72, height: 72, borderRadius: 36,
    borderWidth: hairline, borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mark: { fontSize: 34 },
  title: { fontFamily: serif.bold, fontSize: 26, lineHeight: 36, color: darkColors.text },
  copy: { ...typeScale.body, color: darkColors.textMuted, lineHeight: 24 },
  pickerStep: { flex: 1, gap: spacing.md, paddingTop: spacing.xl },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  categoryChip: {
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
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
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  bottom: { gap: spacing.sm },
  dots: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dot: { height: 6, borderRadius: 3 },
  cta: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
