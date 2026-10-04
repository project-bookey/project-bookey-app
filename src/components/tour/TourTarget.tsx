import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** 둘러보기가 비출 수 있는 요소 — id 하나에 노드 하나. 포커스된 화면의 것만 올라 있다. */
const targets = new Map<string, View>();

/**
 * 요소에 직접 다는 둘러보기 대상 ref. 그 화면이 포커스된 동안에만 등록한다 —
 * `(tabs)` 가 두 벌 떠 있어도(프로필 사진 변경 뒤 등) 보이는 쪽만 남는다.
 * 여백까지 재지 않도록 눈에 보이는 요소 자체에 단다.
 */
export function useTourTarget(id: string) {
  const [node, setNode] = useState<View | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!node || !isFocused) return undefined;
    targets.set(id, node);
    // 다른 인스턴스가 같은 id 로 다시 올렸으면 그쪽을 지우지 않는다.
    return () => {
      if (targets.get(id) === node) targets.delete(id);
    };
  }, [id, node, isFocused]);

  return setNode;
}

/** ref 를 직접 달 수 없는 묶음(탭 줄·버튼 두 개 등)을 감싸는 대상. 여백은 바깥에 두고 내용만 감싼다. */
export function TourTarget({ id, children, style }: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useTourTarget(id);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

export type TourRect = { x: number; y: number; width: number; height: number };

/** 창 기준 사각형. 크기가 0 이면(웹에서 숨은 페이지 등) null — 응답이 없으면 잠시 뒤 null 로 끝낸다. */
export function measureView(view: View): Promise<TourRect | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 500);
    view.measureInWindow((x, y, width, height) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export function measureTourTarget(id: string): Promise<TourRect | null> {
  const target = targets.get(id);
  return target ? measureView(target) : Promise.resolve(null);
}
