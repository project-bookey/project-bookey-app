import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import { BookCover } from '@/components/BookCover';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Card, Eyebrow, KeyValue, Loading, Numeral, ProgressBar, Rule, formatDuration, percent,
} from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 모임 결산 (§12.5) */
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
        <Text style={[styles.error, { color: colors.danger }]}>결산을 불러오지 못했습니다.</Text>
      </PaperScreen>
    );
  }

  return (
    <PaperScreen>
      <SubHeader category="결산" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <BookCover url={data.book?.coverUrl} title={data.book?.title} width={56} />
          <View style={{ flex: 1 }}>
            <Eyebrow>모임 결산</Eyebrow>
            <Text style={[styles.title, { color: colors.text }]}>{data.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>{data.book?.title}</Text>
          </View>
        </View>

        <Card>
          <View style={styles.bigStat}>
            <Numeral style={[styles.bigNumber, { color: colors.text }]}>
              {Math.round(data.finishRate * 100)}%
            </Numeral>
            <Text style={[typeScale.label, { color: colors.textMuted }]}>완독률</Text>
          </View>
          <ProgressBar value={data.finishRate} height={6} />
          <Rule />
          <KeyValue label="참여 인원" value={`${data.memberCount}명`} />
          <KeyValue label="완독" value={`${data.finishedCount}명`} />
          <KeyValue label="총 독서시간" value={formatDuration(data.totalDurationSec)} />
          {data.topDiscussant ? (
            <KeyValue label="최다 토론" value={data.topDiscussant} />
          ) : null}
        </Card>

        <View>
          <Eyebrow>최종 진행률</Eyebrow>
          <Card style={{ marginTop: spacing.sm, gap: spacing.md }}>
            {data.members.map((member) => (
              <View key={member.clubMemberId} style={{ gap: 5 }}>
                <View style={styles.memberRow}>
                  <Text style={[typeScale.label, { color: colors.text }]}>{member.nickname}</Text>
                  <Numeral style={[styles.memberValue, { color: colors.textMuted }]}>
                    {member.shareProgress ? percent(member.completionRate) : '비공개'}
                  </Numeral>
                </View>
                <ProgressBar value={member.completionRate} height={4} />
              </View>
            ))}
          </Card>
        </View>

        {data.bestQuotes.length > 0 ? (
          <View>
            <Eyebrow>베스트 인용</Eyebrow>
            <Card style={{ marginTop: spacing.sm, gap: spacing.md }}>
              {data.bestQuotes.map((quote, index) => (
                <View key={index} style={styles.quote}>
                  <View style={[styles.quoteBar, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.quoteText, { color: colors.textMuted }]}>{quote}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  title: { ...typeScale.titleSerif, fontSize: 20, lineHeight: 27, marginTop: 4 },
  bigStat: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  bigNumber: { fontSize: 44, letterSpacing: -1 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  memberValue: { fontSize: 12 },
  quote: { flexDirection: 'row', gap: spacing.md },
  quoteBar: { width: 2 },
  quoteText: { fontFamily: serif.regular, fontSize: 15, lineHeight: 25, flex: 1 },
  error: { ...typeScale.body, padding: spacing.lg },
});
