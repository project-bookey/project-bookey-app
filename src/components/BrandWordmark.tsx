import { Image, type ImageStyle, type StyleProp } from 'react-native';

import type { ThemeMode } from '@/theme';
import { useTheme } from '@/theme';

const WORDMARK_ON_LIGHT = require('../../assets/bookey-title-bookmark-gungsuh-aligned.png');
const WORDMARK_ON_DARK = require('../../assets/bookey-title-bookmark-gungsuh-aligned-dark.png');

/** Theme-aware Bookey wordmark. Dark mode uses the light mark; light mode uses the dark mark. */
export function BrandWordmark({
  width = 110,
  mode: forcedMode,
  style,
}: {
  width?: number;
  /** Fixed-background screens can choose their own contrast variant. */
  mode?: ThemeMode;
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useTheme();
  const mode = forcedMode ?? theme.mode;

  return (
    <Image
      source={mode === 'dark' ? WORDMARK_ON_DARK : WORDMARK_ON_LIGHT}
      style={[{ width, height: width / 3 }, style]}
      resizeMode="contain"
      accessibilityLabel="Bookey"
      accessible
    />
  );
}
