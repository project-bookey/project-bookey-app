import { Text } from 'react-native';

import { sans, serif, useTheme } from '@/theme';
import { noteMono } from '@/theme/tokens';
import { TEXT_SIZE, penColorOf, type NoteFont, type TextElement as TextEl } from '../noteDoc';

export function fontFamilyOf(font: NoteFont): string {
  if (font === 'serif') return serif.regular;
  if (font === 'mono') return noteMono;
  return sans.regular;
}

/** 타이핑 텍스트 — 폭만 저장하고 높이는 줄바꿈 결과를 그대로 쓴다. 빈 글도 한 줄 높이는 차지해야 선택 프레임이 잡힌다. */
export function TextElement({ element, scale }: { element: TextEl; scale: number }) {
  const { colors } = useTheme();
  const fontSize = TEXT_SIZE[element.size] * scale;
  return (
    <Text
      style={{
        width: element.w * scale,
        fontFamily: fontFamilyOf(element.font),
        fontSize,
        lineHeight: fontSize * 1.4,
        color: penColorOf(colors)[element.color],
        textAlign: element.align,
      }}
    >
      {element.text.length > 0 ? element.text : ' '}
    </Text>
  );
}
