import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { radius, sans, serif, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';
import { TEXT_SIZE, type SpeechElement as SpeechEl } from '../noteDoc';

/** 말풍선 꼬리 크기(논리 단위). 꼬리는 박스 아래로 튀어나오므로 요소 높이에 포함시킨다. */
const TAIL = { w: 16, h: 14 };

/**
 * 말풍선 — 클럽에서 누가 무슨 말을 했는지 남긴다. 아바타·닉네임은 삽입할 때 멤버에서 복사해 문서에 박는다
 * (나중에 멤버가 나가도 기록은 그대로). 본문 색은 가독성을 위해 고정(text).
 */
export function SpeechElement({ element, scale }: { element: SpeechEl; scale: number }) {
  const { colors } = useTheme();
  const w = element.w * scale;
  const fontSize = TEXT_SIZE[element.size] * scale;
  const pad = 12 * scale;
  const avatar = 28 * scale;
  const tailW = TAIL.w * scale;
  const tailH = TAIL.h * scale;
  const tailOffset = pad * 1.5;
  return (
    <View style={{ width: w, paddingBottom: tailH }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: hairline,
          borderColor: colors.lineStrong,
          // 노트 위 말풍선 — 앱의 카드(md)가 둥글어져도 노트 요소는 예전 모서리(4)를 지킨다.
          borderRadius: radius.badge,
          padding: pad,
          gap: 6 * scale,
        }}
      >
        <View style={[styles.head, { gap: 6 * scale }]}>
          <Avatar uri={element.avatarUrl} nickname={element.nickname} size={avatar} />
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontFamily: mono.medium, fontSize: 11 * scale, color: colors.textMuted }}
          >
            {element.nickname}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: element.font === 'serif' ? serif.regular : sans.regular,
            fontSize,
            lineHeight: fontSize * 1.4,
            color: colors.text,
          }}
        >
          {element.text.length > 0 ? element.text : ' '}
        </Text>
      </View>
      <Svg
        width={tailW}
        height={tailH}
        viewBox={`0 0 ${TAIL.w} ${TAIL.h}`}
        style={[styles.tail, element.tail === 'left' ? { left: tailOffset } : { right: tailOffset }]}
      >
        {/* 위 변은 그리지 않는다 — 말풍선 테두리 위에 겹쳐 앉아 하나로 이어져 보이게. */}
        <Path
          d={element.tail === 'left' ? `M0 0L5 ${TAIL.h}L${TAIL.w} 0` : `M0 0L${TAIL.w - 5} ${TAIL.h}L${TAIL.w} 0`}
          fill={colors.surface}
          stroke={colors.lineStrong}
          strokeWidth={hairline}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  tail: { position: 'absolute', bottom: 1 },
});
