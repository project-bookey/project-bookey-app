/**
 * 읽기로그 날짜 — 서버가 조각을 KST 날짜로 묶으므로 앱도 기기 시간대와 무관하게 KST 로 계산한다.
 * 날짜는 'YYYY-MM-DD' 문자열로만 주고받는다(Date 객체의 시간대 해석을 피하려고).
 */

const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** KST 오늘 'YYYY-MM-DD'. */
export function todayKst(): string {
  return KST_DATE.format(new Date());
}

/** 날짜 문자열에 일수를 더한다 — UTC 자정 기준으로 계산해 시간대·서머타임 영향이 없다. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 그 날짜가 속한 주의 월요일. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return addDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 요일 한 글자. */
export function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 일(day) 숫자. */
export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** '9월 둘째 주' 같은 주 이름 — 그 주 월요일이 속한 달 기준. */
export function weekTitle(mondayIso: string): string {
  const month = Number(mondayIso.slice(5, 7));
  const nth = Math.ceil(dayOfMonth(mondayIso) / 7);
  const names = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  return `${month}월 ${names[nth - 1] ?? `${nth}번째`} 주`;
}

/** KST 시각 'HH:mm'. */
export function kstTime(isoInstant: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoInstant));
}
