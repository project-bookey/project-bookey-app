import {
  Eraser, Hand, Image as ImageIcon, MessageSquare, MousePointer2, Pen, Plus, Quote, Sticker, Type, type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { glassFace, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';
import { ToolIcon } from './NoteIcons';
import { NoteSheet } from './NoteSheet';
import { PenSwatches } from './PenSwatches';
import { PEN_WIDTHS, type PenWidth } from './noteDoc';
import type { PenState } from './useInkGesture';

export type NoteTool = 'hand' | 'select' | 'pen' | 'eraser';
export type InsertKind = 'text' | 'sticker' | 'photo' | 'speech' | 'quote';
/** 삽입 기본 줄 — inserts 를 생략하면 이 순서로 그린다. */
export const DEFAULT_INSERTS: readonly InsertKind[] = ['text', 'sticker', 'photo', 'speech', 'quote'];

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
 * iOS 는 시트(Modal)가 내려가는 동안 다음 시트·사진 선택 창을 띄우지 못한다 — 삽입 시트가 다 내려간 뒤에 넘긴다.
 * 안드로이드·웹은 바로 넘긴다(웹 파일 선택 창은 누른 그 순간에 열어야 막히지 않는다).
 */
const SHEET_HANDOFF_MS = 500;

/**
 * 하단 도구 줄 — 왼쪽 네 개는 모드(보기·선택·펜·지우개), 오른쪽은 '+ 삽입' 하나. 삽입 종류는 inserts 로 고른다
 * (모임 노트는 텍스트·스티커·사진·말풍선). 버튼마다 44pt 를 지키면 종류를 한 줄에 다 늘어놓을 수 없어
 * '+ 삽입'이 종류 목록 시트를 연다. 종류가 하나뿐이면 그 버튼을 바로 둔다.
 * 활성 모드는 잉크로 찍은 도장처럼 반전한다(공용 버튼과 같은 유리 면). 펜·지우개일 땐 위에 펜 줄(색·굵기)이 하나 더 뜬다.
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
  const [insertOpen, setInsertOpen] = useState(false);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (handoff.current) clearTimeout(handoff.current);
  }, []);

  const items = inserts.map((k) => INSERTS.find((i) => i.key === k)!);
  const single = items.length === 1 ? items[0] : null;
  const isDisabled = (kind: InsertKind) => kind === 'photo' && photoDisabled;

  const pickInsert = (kind: InsertKind) => {
    setInsertOpen(false);
    if (Platform.OS === 'ios') {
      handoff.current = setTimeout(() => onInsert(kind), SHEET_HANDOFF_MS);
    } else {
      onInsert(kind);
    }
  };

  return (
    <View style={[styles.wrap, { borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: insets.bottom }]}>
      {tool === 'pen' || tool === 'eraser' ? <PenBar tool={tool} pen={pen} onPen={onPen} /> : null}
      <View style={styles.row}>
        {TOOLS.map((t) => (
          <ToolButton key={t.key} icon={t.icon} label={t.label} active={tool === t.key} onPress={() => onTool(t.key)} />
        ))}
        {items.length > 0 ? <View style={[styles.rule, { backgroundColor: colors.line }]} /> : null}
        {single ? (
          <ToolButton
            icon={single.icon}
            label={single.label}
            disabled={isDisabled(single.key)}
            onPress={() => onInsert(single.key)}
          />
        ) : items.length > 1 ? (
          <ToolButton icon={Plus} label="삽입" onPress={() => setInsertOpen(true)} />
        ) : null}
      </View>

      {items.length > 1 ? (
        <NoteSheet visible={insertOpen} title="삽입" onClose={() => setInsertOpen(false)}>
          <View style={styles.insertList}>
            {items.map((i) => {
              const disabled = isDisabled(i.key);
              return (
                <Pressable
                  key={i.key}
                  onPress={() => pickInsert(i.key)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={i.label}
                  accessibilityState={{ disabled }}
                  style={({ pressed }) => [
                    styles.insertRow,
                    disabled ? styles.disabled : null,
                    pressed && !disabled ? pressedStyle : null,
                  ]}
                >
                  <ToolIcon icon={i.icon} color={colors.text} />
                  <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{i.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </NoteSheet>
      ) : null}
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
        active ? glassFace(colors, colors.ink) : null,
        disabled ? styles.disabled : null,
        pressed && !active && !disabled ? pressedStyle : null,
      ]}
    >
      <ToolIcon icon={icon} color={active ? colors.onInk : colors.text} />
    </Pressable>
  );
}

/**
 * 펜 줄 — 색 6종(네모 스와치, 선택은 글자색 테두리)과 굵기 3종. 지우개는 안내 문구만.
 * 겉모습은 작게 두고 hitSlop 으로 44pt 를 채운다. 그 간격이면 좁은 폰에선 한 줄에 다 들어가지 않아 굵기가 아랫줄로 접힌다.
 */
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
      <PenSwatches roomy value={pen.color} onChange={(color) => onPen({ color })} />
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
              hitSlop={WIDTH_HIT_SLOP}
              style={({ pressed }) => [
                styles.widthBtn,
                selected ? glassFace(colors, colors.ink) : null,
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

/**
 * 굵기 버튼(36×28)을 44×44 로 — 가로 4씩이라 굵기 사이 간격(sm)과 맞물려 옆 버튼과 겹치지 않는다.
 * 부모 밖으로 나간 hitSlop 은 터치를 받지 못해 묶음 상자(widths)도 같은 만큼 여백 + 음수 마진으로 넓힌다.
 */
const WIDTH_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

const styles = StyleSheet.create({
  wrap: { borderTopWidth: hairline },
  row: {
    ...layout.content,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btn: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  rule: { width: hairline, height: 24, marginHorizontal: spacing.xs },
  insertList: { gap: spacing.sm },
  insertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  // 줄이 접히면 위아래 hitSlop(8+8)이 겹치지 않게 줄 사이를 lg 로, 색과 굵기 묶음 사이도 lg 이상 띄운다.
  penBar: {
    ...layout.content,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    rowGap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    minHeight: 44,
  },
  widths: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginVertical: -spacing.sm,
    paddingHorizontal: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
  widthBtn: { width: 36, height: 28, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
