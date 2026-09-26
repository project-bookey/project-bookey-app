import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

const targets = new Map<string, View>();

export function TourTarget({ id, children, style }: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (ref.current) targets.set(id, ref.current);
    return () => { targets.delete(id); };
  }, [id]);

  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

export type TourRect = { x: number; y: number; width: number; height: number };

export function measureTourTarget(id: string): Promise<TourRect | null> {
  return new Promise((resolve) => {
    const target = targets.get(id);
    if (!target) {
      resolve(null);
      return;
    }
    target.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
