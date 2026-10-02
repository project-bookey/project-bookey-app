import Svg, { Circle, Path } from 'react-native-svg';

import { iconStroke } from '@/theme/tokens';

type Props = {
  /** 아이콘 한 변의 길이. */
  size?: number;
  color: string;
};

/**
 * 검색 바 돋보기 — 글자 '⌕' 는 폰트마다 작고 들쭉날쭉하게 나와서 선 아이콘으로 그린다.
 */
export function SearchGlyph({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} {...iconStroke} />
      <Path d="M15.5 15.5L20.5 20.5" stroke={color} {...iconStroke} />
    </Svg>
  );
}
