import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { clubApi } from '@/api/endpoints';
import { MemoScrap, PaperScreen, SubHeader } from '@/components/collage';
import {
  WEEK_CARD_BASE_WIDTH, WeekCard, addDays, clubLogKeys, mondayOf, todayKst,
} from '@/components/clubLog';
import { Button, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/** 내보내는 이미지 크기 — 인스타 스토리 1080×1920. */
const EXPORT = { width: 1080, height: 1920 };

/**
 * 주간 공유 카드 — 한 주의 조각을 9:16 한 장으로 모아 이미지로 저장·공유한다.
 * 카드 View 를 그대로 캡처한다(네이티브 view-shot, 웹 html2canvas). 가려진 조각은 서버가 이미 뺐다.
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
      if (Platform.OS === 'web') {
        await shareOnWeb(cardRef.current, monday);
      } else {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', ...EXPORT });
        if (!(await Sharing.isAvailableAsync())) {
          setNotice('이 기기에서는 공유를 쓸 수 없어요.');
          return;
        }
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '이번 주 읽기로그 카드', UTI: 'public.png' });
      }
    } catch (e) {
      // 사용자가 공유 창을 닫으면 AbortError — 실패로 알리지 않는다.
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setNotice('카드를 이미지로 만들지 못했어요 · 다시 시도');
      }
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
          <Pressable onPress={() => setMonday(addDays(monday, -7))} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.navLabel, { color: colors.textMuted }]}>‹ 지난주</Text>
          </Pressable>
          {monday < thisMonday ? (
            <Pressable onPress={() => setMonday(addDays(monday, 7))} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.navLabel, { color: colors.textMuted }]}>다음주 ›</Text>
            </Pressable>
          ) : null}
        </View>

        {week.isLoading ? (
          <Loading />
        ) : !data ? (
          <Text style={[typeScale.body, { color: colors.danger }]}>카드를 불러오지 못했습니다.</Text>
        ) : empty ? (
          <MemoScrap rotate={-1}>
            <Text style={[typeScale.quote, { color: colors.text, fontSize: 15, lineHeight: 24 }]}>
              이 주에는 아직 모인 조각이 없어요.
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
              읽기를 마치고 조각을 남기면 일요일 밤 카드 한 장으로 모여요.
            </Text>
          </MemoScrap>
        ) : (
          <>
            <View style={styles.cardWrap}>
              <WeekCard ref={cardRef} week={data} width={cardWidth} />
            </View>
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              내 진도보다 뒤 쪽에 붙은 조각은 카드에 들어가지 않아요.
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

/**
 * 웹 — 파일 공유를 지원하는 브라우저(모바일 사파리·크롬)는 공유 시트로, 아니면 PNG 로 내려받는다.
 * 웹의 captureRef 는 DOM 노드를 html2canvas 로 그려 data URI 를 돌려준다.
 */
async function shareOnWeb(node: View, monday: string) {
  const dataUri = await captureRef(node, { format: 'png', quality: 1, result: 'data-uri', ...EXPORT });
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], `bookey-readlog-${monday}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: '이번 주 읽기로그' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between' },
  navLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 1.2 },
  cardWrap: { alignItems: 'center' },
  hint: { textAlign: 'center' },
});
