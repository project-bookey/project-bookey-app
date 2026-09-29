/**
 * 약속 시각 — 서버는 ISO instant, 화면은 KST. 숫자는 모노로 세우므로 '10.1' · '목' · '19:30' 꼴로 짧게 자른다.
 */
const KST = 'Asia/Seoul';

type Parts = { year: string; month: string; day: string; weekday: string; hour: string; minute: string };

function parts(date: Date): Parts {
  const format = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of format.formatToParts(date)) out[p.type] = p.value;
  return out as Parts;
}

/** '10.1' */
export function meetingDay(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.month}.${p.day}`;
}

/** '목' */
export function meetingWeekday(iso: string): string {
  return parts(new Date(iso)).weekday;
}

/** '19:30' */
export function meetingClock(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

/** '2026.10.1 목 · 19:30 → 21:00' — 끝 시각이 없으면 시작만. */
export function meetingDateLine(startsAt: string, endsAt?: string): string {
  const p = parts(new Date(startsAt));
  const time = endsAt ? `${meetingClock(startsAt)} → ${meetingClock(endsAt)}` : meetingClock(startsAt);
  return `${p.year}.${p.month}.${p.day} ${p.weekday} · ${time}`;
}

/** 새 약속 폼의 날짜 칸 — '2026.10.1 목'. */
export function formatPickDate(date: Date): string {
  const p = parts(date);
  return `${p.year}.${p.month}.${p.day} ${p.weekday}`;
}

/** 새 약속 폼의 시간 칸 — '19:30'. */
export function formatPickTime(date: Date): string {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

export type MeetingState = 'open' | 'past' | 'cancelled';

/** 서버 status 에 '지난 약속'을 얹는다 — 열려 있어도 시작 시각이 지났으면 past. */
export function meetingState(meeting: { status: string; startsAt: string }): MeetingState {
  if (meeting.status !== 'OPEN') return 'cancelled';
  return new Date(meeting.startsAt).getTime() < Date.now() ? 'past' : 'open';
}

export const MEETING_STATE_LABEL: Record<MeetingState, string> = {
  open: '모집 중',
  past: '지난 약속',
  cancelled: '취소됨',
};
