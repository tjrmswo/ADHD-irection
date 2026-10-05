// 날짜는 전부 YYYY-MM-DD 문자열로 다루고, 계산은 UTC 자정 기준으로 한다 (시간대와 무관한 달력 계산).

// 하루의 경계를 자르는 시간대. API의 집계 기준과 같아야 한다.
export const TIME_ZONE = "Asia/Seoul";
// 위 시간대의 UTC 오프셋. 한국은 서머타임이 없어 고정값이다.
const UTC_OFFSET = "+09:00";

/** 그 날짜가 시작되는 순간 (기준 시간대의 자정) */
export function startOfDay(date: string): string {
  return `${date}T00:00:00${UTC_OFFSET}`;
}

export function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function today(): string {
  // en-CA 로케일의 날짜 형식이 YYYY-MM-DD다.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

export function addDays(date: string, days: number): string {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** 한 주는 일요일에 시작한다. 일요일 = 0, 토요일 = 6 */
export function weekdayIndex(date: string): number {
  return toUtc(date).getUTCDay();
}

export function weekRange(date: string): { from: string; to: string } {
  const from = addDays(date, -weekdayIndex(date));
  return { from, to: addDays(from, 6) };
}

export function monthRange(date: string): { from: string; to: string } {
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = date.slice(0, 8);
  return { from: `${prefix}01`, to: `${prefix}${lastDay}` };
}

/** "YYYY-MM"이 실제 달인지 */
export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function yearRange(date: string): { from: string; to: string } {
  const year = date.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const formatters = {
  full: new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
  short: new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }),
  weekday: new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    weekday: "short",
  }),
  long: new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "long",
  }),
};

export function formatDate(
  date: string,
  style: keyof typeof formatters = "full",
): string {
  return formatters[style].format(toUtc(date));
}

/** 시각이 속한 날짜(YYYY-MM-DD)를 기준 시간대로 구한다. */
export function dateOf(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(instant),
  );
}
