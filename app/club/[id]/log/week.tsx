import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { clubApi } from '@/api/endpoints';
import { ICON_SIZE, MemoScrap, PaperScreen, SubHeader } from '@/components/collage';
import {
  WEEK_CARD_BASE_WIDTH, WeekCard, addDays, clubLogKeys, mondayOf, todayKst,
} from '@/components/clubLog';
import { Button, Loading } from '@/components/ui';
import { sharePng } from '@/lib/sharePng';
import { iconStroke, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 내보내는 이미지 크기 — 인스타 스토리 1080×1920. */
const EXPORT = { width: 1080, height: 1920 };

/**
 * 주간 공유 카드 — 한 주의 조각을 9:16 한 장으로 모아 이미지로 저장·공유한다.
 * 카드 View 를 그대로 캡처한다(sharePng — 네이티브 view-shot, 웹 html2canvas). 가려진 조각은 서버가 이미 뺐다.
 */
export default function ClubLogWeekScreen() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; weekOf?: string }>();
  const clubId = Number(params.id);
  const thisMonday = mondayOf(todayKst());
  const [monday, setMonday] = useState(params.weekOf ? mondayOf(params.weekOf) : thisMonday);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cardRef = useRef<View>(null);

  const week = useQuery({
    queryKey: clubLogKeys.week(clubId, monday),
    queryFn: () => clubApi.logWeek(clubId, monday),
    enabled: Number.isFinite(clubId),
  });

  // 화면 좌우 여백(16)을 빼고 설계 폭을 넘지 않게 — 넓은 화면(웹)에서도 스토리 크기 그대로.
  const cardWidth = Math.min(WEEK_CARD_BASE_WIDTH, Math.min(screenWidth, layout.content.maxWidth) - spacing.lg * 2);

  const share = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    setNotice(null);
    try {
      const result = await sharePng(cardRef, {
        ...EXPORT, fileName: `bookey-readlog-${monday}.png`, title: '이번 주 카드',
      });
      if (result === 'unavailable') setNotice('이 기기에서는 공유를 쓸 수 없어요.');
    } catch {
      setNotice('카드를 이미지로 만들지 못했어요 · 다시 시도');
    } finally {
      setSharing(false);
    }
  };

  const data = week.data;
  const empty = data != null && data.summary.logCount === 0 && data.summary.pagesRead === 0;

  return (
    <PaperScreen>
      <SubHeader category="이번 주 카드" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setMonday(addDays(monday, -7))}
            accessibilityRole="button"
            accessibilityLabel="지난주"
            style={({ pressed }) => [styles.navButton, pressed && pressedStyle]}
          >
            <ChevronLeft size={ICON_SIZE} color={colors.text} {...iconStroke} />
          </Pressable>
          {monday < thisMonday ? (
            <Pressable
              onPress={() => setMonday(addDays(monday, 7))}
              accessibilityRole="button"
              accessibilityLabel="다음 주"
              style={({ pressed }) => [styles.navButton, pressed && pressedStyle]}
            >
              <ChevronRight size={ICON_SIZE} color={colors.text} {...iconStroke} />
            </Pressable>
          ) : null}
        </View>

        {week.isLoading ? (
          <Loading />
        ) : !data ? (
          <Text style={[typeScale.body, { color: colors.danger }]}>카드를 불러오지 못했어요.</Text>
        ) : empty ? (
          <MemoScrap rotate={-1}>
            <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>
              이 주에는 아직 모인 메모가 없어요.
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
              읽기를 마치고 메모를 남기면 일요일 밤 카드 한 장으로 모여요.
            </Text>
          </MemoScrap>
        ) : (
          <>
            <View style={styles.cardWrap}>
              <WeekCard ref={cardRef} week={data} width={cardWidth} />
            </View>
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              내가 아직 안 읽은 쪽의 메모는 카드에 넣지 않아요.
            </Text>
            {notice ? (
              <Text style={[typeScale.caption, { color: colors.danger, textAlign: 'center' }]} accessibilityRole="alert">
                {notice}
              </Text>
            ) : null}
            <Button label="이미지로 공유하기" onPress={share} loading={sharing} />
          </>
        )}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between' },
  // 주를 넘기는 유일한 길 — 글자 없이 화살표만(2026-10-05 사용자 결정), 상자는 IconButton 과 같은 44pt.
  navButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  cardWrap: { alignItems: 'center' },
  hint: { textAlign: 'center' },
});
