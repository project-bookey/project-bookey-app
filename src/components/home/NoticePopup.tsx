import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useRouter } from '@/navigation';

import type { Banner } from '@/api/types';
import { CachedImage } from '@/components/CachedImage';
import { todayKst } from '@/components/clubLog/dates';
import { useAppTour } from '@/store/appTour';
import {
  ForceThemeMode, hairline, iconSize, iconStroke, pressedStyle, radius, sans, serif, spacing, typeScale, useTheme,
} from '@/theme';
import { InlineMarkdownText } from './InlineMarkdownText';

/** '오늘 하루 보지 않기'를 누른 날(KST 'YYYY-MM-DD') — 그날은 공지를 하나도 띄우지 않는다. */
const HIDE_DAY_KEY = 'bookey.noticePopup.hideDay';
/**
 * '닫기'로 닫은 공지 — 앱을 다시 열 때까지만 기억한다(모듈 메모리). 홈이 다시 그려져도 같은 공지가
 * 또 뜨지 않게 하고, 그 사이 관리자가 새 공지를 올리면 그것만 뜬다.
 */
const closedThisRun = new Set<number>();

const MAX_WIDTH = 420;
const BAR_HEIGHT = 48;
/** 사진 칸 비율(가로 4 : 세로 5) — 관리자 사진이 이 비율로 잘린다. */
const PHOTO_ASPECT = 4 / 5;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * 홈 공지 팝업 — 가운데 이미지 팝업(2026-10-10 사용자 결정, 홈 팝업 시안 A).
 * 공지가 여럿이면 한 팝업 안에서 옆으로 밀어 넘기고(사진 오른쪽 아래 '‹ 1 / 3 ›' 로도 넘긴다),
 * 아래 '오늘 하루 보지 않기 | 닫기' 한 줄은 지금 장이 아니라 팝업 전체에 적용된다.
 */
export function NoticePopup({ notices }: { notices?: Banner[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // 앱 둘러보기와 겹치지 않게 — 둘러보기를 띄울지 확인이 끝나고 둘러보기가 꺼진 뒤에만 띄운다.
  // 메인 탭이 두 벌 떠 있을 때(프로필 사진 변경 뒤 등) 가려진 쪽은 띄우지 않는다.
  const tourBusy = useAppTour((s) => !s.checked || s.active);
  const isFocused = useIsFocused();
  const listRef = useRef<FlatList<Banner>>(null);
  const [hiddenToday, setHiddenToday] = useState<boolean | null>(null); // null = 아직 확인 중
  const [page, setPage] = useState(0);
  const [, setClosedCount] = useState(0); // 닫은 뒤 다시 그리게 하는 용도

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HIDE_DAY_KEY)
      .then((day) => { if (!cancelled) setHiddenToday(day === todayKst()); })
      .catch(() => { if (!cancelled) setHiddenToday(false); });
    return () => { cancelled = true; };
  }, []);

  const pending = (notices ?? []).filter((n) => !closedThisRun.has(n.id));
  // 닫히며 흐려지는 동안에도 카드가 그대로 보이도록 마지막으로 띄운 목록을 붙잡아 둔다.
  const shownRef = useRef<Banner[]>([]);
  if (pending.length > 0) shownRef.current = pending;
  const shown = shownRef.current;
  const shownKey = shown.map((n) => n.id).join(',');

  useEffect(() => { setPage(0); }, [shownKey]);

  // 카드가 화면 안에 다 들어오게 — 화면 폭과 최대 폭, 그리고 남는 높이에서 나온 사진 폭 중 작은 값.
  const fitByHeight = (window.height - insets.top - insets.bottom - spacing.lg * 2 - BAR_HEIGHT) * PHOTO_ASPECT;
  const cardWidth = Math.floor(Math.min(window.width - spacing.lg * 2, MAX_WIDTH, fitByHeight));
  const pageWidth = cardWidth - hairline * 2;
  const pageHeight = Math.round(pageWidth / PHOTO_ASPECT);

  const visible = hiddenToday === false && pending.length > 0 && !tourBusy && isFocused;

  const closeAll = () => {
    pending.forEach((n) => closedThisRun.add(n.id));
    setClosedCount((c) => c + 1);
  };

  const hideToday = () => {
    AsyncStorage.setItem(HIDE_DAY_KEY, todayKst()).catch(() => {});
    setHiddenToday(true);
    closeAll();
  };

  const open = (notice: Banner) => {
    if (!notice.linkUrl) return;
    closeAll();
    if (/^https?:\/\//.test(notice.linkUrl)) {
      Linking.openURL(notice.linkUrl).catch(() => {});
    } else {
      router.push(notice.linkUrl as never);
    }
  };

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(shown.length - 1, index));
    setPage(next);
    listRef.current?.scrollToOffset({ offset: next * pageWidth, animated: true });
  };

  if (shown.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAll}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrimDim }]}>
        <View style={[styles.card, { width: cardWidth, backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
          <View style={{ height: pageHeight }}>
            <FlatList
              key={shownKey}
              ref={listRef}
              horizontal
              pagingEnabled
              data={shown}
              keyExtractor={(n) => String(n.id)}
              scrollEnabled={shown.length > 1}
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
              scrollEventThrottle={16}
              // onMomentumScrollEnd 는 웹에서 오지 않을 수 있어 스크롤 위치로 장을 센다.
              onScroll={(e) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                if (next !== page && next >= 0 && next < shown.length) setPage(next);
              }}
              renderItem={({ item }) => (
                <NoticePage notice={item} width={pageWidth} height={pageHeight} onOpen={() => open(item)} />
              )}
            />
            {shown.length > 1 ? <PageCounter page={page} total={shown.length} onGo={goTo} /> : null}
          </View>

          {/* 아래 한 줄 — 다른 앱 이벤트 팝업과 같은 '오늘 하루 보지 않기 | 닫기'. */}
          <View style={[styles.bar, { borderTopColor: colors.line }]}>
            <Pressable
              onPress={hideToday}
              accessibilityRole="button"
              style={({ pressed }) => [styles.barButton, pressed && pressedStyle]}
            >
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>오늘 하루 보지 않기</Text>
            </Pressable>
            <View style={[styles.barDivider, { backgroundColor: colors.line }]} />
            <Pressable
              onPress={closeAll}
              accessibilityRole="button"
              accessibilityLabel="공지 닫기"
              style={({ pressed }) => [styles.barButton, pressed && pressedStyle]}
            >
              <Text style={[styles.barLabel, styles.barClose, { color: colors.text }]}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 공지 한 장 — 사진이 있으면 사진만, 없거나 못 불러오면 바탕색 위에 제목·설명. 링크가 있으면 눌러서 연다. */
function NoticePage({ notice, width, height, onOpen }: {
  notice: Banner;
  width: number;
  height: number;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const bgColor = notice.bgColor && HEX_COLOR.test(notice.bgColor) ? notice.bgColor : undefined;
  const photo = notice.imageUrl && !failed ? notice.imageUrl : undefined;
  const label = [notice.title, notice.subtitle ?? ''].filter(Boolean).join('. ').replace(/\*\*/g, '');

  const body = photo ? (
    <CachedImage
      source={{ uri: photo }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      accessible={false}
      onError={() => setFailed(true)}
    />
  ) : bgColor ? (
    // 관리자가 고른 바탕색에 맞춰 글자 색을 고른다 — 밝은 바탕엔 어두운 글자, 어두운 바탕엔 밝은 글자.
    <ForceThemeMode mode={isLightColor(bgColor) ? 'light' : 'dark'}>
      <PlainNotice notice={notice} />
    </ForceThemeMode>
  ) : (
    <PlainNotice notice={notice} />
  );

  // 사진을 불러오는 동안·사진이 없을 때 자리를 바탕색으로 채워 둔다.
  const frame = { width, height, backgroundColor: bgColor ?? colors.surfaceRaised };

  if (!notice.linkUrl) {
    return (
      <View style={frame} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="자세히 보기"
      style={({ pressed }) => [frame, pressed && pressedStyle]}
    >
      {body}
    </Pressable>
  );
}

function PlainNotice({ notice }: { notice: Banner }) {
  const { colors } = useTheme();
  return (
    <View style={styles.plain}>
      <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>공지</Text>
      <Text numberOfLines={4} style={[typeScale.titleSerif, styles.plainTitle, { color: colors.text }]}>
        <InlineMarkdownText text={notice.title} strongStyle={styles.titleStrong} />
      </Text>
      {notice.subtitle ? (
        <Text numberOfLines={6} style={[typeScale.body, { color: colors.textMuted }]}>
          <InlineMarkdownText text={notice.subtitle} strongStyle={styles.subtitleStrong} />
        </Text>
      ) : null}
    </View>
  );
}

/** 사진 오른쪽 아래 '‹ 1 / 3 ›' — 밀어 넘기기의 눈에 보이는 대안. 사진 위라 모드와 상관없이 어둡게 둔다. */
function PageCounter(props: { page: number; total: number; onGo: (index: number) => void }) {
  return (
    <ForceThemeMode mode="dark">
      <PageCounterBody {...props} />
    </ForceThemeMode>
  );
}

function PageCounterBody({ page, total, onGo }: { page: number; total: number; onGo: (index: number) => void }) {
  const { colors } = useTheme();
  const atFirst = page === 0;
  const atLast = page === total - 1;
  return (
    <View style={[styles.counter, { backgroundColor: colors.surfaceRaised }]}>
      <Pressable
        onPress={() => onGo(page - 1)}
        disabled={atFirst}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="이전 공지"
        accessibilityState={{ disabled: atFirst }}
        style={({ pressed }) => [styles.counterButton, atFirst && styles.counterDisabled, pressed && pressedStyle]}
      >
        <ChevronLeft size={iconSize.inline} color={colors.text} {...iconStroke} />
      </Pressable>
      <Text
        accessibilityLabel={`공지 ${total}개 중 ${page + 1}번째`}
        style={[typeScale.label, styles.counterText, { color: colors.text }]}
      >
        {page + 1} / {total}
      </Text>
      <Pressable
        onPress={() => onGo(page + 1)}
        disabled={atLast}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="다음 공지"
        accessibilityState={{ disabled: atLast }}
        style={({ pressed }) => [styles.counterButton, atLast && styles.counterDisabled, pressed && pressedStyle]}
      >
        <ChevronRight size={iconSize.inline} color={colors.text} {...iconStroke} />
      </Pressable>
    </View>
  );
}

function isLightColor(hex: string): boolean {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(full.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { borderWidth: hairline, borderRadius: radius.lg, overflow: 'hidden' },
  // 아래 오른쪽 장 표시(32 + 여백)에 글자가 가리지 않게 아래를 더 비운다.
  plain: { flex: 1, justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.xl, paddingBottom: 64 },
  plainTitle: { fontSize: 26, lineHeight: 36 },
  titleStrong: { fontFamily: serif.extraBold },
  subtitleStrong: { fontFamily: sans.semiBold },
  counter: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
  },
  counterButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  counterDisabled: { opacity: 0.35 },
  counterText: { minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: BAR_HEIGHT, borderTopWidth: hairline },
  barButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barDivider: { width: hairline, marginVertical: 14 },
  barLabel: { fontFamily: sans.regular, fontSize: 14 },
  barClose: { fontFamily: sans.semiBold },
});
