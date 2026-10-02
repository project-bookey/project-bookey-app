import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { StatStrip } from '@/components/club';
import { PaperScreen, SubHeader, TiltCover } from '@/components/collage';
import {
  Button, EmptyState, Eyebrow, KeyValue, Loading, Numeral, ProgressBar, formatDuration, linkLabel, percent,
} from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

/** 클럽 결산 (§12.5) — 활자·괘선 판면: 명조 이름 · 숫자 띠 · 괘선 단(진행률 표, 베스트 인용). */
export default function ClubResultScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const result = useQuery({
    queryKey: ['club', clubId, 'result'],
    queryFn: () => clubApi.result(clubId),
    enabled: Number.isFinite(clubId),
  });

  if (result.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="결산" />
        <Loading />
      </PaperScreen>
    );
  }
  const data = result.data;
  if (!data) {
    return (
      <PaperScreen>
        <SubHeader category="결산" />
        <EmptyState
          title="결산을 불러오지 못했어요"
          description={result.error instanceof ApiError ? result.error.message : '클럽이 끝나면 결산이 만들어져요.'}
          action={<Button label={linkLabel('다시 시도', 'action')} variant="outline" onPress={() => result.refetch()} />}
        />
      </PaperScreen>
    );
  }

  return (
    <PaperScreen>
      <SubHeader category="결산" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TiltCover uri={data.book?.coverUrl} title={data.book?.title} width={56} tilt={0} entering={false} />
          <View style={{ flex: 1, gap: 4 }}>
            <Eyebrow>클럽 결산</Eyebrow>
            <Text style={[styles.title, { color: colors.text }]}>{data.name}</Text>
            <Text style={[styles.bookLine, { color: colors.textMuted }]}>
              {[data.book?.title, data.book?.author].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <StatStrip
            cells={[
              { label: '완독률', value: `${Math.round(data.finishRate * 100)}%` },
              { label: '완독', value: String(data.finishedCount), unit: ` / ${data.memberCount}명` },
              { label: '참여', value: String(data.memberCount), unit: '명' },
            ]}
          />
          <ProgressBar value={data.finishRate} height={4} />
          <KeyValue label="총 독서시간" value={formatDuration(data.totalDurationSec)} />
        </View>

        <View style={[styles.section, { borderTopColor: colors.line }]}>
          <Eyebrow>최종 진행률</Eyebrow>
          <View>
            {data.members.map((member) => (
              <View key={member.clubMemberId} style={[styles.memberRow, { borderBottomColor: colors.line }]}>
                <Text numberOfLines={1} style={[typeScale.label, styles.memberName, { color: colors.text }]}>
                  {member.nickname}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={member.shareProgress ? member.completionRate : 0} height={3} />
                </View>
                <Numeral style={[styles.memberValue, { color: member.shareProgress ? colors.text : colors.textFaint }]}>
                  {member.shareProgress ? percent(member.completionRate) : '비공개'}
                </Numeral>
              </View>
            ))}
          </View>
        </View>

        {data.bestQuotes.length > 0 ? (
          <View style={[styles.section, { borderTopColor: colors.line }]}>
            <Eyebrow>베스트 인용</Eyebrow>
            <View style={{ gap: spacing.md }}>
              {data.bestQuotes.map((quote, index) => (
                <View key={index} style={styles.quote}>
                  <View style={[styles.quoteBar, { backgroundColor: colors.ink }]} />
                  <Text style={[styles.quoteText, { color: colors.text }]}>{quote}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  title: { ...typeScale.titleSerif, fontSize: 24, lineHeight: 32 },
  bookLine: { fontFamily: mono.regular, fontSize: 11, letterSpacing: 0.3 },
  section: { borderTopWidth: hairline, paddingTop: spacing.lg, gap: spacing.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: hairline,
  },
  memberName: { width: 84 },
  memberValue: { fontFamily: mono.semiBold, fontSize: 13, width: 52, textAlign: 'right' },
  quote: { flexDirection: 'row', gap: spacing.md },
  quoteBar: { width: 2 },
  quoteText: { fontFamily: serif.regular, fontSize: 15, lineHeight: 25, flex: 1 },
});
