import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandHeader, PaperScreen, SectionNav } from '@/components/collage';
import { SocialCard } from '@/components/social/SocialCard';
import { layout, spacing } from '@/theme';

export default function SocialScreen() {
  return (
    <PaperScreen withTopInset>
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <SocialCard />
        </View>
      </ScrollView>
      <SectionNav active="social" />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, gap: spacing.xl, paddingBottom: 104, paddingTop: spacing.lg },
  block: { paddingHorizontal: spacing.lg },
});
