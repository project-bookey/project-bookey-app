import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { clubApi } from '@/api/endpoints';
import { prepareImage } from '@/api/upload';
import { PaperScreen, SubHeader } from '@/components/collage';
import { clubLogKeys, kstTime, todayKst } from '@/components/clubLog';
import { Button, Card, Eyebrow, Toggle, formatDuration } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono, serif } from '@/theme/tokens';

const BODY_MAX = 100;

type PickedPhoto = { uri: string; width?: number; height?: number };

/**
 * 한 조각 남기기 — 타이머를 끝내면 바로 들어온다(보드의 '한 조각 남기기'로도 온다).
 *
 * 사진 한 장(선택) + 한 줄. 방금 읽은 마지막 쪽에 붙이면 그 쪽까지 읽은 멤버에게만 보인다 —
 * 책 본문이 찍혀도 스포일러가 새지 않게 기본값은 켜 둔다.
 */
export default function ClubLogNewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, cardShadow } = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    sessionId?: string;
    startPage?: string;
    endPage?: string;
    durationSec?: string;
  }>();
  const clubId = Number(params.id);
  const sessionId = params.sessionId ? Number(params.sessionId) : undefined;
  const endPage = params.endPage ? Number(params.endPage) : undefined;
  const startPage = params.startPage ? Number(params.startPage) : undefined;
  const durationSec = params.durationSec ? Number(params.durationSec) : undefined;
  const fromSession = sessionId != null;

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [body, setBody] = useState('');
  const [anchor, setAnchor] = useState(endPage != null);
  const [notice, setNotice] = useState<string | null>(null);

  const today = useQuery({
    queryKey: clubLogKeys.day(clubId, todayKst()),
    queryFn: () => clubApi.logs(clubId, todayKst()),
    enabled: Number.isFinite(clubId),
  });

  const leave = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/club/${clubId}`);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    setNotice(null);
    // 웹은 권한 창이 없다 — 파일 선택 창(모바일 웹은 카메라 포함)으로 열린다.
    if (Platform.OS !== 'web') {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice(source === 'camera'
          ? '카메라 권한이 없어요. 설정에서 허용하면 바로 찍을 수 있어요.'
          : '사진 보관함 권한이 없어요. 설정에서 허용해 주세요.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const submit = useMutation({
    mutationFn: async () => {
      // 사진은 서버 제한(10MB·JPEG/PNG/WebP)에 맞춰 줄여 file 파트로 담는다 — 독후감 업로드와 같은 준비 과정.
      const form = photo ? await prepareImage(photo) : new FormData();
      const text = body.trim();
      if (text) form.append('body', text);
      if (anchor && endPage != null) {
        form.append('anchorPage', String(endPage));
        form.append('spoilerLevel', 'PAGE');
      } else {
        form.append('spoilerLevel', 'NONE');
      }
      if (sessionId != null) form.append('readingSessionId', String(sessionId));
      return clubApi.createLog(clubId, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubLogKeys.all(clubId) });
      // 보드에서 왔으면 그 보드로 돌아가고(스택에 보드가 두 겹 쌓이지 않게), 타이머에서 왔으면 보드로 바꾼다.
      router.dismissTo(`/club/${clubId}/log`);
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : '조각을 붙이지 못했어요 · 다시 시도'),
  });

  const canSubmit = (photo != null || body.trim().length > 0) && !submit.isPending;
  const nth = (today.data?.summary.logCount ?? 0) + 1;

  return (
    <PaperScreen>
      <SubHeader
        category="한 조각 남기기"
        right={
          <Pressable onPress={leave} hitSlop={12} accessibilityRole="button">
            <Text style={[typeScale.label, { color: colors.textMuted, fontSize: 12 }]}>건너뛰기</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {fromSession ? (
          <Card style={styles.summary}>
            <SummaryCell label="방금 읽은 시간" value={formatDuration(durationSec)} colors={colors} />
            <View style={[styles.vRule, { backgroundColor: colors.line }]} />
            <SummaryCell
              label="읽은 쪽"
              value={startPage != null && endPage != null ? `${startPage}–${endPage}` : endPage != null ? `~${endPage}` : '—'}
              colors={colors}
            />
            <View style={[styles.vRule, { backgroundColor: colors.line }]} />
            <SummaryCell label="오늘 조각" value={`${nth}번째`} colors={colors} accent />
          </Card>
        ) : null}

        <View style={styles.photoBlock}>
          <View style={[styles.polaroid, { backgroundColor: colors.memoPad }, cardShadow]}>
            <View style={[styles.tape, { backgroundColor: colors.bookPage }]} />
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.photo, styles.viewfinder, { backgroundColor: colors.surfaceDeep }]}>
                {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                  <View key={corner} style={[styles.corner, styles[corner], { borderColor: colors.accent }]} />
                ))}
                <Text style={[styles.viewfinderText, { color: colors.textMuted }]}>지금 눈앞을 한 장</Text>
              </View>
            )}
            <Text style={[styles.caption, { color: body.trim() ? colors.onMemoPad : colors.textFaint }]} numberOfLines={2}>
              {body.trim() || '한 줄을 적으면 여기에 적혀요'}
            </Text>
            <Text style={[styles.meta, { color: colors.mid }]}>
              나 · {kstTime(new Date().toISOString())}{anchor && endPage != null ? ` · ${endPage}쪽` : ''}
            </Text>
          </View>

          <View style={styles.pickRow}>
            <Button label="촬영" size="sm" onPress={() => pick('camera')} />
            <Button label="앨범에서 고르기" size="sm" variant="outline" onPress={() => pick('library')} />
            {photo ? <Button label="사진 빼기" size="sm" variant="outline" onPress={() => setPhoto(null)} /> : null}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Eyebrow plain>한 줄</Eyebrow>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={BODY_MAX}
            placeholder="오늘 여기서 멈췄어요"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.text }]}
            accessibilityLabel="한 줄"
          />
          <Text style={[styles.counter, { color: colors.textFaint }]}>{body.length}/{BODY_MAX}</Text>
        </View>

        {endPage != null ? (
          <Toggle
            label={`${endPage}쪽에 붙이기`}
            description={`${endPage}쪽까지 읽은 멤버에게만 보여요. 책 본문이 찍혀도 스포일러 걱정 없이.`}
            value={anchor}
            onChange={setAnchor}
          />
        ) : null}

        {notice ? (
          <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">{notice}</Text>
        ) : null}

        <Button
          label="모임 보드에 붙이기"
          onPress={() => submit.mutate()}
          loading={submit.isPending}
          disabled={!canSubmit}
        />
      </ScrollView>
    </PaperScreen>
  );
}

function SummaryCell({ label, value, colors, accent }: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  accent?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: accent ? colors.accent : colors.text }]}>{value}</Text>
    </View>
  );
}

const CORNER = 22;

const styles = StyleSheet.create({
  container: { ...layout.content, padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  summary: { flexDirection: 'row', alignItems: 'stretch' },
  summaryValue: { fontFamily: mono.semiBold, fontSize: 14 },
  vRule: { width: hairline, marginHorizontal: spacing.md },
  photoBlock: { alignItems: 'center', gap: spacing.lg },
  polaroid: {
    width: '82%',
    maxWidth: 320,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderRadius: radius.sm,
    transform: [{ rotate: '-2deg' }],
  },
  tape: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 64,
    height: 20,
    opacity: 0.4,
    zIndex: 1,
    transform: [{ rotate: '3deg' }],
  },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 1 },
  viewfinder: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2 },
  viewfinderText: { fontFamily: serif.regular, fontSize: 15 },
  caption: { fontFamily: serif.regular, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  meta: { fontFamily: mono.regular, fontSize: 10, letterSpacing: 0.4, marginTop: spacing.xs },
  pickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  input: {
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: serif.regular,
    fontSize: 15,
  },
  counter: { fontFamily: mono.regular, fontSize: 10, alignSelf: 'flex-end' },
});
