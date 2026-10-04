import { Text, View } from 'react-native';

import type { ActivityCard } from '@/api/types';
import { formatClock } from '@/components/ui';
import { radius, serif, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';
import type { ActivityCardSnapshot } from '../noteDoc';

/** 카드 면 비율 — 한 변(size)에 대한 값. 300 논리 폭에서 시간 약 60, 메타 약 17. */
const C = { pad: 0.08, eyebrow: 0.055, clock: 0.2, club: 0.075, meta: 0.055, gap: 0.03 };

/** 서버 카드 → 노트에 담을 스냅숏. */
export function snapshotOf(c: ActivityCard): ActivityCardSnapshot {
  return {
    durationSec: c.durationSec,
    clubName: c.clubName ?? '클럽',
    meetingTitle: c.meetingTitle ?? undefined,
    nickname: c.nickname ?? '나',
    endedAt: c.endedAt ?? undefined,
  };
}

/** 끝난 날짜 — 2026.10.01. 없으면 null. */
function dayOf(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/**
 * 같이 읽기 기록 카드 면 — 정사각형 종이 한 장(헤어라인): 모노 아이브로우, 큰 모노 시간, 명조 클럽 이름,
 * 모임 제목·날짜·닉네임 한 줄씩. 노트 스티커와 스티커 고르기 미리보기가 같은 면을 쓴다.
 */
export function ActivityCardFace({ card, size }: { card: ActivityCardSnapshot; size: number }) {
  const { colors } = useTheme();
  const day = dayOf(card.endedAt);
  const meta = [card.meetingTitle, day].filter(Boolean).join(' · ');
  const metaStyle = {
    fontFamily: mono.medium,
    fontSize: size * C.meta,
    letterSpacing: Math.min(0.4, size * C.meta * 0.04),
    color: colors.textMuted,
  };
  return (
    <View
      style={{
        width: size,
        height: size,
        padding: size * C.pad,
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderWidth: hairline,
        borderColor: colors.lineStrong,
        borderRadius: radius.md,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: mono.semiBold, fontSize: size * C.eyebrow, letterSpacing: 1, color: colors.textFaint }}
      >
        같이 읽기
      </Text>
      <View style={{ gap: size * C.gap }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: mono.semiBold,
            fontSize: size * C.clock,
            lineHeight: size * C.clock * 1.15,
            fontVariant: ['tabular-nums'],
            color: colors.text,
          }}
        >
          {formatClock(card.durationSec)}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: serif.bold, fontSize: size * C.club, lineHeight: size * C.club * 1.4, color: colors.text }}
        >
          {card.clubName}
        </Text>
        {meta ? <Text numberOfLines={1} style={metaStyle}>{meta}</Text> : null}
      </View>
      <Text numberOfLines={1} style={[metaStyle, { color: colors.textFaint }]}>@{card.nickname}</Text>
    </View>
  );
}
