import {
  Eraser, Hand, Image as ImageIcon, MessageSquare, MousePointer2, Pen, Quote, Sticker, Type, type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { ToolIcon } from './NoteIcons';
import { PenSwatches } from './PenSwatches';
import { PEN_WIDTHS, type PenWidth } from './noteDoc';
import type { PenState } from './useInkGesture';

export type NoteTool = 'hand' | 'select' | 'pen' | 'eraser';
export type InsertKind = 'text' | 'sticker' | 'photo' | 'speech' | 'quote';
/** 옛 모임 노트북의 삽입 4종 — inserts 를 생략하면 이 줄을 그린다. */
export const DEFAULT_INSERTS: readonly InsertKind[] = ['text', 'sticker', 'photo', 'speech'];

const TOOLS: { key: NoteTool; icon: LucideIcon; label: string }[] = [
  { key: 'hand', icon: Hand, label: '보기' },
  { key: 'select', icon: MousePointer2, label: '선택' },
  { key: 'pen', icon: Pen, label: '펜' },
  { key: 'eraser', icon: Eraser, label: '지우개' },
];
const INSERTS: { key: InsertKind; icon: LucideIcon; label: string }[] = [
  { key: 'text', icon: Type, label: '텍스트' },
  { key: 'sticker', icon: Sticker, label: '스티커' },
  { key: 'photo', icon: ImageIcon, label: '사진' },
  { key: 'speech', icon: MessageSquare, label: '말풍선' },
  { key: 'quote', icon: Quote, label: '문장' },
];

/**
 * 하단 도구 줄 — 왼쪽 네 개는 모드(보기·선택·펜·지우개), 오른쪽은 삽입 동작(시트를 연다). 삽입 종류는 inserts 로 고른다
 * (독후감 노트는 텍스트·스티커·사진·문장 조각처럼).
 * 활성 모드는 잉크로 찍은 도장처럼 반전한다. 펜·지우개일 땐 위에 펜 줄(색·굵기)이 하나 더 뜬다.
 */
export function NoteToolbar({ tool, onTool, pen, onPen, onInsert, photoDisabled = false, inserts = DEFAULT_INSERTS }: {
  tool: NoteTool;
  onTool: (tool: NoteTool) => void;
  pen: PenState;
  onPen: (patch: Partial<PenState>) => void;
  onInsert: (kind: InsertKind) => void;
  photoDisabled?: boolean;
  /** 보일 삽입 종류와 순서. */
  inserts?: readonly InsertKind[];
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      {tool === 'pen' || tool === 'eraser' ? <PenBar tool={tool} pen={pen} onPen={onPen} /> : null}
      <View style={styles.row}>
        {TOOLS.map((t) => (
          <ToolButton key={t.key} icon={t.icon} label={t.label} active={tool === t.key} onPress={() => onTool(t.key)} />
        ))}
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        {inserts.map((k) => INSERTS.find((i) => i.key === k)!).map((i) => (
          <ToolButton
            key={i.key}
            icon={i.icon}
            label={i.label}
            disabled={i.key === 'photo' && photoDisabled}
            onPress={() => onInsert(i.key)}
          />
        ))}
      </View>
    </View>
  );
}

function ToolButton({ icon, label, active = false, disabled = false, onPress }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        styles.btn,
        active ? { backgroundColor: colors.ink } : null,
        disabled ? styles.disabled : null,
        pressed && !active && !disabled ? pressedStyle : null,
      ]}
    >
      <ToolIcon icon={icon} color={active ? colors.onInk : colors.text} />
    </Pressable>
  );
}

/** 펜 줄 — 색 6종(네모 스와치, 선택은 글자색 테두리)과 굵기 3종. 지우개는 안내 문구만. */
function PenBar({ tool, pen, onPen }: { tool: 'pen' | 'eraser'; pen: PenState; onPen: (patch: Partial<PenState>) => void }) {
  const { colors } = useTheme();
  if (tool === 'eraser') {
    return (
      <View style={[styles.penBar, { borderBottomColor: colors.line }]}>
        <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>획을 눌러 지워요</Text>
      </View>
    );
  }
  return (
    <View style={[styles.penBar, { borderBottomColor: colors.line }]}>
      <PenSwatches value={pen.color} onChange={(color) => onPen({ color })} />
      <View style={styles.widths}>
        {PEN_WIDTHS.map((w: PenWidth) => {
          const selected = pen.width === w;
          return (
            <Pressable
              key={w}
              onPress={() => onPen({ width: w })}
              accessibilityRole="button"
              accessibilityLabel={`펜 굵기 ${w}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.widthBtn,
                selected ? { backgroundColor: colors.ink } : null,
                pressed && !selected ? pressedStyle : null,
              ]}
            >
              <Svg width={28} height={16}>
                <Line x1={4} y1={8} x2={24} y2={8} stroke={selected ? colors.onInk : colors.text} strokeWidth={w / 2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: hairline },
  row: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  rule: { width: hairline, height: 24, marginHorizontal: spacing.xs },
  penBar: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    minHeight: 44,
  },
  widths: { flexDirection: 'row', gap: spacing.xs },
  widthBtn: { width: 36, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
