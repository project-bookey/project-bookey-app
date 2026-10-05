import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BringToFront, Pencil, Trash2 } from 'lucide-react-native';

import { radius, spacing, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';
import { NOTE_ACTION_HEIGHT, NoteAction } from './NoteAction';
import { IDLE_DELTA, type Delta, type Preview } from './editing';
import { handleDelta, type Point } from './noteGeometry';
import { isTextual, type PlacedElement } from './noteDoc';

const HANDLE = 16;
const HIT = 44;
const INSET = 4;

/**
 * 선택 프레임 — 점선 테두리 + 우하단 모서리 핸들 + 동작 줄(맨 앞으로 · 편집 · 삭제).
 * 되돌리기 어려운 삭제는 맨 끝에, 다른 동작보다 더 떼어 둔다(오터치 방지).
 * 핸들은 요소 중심에서 포인터까지의 벡터 변화로 크기·각도를 한 번에 바꾼다(인스타 스토리·Canva 방식) —
 * 웹 마우스는 핀치·회전 제스처를 못 내므로 이 핸들이 유일한 크기·회전 수단이다.
 * 캡처 뷰의 형제(오버레이)에 그리므로 PNG 에는 찍히지 않는다.
 */
export function SelectionFrame({ element, scale, height, onPreview, onCommit, onDelete, onFront, onEdit }: {
  /** preview 가 이미 얹힌 요소. */
  element: PlacedElement;
  scale: number;
  /** 요소의 실제 렌더 높이(px). 아직 모르면 0. */
  height: number;
  onPreview: (preview: Preview) => void;
  onCommit: (id: string, delta: Delta) => void;
  onDelete: () => void;
  onFront: () => void;
  onEdit?: () => void;
}) {
  const { colors } = useTheme();
  const left = element.x * scale;
  const top = element.y * scale;
  const width = element.w * scale;
  const id = element.id;

  const latest = useRef({ onPreview, onCommit, width, height, rot: element.rot });
  latest.current = { onPreview, onCommit, width, height, rot: element.rot };
  const start = useRef<Point>([0, 0]);
  const delta = useRef<Delta>({ ...IDLE_DELTA });

  const handle = useMemo(() => Gesture.Pan().runOnJS(true).minDistance(0).maxPointers(1)
    .onBegin(() => {
      // 중심 → 핸들(우하단 모서리) 벡터. 박스가 rot 만큼 돌아 있으니 모서리 오프셋도 같이 돌린다.
      const { width: w, height: h, rot } = latest.current;
      const rad = (rot * Math.PI) / 180;
      const hx = w / 2;
      const hy = h / 2;
      start.current = [hx * Math.cos(rad) - hy * Math.sin(rad), hx * Math.sin(rad) + hy * Math.cos(rad)];
      delta.current = { ...IDLE_DELTA };
    })
    .onUpdate((e) => {
      const from = start.current;
      const to: Point = [from[0] + e.translationX, from[1] + e.translationY];
      const { scale: s, rotDeg } = handleDelta([0, 0], from, to);
      delta.current = { dx: 0, dy: 0, s, dr: rotDeg };
      latest.current.onPreview({ id, ...delta.current });
    })
    .onEnd(() => {
      latest.current.onCommit(id, { ...delta.current });
      delta.current = { ...IDLE_DELTA };
    }), [id]);

  const canEdit = isTextual(element);
  // 동작 줄 아래 끝이 점선 테두리(INSET)에서 sm 만큼 떨어지게 요소 위로 띄운다.
  const actionsTop = Math.max(0, top - INSET - spacing.sm - NOTE_ACTION_HEIGHT);

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left, top, width, height: Math.max(height, 1), transform: [{ rotate: `${element.rot}deg` }] }}
      >
        <View pointerEvents="none" style={[styles.border, { borderColor: colors.lineStrong }]} />
        <GestureDetector gesture={handle}>
          <View style={styles.handleHit} accessibilityRole="adjustable" accessibilityLabel="크기·회전 핸들">
            <View style={[styles.handle, { backgroundColor: colors.ink, borderColor: colors.onInk }]} />
          </View>
        </GestureDetector>
      </View>
      <View pointerEvents="box-none" style={[styles.actions, { left: Math.max(0, left), top: actionsTop }]}>
        <NoteAction icon={BringToFront} label="맨 앞으로" onPress={onFront} />
        {canEdit && onEdit ? <NoteAction icon={Pencil} label="편집" onPress={onEdit} /> : null}
        <View style={styles.dangerGap}>
          <NoteAction icon={Trash2} label="삭제" onPress={onDelete} tone="danger" />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  border: {
    position: 'absolute',
    left: -INSET,
    top: -INSET,
    right: -INSET,
    bottom: -INSET,
    borderWidth: hairline,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
  },
  handleHit: {
    position: 'absolute',
    right: -INSET - HIT / 2,
    bottom: -INSET - HIT / 2,
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { width: HANDLE, height: HANDLE, borderWidth: 2, borderRadius: radius.none },
  actions: { position: 'absolute', flexDirection: 'row', gap: spacing.sm },
  // 삭제 앞은 sm + md = 20 — 묶음 안 간격(sm)보다 넓게 떼어 다른 동작으로 읽히게 한다.
  dangerGap: { marginLeft: spacing.md },
});
