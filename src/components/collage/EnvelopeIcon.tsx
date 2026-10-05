import Svg, { Circle, Path } from 'react-native-svg';

import { iconStroke } from '@/theme/tokens';

/**
 * 봉투 아이콘 — 엽서 목록 줄 왼쪽에서 받은 엽서를 열었는지 보여 준다(2026-10-05 사용자 결정).
 * sealed 는 날개가 접힌 봉투 가운데에 봉인 점, open 은 날개가 젖혀진 봉투에서 엽서가 올라온 모양이다.
 * lucide 의 Mail·MailOpen 은 둥근 획이라 헤더의 다른 각진 아이콘과 맞춰 직접 그린다. lucide 와 같은 props(size·color)를 받는다.
 */
export function EnvelopeIcon({ state, size = 24, color }: { state: 'sealed' | 'open'; size?: number; color: string }) {
  const stroke = { stroke: color, ...iconStroke };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {state === 'sealed' ? (
        <>
          <Path d="M3 6h18v13H3z" {...stroke} />
          <Path d="M3 6l9 7 9-7" {...stroke} />
          <Circle cx={12} cy={13} r={2} fill={color} />
        </>
      ) : (
        <>
          {/* 봉투에서 올라온 엽서 — 아래쪽은 봉투 앞판(V)에 가려 그리지 않는다. */}
          <Path d="M6 12V4h12v8" {...stroke} />
          <Path d="M9 7.5h6" {...stroke} />
          {/* 젖혀진 날개는 엽서 뒤라 양 끝만 보인다. */}
          <Path d="M3 10l3-2.2M21 10l-3-2.2" {...stroke} />
          <Path d="M3 10v10h18V10" {...stroke} />
          <Path d="M3 10l9 6.5 9-6.5" {...stroke} />
        </>
      )}
    </Svg>
  );
}
