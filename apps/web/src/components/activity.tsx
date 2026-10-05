import type {
  ActivityBlock,
  ActivityDay,
  ActivitySource,
} from "@adhd-irection/shared-types";
import { formatDate, weekdayIndex } from "@/lib/dates";

const BLOCKS_PER_DAY = 48;
const BLOCK_MINUTES = 30;

const SOURCES: { key: ActivitySource; label: string; bg: string }[] = [
  { key: "github", label: "커밋", bg: "bg-commit" },
  { key: "capture", label: "캡처", bg: "bg-capture" },
  { key: "usage", label: "앱 사용", bg: "bg-usage" },
];

const LEVEL_BG = [
  "bg-level-0",
  "bg-level-1",
  "bg-level-2",
  "bg-level-3",
  "bg-level-4",
];
// 농도 위에 올리는 글자색. 짙은 칸(3, 4)은 흰색.
const LEVEL_FG = [
  "text-faint",
  "text-brand-deep",
  "text-brand-deep",
  "text-white",
  "text-white",
];

// 작업 블록 수를 농도 0~4로 나눈다 (30분 칸 기준: 1칸, ~1.5시간, ~3시간, 그 이상).
function level(activeBlocks: number): number {
  if (activeBlocks === 0) return 0;
  if (activeBlocks === 1) return 1;
  if (activeBlocks <= 3) return 2;
  if (activeBlocks <= 6) return 3;
  return 4;
}

function blockTime(index: number): string {
  const minutes = index * BLOCK_MINUTES;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDuration(blocks: number): string {
  const minutes = blocks * BLOCK_MINUTES;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

function dayTitle(day: ActivityDay): string {
  return `${formatDate(day.date)} · 작업 블록 ${day.activeBlocks}개 · 커밋 ${day.commits} · 캡처 ${day.captures}`;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-[18px] bg-white p-7 shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[19px] font-bold text-ink-strong">{children}</h2>;
}

// 숫자 하나를 크게 보여주는 카드. hero는 그 화면의 대표 숫자(짙은 초록 바탕).
export function Stat({
  label,
  value,
  unit,
  hint,
  hero = false,
}: {
  label: string;
  value: number;
  unit: string;
  hint?: string;
  hero?: boolean;
}) {
  const soft = hero ? "text-brand-tint" : "text-muted";
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-[18px] p-6 ${
        hero ? "bg-brand-deep shadow-hero" : "bg-white shadow-card"
      }`}
    >
      <span className={`text-sm font-medium ${soft}`}>{label}</span>
      <div
        className={`flex items-baseline gap-1 ${hero ? "text-white" : "text-ink-strong"}`}
      >
        <span className="text-[40px] leading-none font-bold tracking-[-0.02em] tabular-nums">
          {value}
        </span>
        <span className="text-lg font-semibold">{unit}</span>
      </div>
      {hint && <span className={`text-[13px] ${soft}`}>{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {children}
    </div>
  );
}

export function SourceLegend() {
  return (
    <div className="flex gap-4 text-[13px] text-ink-soft">
      {SOURCES.map((source) => (
        <span key={source.key} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[3px] ${source.bg}`} />
          {source.label}
        </span>
      ))}
    </div>
  );
}

export function LevelLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-subtle">
      <span>적음</span>
      {LEVEL_BG.map((bg) => (
        <span key={bg} className={`size-3 rounded-[3px] ${bg}`} />
      ))}
      <span>많음</span>
    </div>
  );
}

const STRIP = {
  // 오늘 화면의 큰 띠
  large: { height: "h-[60px]", gap: "gap-[3px]", radius: "rounded-[5px]" },
  // 이번 주 화면의 요일별 띠
  medium: { height: "h-[34px]", gap: "gap-[3px]", radius: "rounded-[4px]" },
  // 이번 달 화면의 오늘 패널. 칸이 좁아 나눠 칠하지 않고 한 색만 쓴다.
  small: { height: "h-7", gap: "gap-0.5", radius: "rounded-[2px]" },
};

// 하루를 30분 칸 48개로 그린 띠. 한 칸에 여러 출처가 있으면 위아래로 나눠 칠한다.
export function DayStrip({
  blocks,
  size = "large",
}: {
  blocks: ActivityBlock[];
  size?: keyof typeof STRIP;
}) {
  const byIndex = new Map(blocks.map((block) => [block.index, block.sources]));
  const { height, gap, radius } = STRIP[size];
  return (
    <div className={`flex ${height} ${gap}`}>
      {Array.from({ length: BLOCKS_PER_DAY }, (_, index) => {
        const active = SOURCES.filter((source) =>
          byIndex.get(index)?.includes(source.key),
        );
        const range = `${blockTime(index)}~${blockTime(index + 1)}`;
        const title =
          active.length > 0
            ? `${range} · ${active.map((source) => source.label).join(", ")}`
            : `${range} · 기록 없음`;
        return (
          <div
            key={index}
            title={title}
            className={`flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden ${radius} ${
              active.length === 0 ? "bg-level-0" : ""
            }`}
          >
            {(size === "small" ? active.slice(0, 1) : active).map((source) => (
              <div key={source.key} className={`flex-1 ${source.bg}`} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function HourAxis() {
  return (
    <div className="flex justify-between font-mono text-xs text-subtle">
      {[0, 6, 12, 18, 24].map((hour) => (
        <span key={hour}>{hour}시</span>
      ))}
    </div>
  );
}

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`;
}

// 최근 28일을 한 줄에 7일씩, 줄마다 기간을 붙인다. 마지막 칸이 오늘이다.
export function RecentWeeks({ days }: { days: ActivityDay[] }) {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
    days.slice(i * 7, i * 7 + 7),
  );
  const today = days[days.length - 1].date;
  return (
    <div className="flex flex-col gap-2">
      {weeks.map((week) => (
        <div key={week[0].date} className="flex items-center gap-3">
          <span className="w-[78px] flex-none font-mono text-xs text-subtle">
            {shortDate(week[0].date)}–{shortDate(week[week.length - 1].date)}
          </span>
          <div className="grid max-w-[300px] flex-auto grid-cols-7 gap-1.5">
            {week.map((day) => {
              const l = level(day.activeBlocks);
              return (
                <div
                  key={day.date}
                  title={dayTitle(day)}
                  className={`flex aspect-square items-center justify-center rounded-[9px] text-xs font-semibold tabular-nums ${LEVEL_BG[l]} ${LEVEL_FG[l]} ${
                    day.date === today ? "shadow-today" : ""
                  }`}
                >
                  {Number(day.date.slice(8))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// 한 주는 일요일에 시작한다.
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 한 달을 달력 모양으로. 아직 오지 않은 날은 점선 테두리만 그린다.
export function MonthCalendar({
  days,
  today,
}: {
  days: ActivityDay[];
  today: string;
}) {
  return (
    <div className="grid grid-cols-7 gap-2.5">
      {WEEKDAYS.map((weekday) => (
        <span
          key={weekday}
          className="text-center text-[13px] font-medium text-muted"
        >
          {weekday}
        </span>
      ))}
      {Array.from({ length: weekdayIndex(days[0].date) }, (_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {days.map((day) => {
        const future = day.date > today;
        const l = level(day.activeBlocks);
        return (
          <div
            key={day.date}
            title={future ? formatDate(day.date) : dayTitle(day)}
            className={`flex h-[76px] flex-col justify-between rounded-xl border px-3 py-2.5 ${
              future
                ? "border-dashed border-[#d3ddd6] bg-white text-faint"
                : `border-transparent ${LEVEL_BG[l]} ${l === 0 ? "text-muted" : LEVEL_FG[l]}`
            } ${day.date === today ? "shadow-today" : ""}`}
          >
            <span className="text-sm font-semibold tabular-nums">
              {Number(day.date.slice(8))}
            </span>
            {!future && (
              <span className="self-end text-xs font-semibold tabular-nums">
                {day.activeBlocks}칸
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 한 해를 주 단위 세로줄로 (위에서 아래로 일~토). 좁은 화면에서는 가로로 스크롤한다.
export function YearGrid({
  days,
  today,
}: {
  days: ActivityDay[];
  today: string;
}) {
  const offset = weekdayIndex(days[0].date);
  // 각 달 1일이 놓이는 세로줄(1부터)에 달 이름을 붙인다.
  const monthLabels = days
    .map((day, index) => ({ day, column: Math.floor((index + offset) / 7) + 1 }))
    .filter(({ day }) => day.date.endsWith("-01"));

  return (
    <div className="overflow-x-auto p-0.5">
      <div className="flex min-w-[990px] gap-2.5">
        <div className="grid w-5 flex-none grid-rows-[16px_repeat(7,14px)] gap-y-1 text-[11px] leading-[14px] text-subtle">
          <span />
          <span />
          <span>월</span>
          <span />
          <span>수</span>
          <span />
          <span>금</span>
          <span />
        </div>
        <div className="flex flex-col gap-1">
          <div className="grid h-4 grid-cols-[repeat(53,14px)] gap-x-1 text-[11px] leading-4 text-subtle">
            {monthLabels.map(({ day, column }) => (
              <span
                key={day.date}
                className="row-start-1 whitespace-nowrap"
                style={{ gridColumn: `${column} / span 4` }}
              >
                {Number(day.date.slice(5, 7))}월
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-[repeat(7,14px)] gap-1 [grid-auto-columns:14px]">
            {Array.from({ length: offset }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => (
              <div
                key={day.date}
                title={day.date > today ? formatDate(day.date) : dayTitle(day)}
                className={`rounded-[3px] ${LEVEL_BG[level(day.activeBlocks)]} ${
                  day.date > today ? "opacity-45" : ""
                } ${day.date === today ? "shadow-today-tight" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
