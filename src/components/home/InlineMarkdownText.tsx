import { Text, type StyleProp, type TextStyle } from 'react-native';

type Segment = {
  text: string;
  bold: boolean;
};

export function InlineMarkdownText({
  text,
  strongStyle,
}: {
  text: string;
  strongStyle?: StyleProp<TextStyle>;
}) {
  return (
    <>
      {parseBoldSegments(text).map((segment, index) =>
        segment.bold ? (
          <Text key={`${segment.text}-${index}`} style={strongStyle}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

function parseBoldSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false });
  return segments.length > 0 ? segments : [{ text, bold: false }];
}
