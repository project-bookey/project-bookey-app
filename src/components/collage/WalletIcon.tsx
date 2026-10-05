import Svg, { Path } from 'react-native-svg';

import { iconStroke } from '@/theme/tokens';

/**
 * 지갑 아이콘 — 몸통 네모에 비스듬히 꽂힌 덮개, 오른쪽 끝에 여밈. 책갈피·엽서·우표를 한데 묶는 그림이라
 * 헤더 오른쪽 위 재화 단추가 쓴다(2026-10-05 사용자 결정, 책갈피 칩을 대신한다). lucide 의 Wallet 은 둥근 획이라
 * 헤더의 다른 각진 아이콘(말풍선·종)과 맞춰 직접 그린다. lucide 아이콘과 같은 모양의 props(size·color)를 받는다.
 */
export function WalletIcon({ size = 24, color }: { size?: number; color: string }) {
  const stroke = { stroke: color, ...iconStroke };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M3.5 8h17v12h-17z" {...stroke} />
      <Path d="M3.5 8L16 4.5V8" {...stroke} />
      <Path d="M20.5 12h-5v4h5" {...stroke} />
    </Svg>
  );
}
