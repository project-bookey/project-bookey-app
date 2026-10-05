import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { clubCommunityApi } from '@/api/endpoints';
import { PinMap } from '@/components/club/PlaceMap';
import { PaperScreen, SearchGlyph } from '@/components/collage';
import { KeyboardArea } from '@/components/keyboard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

// 웹 전용: 브라우저 기본 포커스 링 제거 — 포커스는 검색바 테두리로 그린다(탐색 화면과 같다).
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** 고른 장소 — 새 모임 폼의 장소명 · 주소 · 지도를 한 번에 채운다. */
export type PlacePick = {
  /** 주소로 찾은 곳은 건물 이름이 없을 수 있다(빈 문자열) — 폼이 기본 이름을 넣는다. */
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
  mapUrl?: string;
};

type Row = { key: string; no: number; kind: 'place' | 'address'; title: string; sub: string; value: PlacePick };

/** 입력이 이만큼 멈추면 찾는다(탐색 화면과 같다). */
const PLACE_DEBOUNCE_MS = 400;

/**
 * 장소 찾기 — 새 모임 폼의 장소 칸을 누르면 바로 뜨는 전체 화면 검색. 탐색 화면처럼 검색바 · '취소'를 맨 위에 두고,
 * 적는 대로 장소 이름(카페·서점 …)과 주소를 함께 찾아, 결과를 번호 핀으로 지도에 찍고 그 아래 같은 번호로 늘어놓는다
 * (주소는 '주소로 찾은 곳'으로 이름 결과 뒤에). 결과를 누르면 그 장소를 고르고 닫힌다.
 */
export function PlaceSearchModal({ clubId, visible, onClose, onSelect }: {
  clubId: number;
  visible: boolean;
  onClose: () => void;
  onSelect: (value: PlacePick) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* 열 때마다 새 검색으로 — 안쪽 부품이 모달과 함께 새로 붙어 지난 검색어가 남지 않는다. */}
      <PlaceSearchBody clubId={clubId} onClose={onClose} onSelect={onSelect} />
    </Modal>
  );
}

function PlaceSearchBody({ clubId, onClose, onSelect }: {
  clubId: number;
  onClose: () => void;
  onSelect: (value: PlacePick) => void;
}) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  /** 포커스 표시는 입력창(웹 기본 outline) 대신 검색바 테두리로 그린다. */
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(input.trim()), PLACE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // 이름과 주소를 한 번에 찾는다 — 둘이 함께 바뀌어야 목록과 지도가 한 번만 다시 그려진다. 한쪽만 실패하면 그쪽은 빈
  // 결과로 두고, 둘 다 실패해야 오류. 다음 검색어를 찾는 동안은 지난 결과를 그대로 둬 지도가 깜빡이지 않는다.
  const searching = keyword.length >= 2;
  const search = useQuery({
    queryKey: ['clubPlaceSearch', clubId, keyword],
    queryFn: async () => {
      const [places, addresses] = await Promise.allSettled([
        clubCommunityApi.searchPlaces(clubId, keyword),
        clubCommunityApi.searchAddresses(clubId, keyword),
      ]);
      if (places.status === 'rejected' && addresses.status === 'rejected') throw places.reason;
      return {
        places: places.status === 'fulfilled' ? places.value : [],
        addresses: addresses.status === 'fulfilled' ? addresses.value : [],
      };
    },
    enabled: searching,
    placeholderData: keepPreviousData,
  });

  const loading = searching && search.isPending;
  const found = searching ? search.data : undefined;
  const rows: Row[] = [
    ...(found?.places ?? []).map((p) => ({
      key: `place-${p.id}`,
      kind: 'place' as const,
      title: p.name,
      sub: p.roadAddress || p.address,
      value: {
        placeName: p.name,
        address: p.roadAddress || p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        mapUrl: p.mapUrl || undefined,
      },
    })),
    ...(found?.addresses ?? []).map((a, i) => ({
      key: `address-${a.latitude}-${a.longitude}-${i}`,
      kind: 'address' as const,
      // 건물 이름이 있으면 이름 · 도로명, 없으면 도로명 · 지번.
      title: a.buildingName || a.roadAddress || a.address,
      sub: a.buildingName ? a.roadAddress || a.address : a.address,
      value: {
        placeName: a.buildingName,
        address: a.roadAddress || a.address,
        latitude: a.latitude,
        longitude: a.longitude,
      },
    })),
  ].map((row, i) => ({ ...row, no: i + 1 }));
  const firstAddress = rows.findIndex((row) => row.kind === 'address');

  // 결과가 없을 때 — 검색 전 안내 / 오류(다시 시도) / 빈 결과.
  const empty = () => {
    if (loading) return <Loading />;
    if (!searching) {
      return <EmptyState title="어디서 만날까요?" description="카페·서점 이름이나 주소를 적어 주세요." />;
    }
    if (search.isError) {
      return (
        <EmptyState
          title="장소를 찾지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={<Button label="다시 시도" variant="outline" onPress={() => search.refetch()} />}
        />
      );
    }
    return <EmptyState title="찾은 곳이 없어요" description="이름이나 주소를 조금 다르게 적어 보세요." />;
  };

  return (
    // 헤더 없는 전체 화면이라 상단 세이프에어리어를 직접 민다(탐색 화면과 같다).
    <PaperScreen withTopInset>
      {/* 결과 목록이 키보드 위에서 끝나게 — 키보드에 가린 아래쪽 결과도 스크롤로 닿는다. */}
      <KeyboardArea>
        <View style={styles.searchBarWrap}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.surfaceRaised, borderColor: focused ? colors.ink : 'transparent' },
            ]}
          >
            <SearchGlyph color={colors.textMuted} />
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => setKeyword(input.trim())}
              placeholder="카페·서점 이름이나 주소"
              placeholderTextColor={colors.textFaint}
              returnKeyType="search"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="장소 검색"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, webNoOutline, { color: colors.text }]}
            />
          </View>
          {/* 나갈 길은 검색바 옆 '취소' — 탐색 화면과 같은 자리 · 같은 말. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, pressed && pressedStyle]}
          >
            <Text style={[typeScale.label, { color: colors.textMuted }]}>취소</Text>
          </Pressable>
        </View>

        {/* 키보드가 떠 있어도 결과 첫 탭이 먹히도록 handled — 기본값은 첫 탭을 키보드 닫기로만 쓴다. */}
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // 찾은 곳을 번호 핀으로 — 목록 번호와 같다. 목록과 함께 스크롤돼 아래 결과를 볼 땐 비켜 준다.
          ListHeaderComponent={
            rows.length > 0 ? (
              <View style={styles.map}>
                <PinMap
                  height={180}
                  pins={rows.map((row) => ({
                    key: row.key,
                    latitude: row.value.latitude,
                    longitude: row.value.longitude,
                    label: String(row.no),
                  }))}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={empty()}
          renderItem={({ item, index }) => (
            <>
              {index === firstAddress ? (
                <Text style={[typeScale.monoLabel, styles.listHead, { color: colors.textFaint }]}>주소로 찾은 곳</Text>
              ) : null}
              <Pressable
                onPress={() => onSelect(item.value)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 선택`}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
              >
                <Text style={[styles.no, { color: colors.textMuted }]}>{item.no}</Text>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{item.title}</Text>
                  {/* 건물 이름 없이 찾은 주소는 제목이 곧 주소라 아랫줄을 되풀이하지 않는다. */}
                  {item.sub && item.sub !== item.title ? (
                    <Text numberOfLines={2} style={[typeScale.caption, { color: colors.textMuted }]}>{item.sub}</Text>
                  ) : null}
                </View>
              </Pressable>
            </>
          )}
        />
      </KeyboardArea>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  searchBarWrap: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: spacing.md },
  cancel: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  map: { paddingBottom: spacing.sm },
  listHead: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  // 번호 · 이름/주소 한 줄 — 번호는 지도 핀과 짝을 맞추는 표시라 작게.
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: hairline },
  no: { width: 20, paddingTop: 2, fontFamily: mono.semiBold, fontSize: 12, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
});
