import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { clubCommunityApi } from '@/api/endpoints';
import { PaperScreen, SearchGlyph } from '@/components/collage';
import { KeyboardArea } from '@/components/keyboard';
import { Button, EmptyState, Loading, TextLink } from '@/components/ui';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

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

type Row = { key: string; title: string; sub: string; value: PlacePick };

/**
 * 장소 찾기 — 새 모임 폼의 장소 칸을 누르면 바로 뜨는 전체 화면 검색. 탐색 화면처럼 검색바 · '취소'를 맨 위에 두고,
 * 적는 대로 장소 이름(카페·서점 …)을 찾는다. 찾는 곳이 없으면 같은 검색어를 주소로 다시 찾는다 — 주소 검색은
 * 공개 지도 서비스 정책상 자동완성으로 부르지 않고 '주소로 찾기'를 눌렀을 때만 부른다. 결과를 누르면 그 장소를 고르고 닫힌다.
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
  /** '주소로 찾기'를 누른 검색어 — 있으면 주소 결과를 보여 준다. 다시 적기 시작하면 이름 검색으로 돌아간다. */
  const [addressKeyword, setAddressKeyword] = useState<string | null>(null);
  /** 포커스 표시는 입력창(웹 기본 outline) 대신 검색바 테두리로 그린다. */
  const [focused, setFocused] = useState(false);

  // 400ms 디바운스 — 입력이 멈추면 검색어 확정(탐색 화면과 같다).
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(input.trim()), 400);
    return () => clearTimeout(timer);
  }, [input]);

  const typed = input.trim();
  const byAddress = addressKeyword != null;
  const searching = keyword.length >= 2;
  const places = useQuery({
    queryKey: ['clubPlaces', clubId, keyword],
    queryFn: () => clubCommunityApi.searchPlaces(clubId, keyword),
    enabled: searching && !byAddress,
  });
  const addresses = useQuery({
    queryKey: ['clubAddresses', clubId, addressKeyword],
    queryFn: () => clubCommunityApi.searchAddresses(clubId, addressKeyword ?? ''),
    enabled: byAddress,
  });

  const changeInput = (value: string) => {
    setInput(value);
    setAddressKeyword(null);
  };
  const searchAddress = () => {
    if (typed.length >= 2) setAddressKeyword(typed);
  };

  const query = byAddress ? addresses : places;
  const loading = byAddress ? addresses.isFetching : searching && places.isFetching;
  const rows: Row[] = byAddress
    ? (addresses.data ?? []).map((a, i) => ({
        key: `address-${a.latitude}-${a.longitude}-${i}`,
        title: a.buildingName || a.roadAddress || a.address,
        sub: a.address,
        value: {
          placeName: a.buildingName,
          address: a.roadAddress || a.address,
          latitude: a.latitude,
          longitude: a.longitude,
        },
      }))
    : (places.data ?? []).map((p) => ({
        key: `place-${p.id}`,
        title: p.name,
        sub: p.roadAddress || p.address,
        value: {
          placeName: p.name,
          address: p.roadAddress || p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          mapUrl: p.mapUrl || undefined,
        },
      }));

  // 결과가 없을 때 — 검색 전 안내 / 오류(다시 시도) / 빈 결과(이름 검색이면 주소로 찾기를 권한다).
  const empty = () => {
    if (loading) return <Loading />;
    if (!byAddress && !searching) {
      return <EmptyState title="어디서 만날까요?" description="카페·서점 이름이나 주소를 적어 주세요." />;
    }
    if (query.isError) {
      return (
        <EmptyState
          title={byAddress ? '주소를 찾지 못했어요' : '장소를 찾지 못했어요'}
          description="잠시 후 다시 시도해 주세요."
          action={<Button label="다시 시도" variant="outline" onPress={() => query.refetch()} />}
        />
      );
    }
    return byAddress ? (
      <EmptyState title="찾은 주소가 없어요" description="도로명이나 건물명을 조금 다르게 적어 보세요." />
    ) : (
      <EmptyState
        title="찾은 곳이 없어요"
        description="이름을 조금 다르게 적거나 주소로 찾아 보세요."
        action={<Button label="주소로 찾기" variant="outline" onPress={searchAddress} />}
      />
    );
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
              onChangeText={changeInput}
              onSubmitEditing={() => setKeyword(typed)}
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
          data={loading ? [] : rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            byAddress && !loading && rows.length > 0 ? (
              <Text style={[typeScale.monoLabel, styles.listHead, { color: colors.textFaint }]}>주소로 찾은 곳</Text>
            ) : null
          }
          ListEmptyComponent={empty()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.value)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} 선택`}
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
            >
              <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{item.title}</Text>
              {/* 건물 이름 없이 찾은 주소는 제목이 곧 주소라 아랫줄을 되풀이하지 않는다. */}
              {item.sub !== item.title ? (
                <Text numberOfLines={2} style={[typeScale.caption, { color: colors.textMuted }]}>{item.sub}</Text>
              ) : null}
            </Pressable>
          )}
          ListFooterComponent={
            !byAddress && !loading && rows.length > 0 ? (
              <View style={styles.footer}>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>찾는 곳이 없나요?</Text>
                <TextLink label="주소로 찾기" kind="action" onPress={searchAddress} />
              </View>
            ) : null
          }
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
  listHead: { paddingBottom: spacing.xs },
  row: { paddingVertical: spacing.md, gap: 2, borderBottomWidth: hairline },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
});
