import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ApiError } from '@/api/client';
import { clubCommunityApi, type ClubActivityCard } from '@/api/endpoints';
import { prepareImage } from '@/api/upload';
import { notify } from '@/components/club';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Eyebrow, Field, FootAction, Loading, Numeral, formatClock } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, pressedStyle } from '@/theme/tokens';

/** 기록 카드에 붙일 스티커 — 카드 위 내용물이라 이모지를 쓴다(크롬 아이콘이 아니다). */
const STICKERS = ['📚', '✨', '☕', '🔥', '💯', '🌿', '❤️', '⭐', '🎉', '📝'];
const MAX_STICKERS = 8;

/**
 * 모임 기록(스탑워치) — 약속 상세의 '독서 종료'에서 넘어오거나 따로 연다.
 * 위는 함께 독서 타이머(모노 숫자), 아래는 최근 기록 카드 목록(괘선 행). 카드를 고르면 꾸미기 모드:
 * 4:5 기록 카드(사진·스티커·한마디)와 편집 폼, PNG 저장·공유.
 */
export default function ClubActivityScreen() {
  const { id, cardId } = useLocalSearchParams<{ id: string; cardId?: string }>();
  const clubId = Number(id);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<ClubActivityCard | null>(null);
  const [caption, setCaption] = useState('');
  const [stickers, setStickers] = useState<string[]>([]);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const current = useQuery({
    queryKey: ['clubActivity', clubId, 'current'],
    queryFn: () => clubCommunityApi.currentActivity(clubId),
  });
  const cards = useQuery({
    queryKey: ['clubActivity', clubId, 'cards'],
    queryFn: () => clubCommunityApi.activityCards(clubId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['clubActivity', clubId] });

  useEffect(() => {
    if (!current.data) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [current.data]);

  // 약속 상세에서 방금 끝낸 카드(cardId)로 들어왔으면 그 카드를 바로 꾸미기 모드로 연다.
  useEffect(() => {
    if (editing || !cardId || !cards.data) return;
    const found = cards.data.find((c) => String(c.id) === cardId);
    if (found) openCard(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, cards.data]);

  const fail = (fallback: string) => (e: unknown) => notify(e instanceof ApiError ? e.message : fallback);
  const start = useMutation({
    mutationFn: () => clubCommunityApi.startActivity(clubId),
    onSuccess: refresh,
    onError: fail('기록을 시작하지 못했어요.'),
  });
  const end = useMutation({
    mutationFn: () => clubCommunityApi.endActivity(clubId),
    onSuccess: (c) => {
      setEditing(c);
      refresh();
    },
    onError: fail('기록을 끝내지 못했어요.'),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('no card');
      const form = photo ? await prepareImage(photo) : new FormData();
      form.append('caption', caption);
      form.append('decorationsJson', JSON.stringify(stickers));
      return clubCommunityApi.decorateActivityCard(clubId, editing.id, form);
    },
    onSuccess: (c) => {
      setEditing(c);
      setPhoto(null);
      refresh();
      notify('기록 카드를 저장했어요.');
    },
    onError: fail('저장하지 못했어요.'),
  });

  const openCard = (c: ClubActivityCard) => {
    setEditing(c);
    setCaption(c.caption ?? '');
    try {
      setStickers(JSON.parse(c.decorationsJson));
    } catch {
      setStickers([]);
    }
  };
  const closeCard = () => {
    setEditing(null);
    setCaption('');
    setStickers([]);
    setPhoto(null);
  };
  const pick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) setPhoto(r.assets[0]);
  };
  const share = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
        width: 1080,
        height: 1350,
      });
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `bookey-club-${editing?.id}.png`;
        a.click();
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '모임 기록 카드 저장·공유' });
      }
    } finally {
      setSharing(false);
    }
  };

  if (current.isLoading) {
    return (
      <PaperScreen>
        <SubHeader category="모임 기록" />
        <Loading />
      </PaperScreen>
    );
  }
  const elapsed = current.data
    ? Math.max(0, Math.floor((now - new Date(current.data.startedAt).getTime()) / 1000))
    : 0;
  const card = editing;
  const shownPhoto = photo?.uri ?? card?.photoUrl;

  return (
    <PaperScreen>
      <SubHeader category="모임 기록" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {card ? (
          <>
            {/* 공유용 기록 카드 — 종이 한 장(헤어라인), 사진은 위 절반에 흐리게 */}
            <View
              ref={cardRef}
              collapsable={false}
              style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              {shownPhoto ? (
                <Image source={{ uri: shownPhoto }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, { backgroundColor: colors.paperAlt }]} />
              )}
              <Text style={styles.stickerLayer}>{stickers.join('  ')}</Text>
              <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>오늘의 모임 기록</Text>
              <Text style={[styles.duration, { color: colors.text }]}>{formatClock(card.durationSec)}</Text>
              <Text style={[styles.cardCaption, { color: colors.text }]}>
                {caption || '함께여서 더 오래 집중한 시간'}
              </Text>
              <Text style={[styles.cardFoot, { color: colors.textFaint }]}>@{card.nickname} · 모임 기록</Text>
            </View>

            <View style={[styles.section, { borderTopColor: colors.line }]}>
              <Eyebrow>꾸미기</Eyebrow>
              <Field
                label="한마디"
                value={caption}
                onChangeText={setCaption}
                maxLength={500}
                placeholder="기록 카드에 남길 한마디"
              />
              <Text style={[typeScale.monoEyebrow, { color: colors.textMuted }]}>스티커 · {stickers.length}/{MAX_STICKERS}</Text>
              <View style={styles.stickers}>
                {STICKERS.map((x) => (
                  <Pressable
                    key={x}
                    onPress={() => setStickers((v) => (v.length < MAX_STICKERS ? [...v, x] : v))}
                    accessibilityRole="button"
                    accessibilityLabel={`스티커 ${x} 붙이기`}
                    style={({ pressed }) => [styles.stickerCell, { borderColor: colors.line }, pressed ? pressedStyle : null]}
                  >
                    <Text style={styles.sticker}>{x}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.rowActions}>
                <Button label="사진 첨부" size="sm" variant="outline" onPress={pick} />
                <Button label="스티커 지우기" size="sm" variant="ghost" onPress={() => setStickers([])} />
              </View>
              <Button label="꾸미기 저장" onPress={() => save.mutate()} loading={save.isPending} />
              <Button label="PNG 저장·공유" variant="outline" onPress={share} loading={sharing} />
              <View style={styles.footer}>
                <FootAction label="완료" kind="action" onPress={closeCard} />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Eyebrow>함께 독서</Eyebrow>
              <Text style={[styles.timer, { color: current.data ? colors.text : colors.textFaint }]}>
                {formatClock(elapsed)}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                {current.data ? '모임 집중 시간을 기록하고 있어요.' : '모임 사람들과 함께한 시간을 기록해 보세요.'}
              </Text>
              <Button
                label={current.data ? '기록 종료' : '스탑워치 시작'}
                variant={current.data ? 'danger' : 'primary'}
                onPress={() => (current.data ? end.mutate() : start.mutate())}
                loading={start.isPending || end.isPending}
              />
            </View>

            <View style={[styles.section, { borderTopColor: colors.line, borderTopWidth: hairline }]}>
              <Eyebrow>최근 모임 기록</Eyebrow>
              {cards.isLoading ? (
                <Loading />
              ) : (cards.data ?? []).length === 0 ? (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  아직 기록 카드가 없어요. 기록을 끝내면 여기에 쌓여요.
                </Text>
              ) : (
                <View>
                  {(cards.data ?? []).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => openCard(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.nickname} 기록 카드 꾸미기`}
                      style={({ pressed }) => [styles.cardRow, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
                    >
                      <Numeral style={[styles.rowClock, { color: colors.text }]}>{formatClock(c.durationSec)}</Numeral>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[typeScale.label, { color: colors.text }]}>{c.nickname}</Text>
                        <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
                          {c.caption || '꾸미지 않은 기록 카드'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  section: { gap: spacing.md, paddingTop: spacing.sm },
  timer: {
    fontFamily: mono.semiBold,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
  },
  rowClock: { fontFamily: mono.semiBold, fontSize: 15, width: 64 },
  resultCard: {
    height: 500,
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '62%', opacity: 0.78 },
  stickerLayer: { position: 'absolute', top: 30, left: 20, right: 20, fontSize: 36, textAlign: 'center' },
  duration: { fontFamily: mono.semiBold, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  cardCaption: { ...typeScale.quote, fontSize: 16, lineHeight: 24 },
  cardFoot: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.4 },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stickerCell: {
    width: 44,
    height: 44,
    borderWidth: hairline,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sticker: { fontSize: 24 },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  footer: { alignItems: 'center', paddingTop: spacing.xs },
});
