import { Children, cloneElement, isValidElement, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Renderer, useMarkdown } from 'react-native-marked';
import type { RendererInterface } from 'react-native-marked';

import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import type { ColorTokens } from '@/theme';
import { mono, serif } from '@/theme/tokens';

/**
 * 독후감 본문 마크다운 — 콜라주 활자로 그린다.
 *
 * react-native-marked 는 이 파일만 안다. 라이브러리의 기본 스타일은 쓰지 않고 렌더러가
 * 토큰마다 우리 활자·색을 직접 입힌다(Parser 가 넘기는 styles 인자는 무시한다 — 라이브러리
 * 기본 팔레트라 우리 테마와 맞지 않는다). 인라인 강조는 RN Text 중첩 상속에 기댄다:
 * 굵게 안의 기울임은 부모의 명조 볼드를 물려받고 fontStyle 만 얹는다.
 */

/** 표제 단계별 크기 — h4~h6 은 h3 와 같다. */
const HEADING_SIZE: Record<number, { fontSize: number; lineHeight: number }> = {
  1: { fontSize: 22, lineHeight: 30 },
  2: { fontSize: 19, lineHeight: 26 },
  3: { fontSize: 17, lineHeight: 24 },
};

/** http/https 만 연다 — mailto·javascript: 같은 스킴은 무시한다. */
function openHttpLink(href: string) {
  if (!/^https?:\/\//i.test(href)) return;
  Linking.openURL(href).catch(() => {});
}

/**
 * 인용 안의 본문을 뮤트 색으로 바꾼다.
 * Parser 는 인용의 자식(문단·목록)을 먼저 그려서 넘기므로 인용 차례에는 이미 색이 박혀 있다.
 * 본문 색(colors.text)을 가진 Text 만 골라 색을 갈아 끼우고, 링크(악센트)는 그대로 둔다.
 */
type TintableProps = { style?: StyleProp<TextStyle>; children?: ReactNode };
function tintText(node: ReactNode, from: string, to: string): ReactNode {
  if (!isValidElement<TintableProps>(node)) return node;
  const children = Children.map(node.props.children, (child) => tintText(child, from, to));
  const recolor = node.type === Text && StyleSheet.flatten(node.props.style)?.color === from;
  return cloneElement(node, recolor ? { style: [node.props.style, { color: to }], children } : { children });
}

class CollageRenderer extends Renderer implements RendererInterface {
  constructor(private readonly colors: ColorTokens) {
    super();
  }

  paragraph(children: ReactNode[]): ReactNode {
    return <View key={this.getKey()} style={styles.paragraph}>{children}</View>;
  }

  blockquote(children: ReactNode[]): ReactNode {
    const { text, textMuted, accent } = this.colors;
    return (
      <View key={this.getKey()} style={[styles.blockquote, { borderLeftColor: accent }]}>
        {children.map((child) => tintText(child, text, textMuted))}
      </View>
    );
  }

  heading(text: string | ReactNode[], _styles?: TextStyle, depth = 3): ReactNode {
    const size = HEADING_SIZE[Math.min(depth, 3)];
    return (
      <Text key={this.getKey()} selectable style={[typeScale.titleSerif, size, styles.heading, { color: this.colors.text }]}>
        {text}
      </Text>
    );
  }

  code(text: string): ReactNode {
    const { surfaceDeep, line, text: color } = this.colors;
    return (
      <View key={this.getKey()} style={[styles.codeBlock, { backgroundColor: surfaceDeep, borderColor: line }]}>
        <Text selectable style={[styles.code, styles.codeBlockText, { color }]}>{text}</Text>
      </View>
    );
  }

  hr(): ReactNode {
    return <View key={this.getKey()} style={[styles.hr, { backgroundColor: this.colors.line }]} />;
  }

  listItem(children: ReactNode[]): ReactNode {
    return <View key={this.getKey()} style={styles.listItem}>{children}</View>;
  }

  list(ordered: boolean, li: ReactNode[], _listStyle?: ViewStyle, _textStyle?: TextStyle, startIndex = 1): ReactNode {
    return (
      <View key={this.getKey()} style={styles.list}>
        {li.map((item, index) => (
          <View key={index} style={styles.listRow}>
            <Text style={[typeScale.monoNumeral, styles.marker, { color: this.colors.textMuted }]}>
              {ordered ? `${startIndex + index}.` : '·'}
            </Text>
            {item}
          </View>
        ))}
      </View>
    );
  }

  escape(text: string): ReactNode {
    return <Text key={this.getKey()}>{text}</Text>;
  }

  link(children: string | ReactNode[], href: string, _styles?: TextStyle, title?: string): ReactNode {
    return (
      <Text
        key={this.getKey()}
        accessibilityRole="link"
        accessibilityLabel={title || undefined}
        onPress={() => openHttpLink(href)}
        style={[styles.link, { color: this.colors.accent }]}
      >
        {children}
      </Text>
    );
  }

  image(uri: string, alt?: string, _style?: ImageStyle, title?: string): ReactNode {
    return (
      <Image
        key={this.getKey()}
        source={{ uri }}
        resizeMode="cover"
        style={styles.image}
        accessibilityLabel={alt || title || '이미지'}
      />
    );
  }

  strong(children: string | ReactNode[]): ReactNode {
    return <Text key={this.getKey()} style={styles.strong}>{children}</Text>;
  }

  em(children: string | ReactNode[]): ReactNode {
    return <Text key={this.getKey()} style={styles.em}>{children}</Text>;
  }

  codespan(text: string): ReactNode {
    const { surfaceDeep, line } = this.colors;
    return (
      <Text key={this.getKey()} style={[styles.code, styles.codespan, { backgroundColor: surfaceDeep, borderColor: line }]}>
        {text}
      </Text>
    );
  }

  del(children: string | ReactNode[]): ReactNode {
    return <Text key={this.getKey()} style={styles.del}>{children}</Text>;
  }

  /**
   * 문자열이면 인라인 잎 — 스타일 없이 부모 Text 를 물려받는다(굵게 안의 글자가 다시 보통체로
   * 돌아가지 않게). 배열이면 문단·목록 항목의 본문 묶음 — 여기서 본문 활자·색을 입힌다.
   */
  text(text: string | ReactNode[]): ReactNode {
    if (typeof text === 'string') return <Text key={this.getKey()}>{text}</Text>;
    return <Text key={this.getKey()} selectable style={[styles.body, { color: this.colors.text }]}>{text}</Text>;
  }

  /** HTML 은 해석하지 않고 원문 그대로 보여 준다. */
  html(text: string | ReactNode[]): ReactNode {
    return <Text key={this.getKey()} selectable style={[styles.body, { color: this.colors.text }]}>{text}</Text>;
  }

  linkImage(href: string, imageUrl: string, alt?: string, style?: ImageStyle, title?: string | null): ReactNode {
    return (
      <Pressable key={this.getKey()} accessibilityRole="link" accessibilityLabel={alt || title || '이미지 링크'} onPress={() => openHttpLink(href)}>
        {this.image(imageUrl, alt, style, title ?? undefined)}
      </Pressable>
    );
  }

  /** 표는 격자 대신 텍스트 줄로 — 셀을 ' | ' 로 잇고 줄마다 개행한다. */
  table(header: ReactNode[][], rows: ReactNode[][][]): ReactNode {
    const line = (cells: ReactNode[][], key: string, bold: boolean) => (
      <Text key={key} style={bold ? styles.strong : undefined}>
        {cells.map((cell, i) => (
          <Text key={i}>{i > 0 ? ' | ' : ''}{cell}</Text>
        ))}
      </Text>
    );
    return (
      <Text key={this.getKey()} selectable style={[styles.body, { color: this.colors.text }]}>
        {line(header, 'head', true)}
        {rows.map((cells, i) => [
          '\n',
          line(cells, `row-${i}`, false),
        ])}
      </Text>
    );
  }
}

/** 독후감 본문. FlatList 헤더 안에 놓이므로 자체 스크롤 없이 블록을 세로로 쌓기만 한다. */
export function PostMarkdown({ md }: { md: string }) {
  const { colors } = useTheme();
  const renderer = useMemo(() => new CollageRenderer(colors), [colors]);
  const elements = useMarkdown(md, { renderer });
  return <View style={styles.root}>{elements}</View>;
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  // 본문 — 인용 토큰을 15/26 으로 줄인 명조.
  body: { ...typeScale.quote, fontSize: 15, lineHeight: 26 },
  paragraph: { gap: spacing.sm },
  heading: { marginTop: spacing.lg },
  strong: { fontFamily: serif.bold },
  // 명조에 이탤릭 면이 없어 합성 기울임에 기댄다 — 웹에서 확인한 값.
  em: { fontStyle: 'italic' },
  del: { textDecorationLine: 'line-through' },
  link: { textDecorationLine: 'underline' },
  // QuoteCard 의 인용 본문과 같은 왼쪽 악센트 선.
  blockquote: { borderLeftWidth: 2, paddingLeft: 11, gap: spacing.md },
  list: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'flex-start' },
  listItem: { flex: 1, gap: spacing.xs },
  // 들여쓰기 16 — 두 자리 번호는 오른쪽 여백만큼 자연히 넓어진다.
  marker: { minWidth: 16, paddingRight: spacing.xs, lineHeight: 26 },
  code: { fontFamily: mono.regular, fontSize: 13 },
  codeBlock: {
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  codeBlockText: { lineHeight: 20 },
  codespan: { borderWidth: hairline, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  hr: { height: hairline },
  image: { width: '100%', height: 200, borderRadius: radius.sm },
});
