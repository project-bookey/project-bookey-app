import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubCommunityApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, EmptyState, Field, Loading } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

export type AddressSelection = {
  address: string;
  roadAddress: string;
  buildingName: string;
  zonecode: string;
  latitude: number;
  longitude: number;
};

/** 주소 검색 — 새 모임 폼에서 여는 전체 화면 모달. 뒤로(←)가 닫기, 결과 행을 누르면 그 주소를 고른다. */
export function AddressSearchModal({ clubId, visible, onClose, onSelect }: {
  clubId: number;
  visible: boolean;
  onClose: () => void;
  onSelect: (value: AddressSelection) => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<AddressSelection[]>([]);
  const [error, setError] = useState('');

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError('');
    try {
      setResults(await clubCommunityApi.searchAddresses(clubId, query.trim()));
    } catch {
      setError('주소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PaperScreen withTopInset>
        <SubHeader category="주소 검색" onBack={onClose} />
        <View style={styles.search}>
          <Field
            label="주소"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="도로명, 건물명 또는 지번"
            autoFocus
          />
          <Button label="검색" onPress={search} disabled={query.trim().length < 2} loading={loading} />
        </View>
        {loading ? (
          <Loading />
        ) : (
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {results.map((r, i) => (
              <Pressable
                key={`${r.latitude}-${r.longitude}-${i}`}
                onPress={() => onSelect(r)}
                accessibilityRole="button"
                accessibilityLabel={`${r.roadAddress || r.address} 선택`}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed ? pressedStyle : null]}
              >
                <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                  {r.buildingName || r.roadAddress || r.address}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>{r.address}</Text>
              </Pressable>
            ))}
            {results.length === 0 ? (
              <EmptyState
                title={error ? '주소를 검색하지 못했어요' : searched ? '찾은 주소가 없어요' : '주소를 입력하고 검색을 눌러 주세요'}
                description={error || (searched ? '도로명이나 건물명을 조금 다르게 적어 보세요.' : undefined)}
              />
            ) : null}
          </ScrollView>
        )}
      </PaperScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { paddingVertical: spacing.md, gap: 2, borderBottomWidth: hairline },
});
