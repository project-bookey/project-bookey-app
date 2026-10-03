import { StyleSheet, Text, View } from 'react-native';

import type { ReadingNow } from '@/api/types';
import { Button } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/** 분 단위 경과 — '38분째'. 1분 미만은 '방금'. */
function elapsedLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  return minutes < 1 ? '방금 시작' : `${minutes}분째`;
}

/**
 * '지유, 민수 님이' / '지유 님 외 2명이'.
 * 닉네임 끝이 숫자·영문이면 이/가를 고를 수 없어서 '님이'로 통일한다.
 */
export function readersLabel(readers: ReadingNow[]): string {
  if (readers.length <= 2) return `${readers.map((r) => r.nickname).join(', ')} 님이`;
  return `${readers[0].nickname} 님 외 ${readers.length - 1}명이`;
}

/** 지금 읽는 중 — 클럽 홈 '읽기 조각' 위의 한 줄. 점 · 문구 · 경과 · (선택) 합류. 아무도 없으면 그리지 않는다. */
export function ReadingNowLine({ readers, onJoin }: { readers: ReadingNow[]; onJoin?: () => void }) {
  const { colors } = useTheme();
  if (readers.length === 0) return null;
  const earliest = readers[0];

  return (
    <View style={styles.nowLine} accessibilityRole="summary">
      {/* 읽는 중 표시는 상태라 잉크 점 — 악센트는 화면의 CTA 몫. */}
      <View style={[styles.liveDot, { backgroundColor: colors.ink }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.label, { color: colors.text }]} numberOfLines={1}>
          {readersLabel(readers)} 지금 읽는 중
        </Text>
        <Text style={[styles.monoCaption, { color: colors.textMuted }]}>{elapsedLabel(earliest.startedAt)}</Text>
      </View>
      {onJoin ? <Button label="합류" size="sm" variant="outline" onPress={onJoin} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  liveDot: { width: 8, height: 8, borderRadius: radius.round },
  monoCaption: { fontFamily: mono.regular, fontSize: 11 },
});
