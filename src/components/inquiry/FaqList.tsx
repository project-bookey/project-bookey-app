import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { faqApi } from '@/api/endpoints';
import type { Faq } from '@/api/types';
import { Button, EmptyState, Eyebrow } from '@/components/ui';
import { hairline, iconStroke, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

import { faqsKey } from './queries';

type FaqSection = { title: string; data: Faq[] };

/** 서버 순서를 지키며 분류별로 묶는다 — 분류는 처음 나온 순서대로 선다. */
function groupByCategory(faqs: Faq[]): FaqSection[] {
  const sections: FaqSection[] = [];
  const byTitle = new Map<string, FaqSection>();
  for (const faq of faqs) {
    let section = byTitle.get(faq.categoryLabel);
    if (!section) {
      section = { title: faq.categoryLabel, data: [] };
      byTitle.set(faq.categoryLabel, section);
      sections.push(section);
    }
    section.data.push(faq);
  }
  return sections;
}

/**
 * 자주 묻는 질문 — 분류별로 묶은 아코디언. 질문 줄을 누르면 그 아래 답이 펼쳐진다(여러 개를 함께 열 수 있다).
 * 문의를 쓰기 전에 먼저 보이는 칸이라, 흔한 질문은 여기서 풀리게 한다. 내용은 어드민에서 고친다.
 */
export function FaqList() {
  const { colors } = useTheme();
  const faqs = useQuery({ queryKey: faqsKey, queryFn: faqApi.list });
  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(new Set());
  const sections = useMemo(() => groupByCategory(faqs.data ?? []), [faqs.data]);

  const toggle = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SectionList
      sections={sections}
      keyExtractor={(faq) => String(faq.id)}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshing={faqs.isRefetching}
      onRefresh={() => faqs.refetch()}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, sections[0] !== section && styles.sectionGap]}>
          <Eyebrow>{section.title}</Eyebrow>
        </View>
      )}
      renderItem={({ item }) => {
        const open = openIds.has(item.id);
        return (
          <View style={[styles.item, { borderBottomColor: colors.line }]}>
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={item.question}
              style={({ pressed }) => [styles.question, pressed && pressedStyle]}
            >
              <Text style={[typeScale.bodyStrong, styles.questionText, { color: colors.text }]}>{item.question}</Text>
              <View style={open ? styles.chevronOpen : undefined}>
                <ChevronDown size={18} color={colors.textMuted} {...iconStroke} />
              </View>
            </Pressable>
            {open ? (
              <Text selectable style={[typeScale.body, styles.answer, { color: colors.textMuted }]}>{item.answer}</Text>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={
        faqs.isLoading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
            ))}
          </View>
        ) : faqs.isError ? (
          <EmptyState
            title="질문을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={<Button label="다시 시도" variant="outline" onPress={() => faqs.refetch()} />}
          />
        ) : (
          <EmptyState
            title="아직 준비된 질문이 없어요"
            description="궁금한 점은 아래 '문의하기'로 남겨 주세요."
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  sectionHeader: { paddingBottom: spacing.xs },
  // 분류 사이는 섹션 간격 — 같은 분류의 질문끼리는 괘선 한 줄로만 나뉜다(UX 철칙 Proximity).
  sectionGap: { marginTop: spacing.xl },
  item: { borderBottomWidth: hairline },
  question: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  questionText: { flex: 1 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  answer: { paddingBottom: spacing.lg },
  skeletonList: { gap: spacing.sm },
  // 질문 줄 자리 — 상자가 아니라 괘선으로 나뉜 글줄이라 작은 모서리(badge)만 준다.
  skeleton: { height: 44, borderRadius: radius.sm },
});
