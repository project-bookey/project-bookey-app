import { StyleSheet, View } from 'react-native';

import { PaperScreen, SectionNav } from '@/components/collage';
import { EmptyState } from '@/components/ui';

/** 탭 3. 광장 — 스켈레톤. 본구현은 A8. */
export default function PlazaScreen() {
  return (
    <PaperScreen>
      <SectionNav active="plaza" />
      <View style={styles.body}>
        <EmptyState
          title="광장 준비 중"
          description="곧 다른 독자들의 밑줄이 모입니다."
        />
      </View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
