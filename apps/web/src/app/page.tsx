import type {
  ActivityDashboard,
  ActivityDay,
  ActivityRange,
  RecentCommit,
} from "@adhd-irection/shared-types";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardTitle,
  DayStrip,
  formatDuration,
  HourAxis,
  LevelLegend,
  MonthCalendar,
  RecentWeeks,
  SourceLegend,
  Stat,
  StatGrid,
  YearGrid,
} from "@/components/activity";
import { fetchDashboard, fetchRange } from "@/lib/activity";
import {
  dateOf,
  formatDate,
  monthRange,
  TIME_ZONE,
  today as todayDate,
  weekRange,
  yearRange,
} from "@/lib/dates";

export const metadata: Metadata = { title: "작업 흔적" };

const VIEWS = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "year", label: "올해" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const RESUME_HINT = "자리를 비웠다 다시 시작";
const COMMIT_HINT = "GitHub 기준";

function sum(days: ActivityDay[], key: keyof Omit<ActivityDay, "date">) {
  return days.reduce((total, day) => total + day[key], 0);
}

function blocksHint(blocks: number): string {
  return blocks > 0
    ? `흔적이 남은 시간 ${formatDuration(blocks)}`
    : "30분 칸에 흔적이 생기면 채워져요";
}

// 기간 화면 공통 숫자. 아직 오지 않은 날은 "작업한 날"의 분모에서 뺀다.
function RangeStats({ days, today }: { days: ActivityDay[]; today: string }) {
  const elapsed = days.filter((day) => day.date <= today);
  const blocks = sum(elapsed, "activeBlocks");
  return (
    <StatGrid>
      <Stat
        hero
        label="작업 블록"
        value={blocks}
        unit="개"
        hint={blocksHint(blocks)}
      />
      <Stat
        label="작업한 날"
        value={elapsed.filter((day) => day.activeBlocks > 0).length}
        unit="일"
        hint={`지난 ${elapsed.length}일 중`}
      />
      <Stat
        label="돌아온 횟수"
        value={sum(elapsed, "resumes")}
        unit="번"
        hint={RESUME_HINT}
      />
      <Stat
        label="커밋"
        value={sum(elapsed, "commits")}
        unit="개"
        hint={COMMIT_HINT}
      />
    </StatGrid>
  );
}

const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayAndClock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function CommitRow({ commit, today }: { commit: RecentCommit; today: string }) {
  const at = new Date(commit.committedAt);
  // 오늘 커밋은 시각만, 다른 날 커밋은 날짜까지 보여준다.
  const time =
    dateOf(commit.committedAt) === today
      ? clock.format(at)
      : dayAndClock.format(at);
  return (
    <div className="-mx-3 flex items-center gap-3.5 rounded-xl p-3 hover:bg-row">
      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-brand-soft">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1B6E42"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {commit.message.startsWith("Merge ") ? (
            <>
              <circle cx="6" cy="5" r="2" />
              <circle cx="6" cy="19" r="2" />
              <circle cx="18" cy="12" r="2" />
              <path d="M6 7v10" />
              <path d="M6 7c0 4 4 5 10 5" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="3.5" />
              <path d="M2 12h6.5" />
              <path d="M15.5 12H22" />
            </>
          )}
        </svg>
      </span>
      <div className="flex min-w-0 flex-auto flex-col gap-[3px]">
        <span className="truncate text-[15px] font-medium">
          {commit.message}
        </span>
        <span className="truncate text-[13px] text-subtle">{commit.repo}</span>
      </div>
      <span className="flex-none rounded-full bg-pill px-2.5 py-1 font-mono text-[13px] text-ink-soft">
        {time}
      </span>
    </div>
  );
}

function TodayView({ dashboard }: { dashboard: ActivityDashboard }) {
  const { days, blocks, recentCommits } = dashboard;
  const today = days[days.length - 1];
  const activeDays = days
    .slice(-7)
    .filter((day) => day.activeBlocks > 0).length;
  const repos = new Set(recentCommits.map((commit) => commit.repo));

  return (
    <>
      <StatGrid>
        <Stat
          hero
          label="작업 블록"
          value={today.activeBlocks}
          unit="개"
          hint={blocksHint(today.activeBlocks)}
        />
        <Stat
          label="돌아온 횟수"
          value={today.resumes}
          unit="번"
          hint={RESUME_HINT}
        />
        <Stat label="커밋" value={today.commits} unit="개" hint={COMMIT_HINT} />
        <Stat
          label="캡처"
          value={today.captures}
          unit="개"
          hint="데스크톱에서 남긴 상태"
        />
      </StatGrid>

      <Card className="gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <CardTitle>오늘의 띠</CardTitle>
            <span className="text-[13px] text-subtle">30분 = 1칸</span>
          </div>
          <SourceLegend />
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[600px] flex-col gap-2.5">
            <DayStrip blocks={blocks} />
            <HourAxis />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-stretch gap-6">
        <Card className="flex-[1_1_340px] gap-[18px]">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-brand">최근 4주</span>
            <CardTitle>최근 7일 중 {activeDays}일 작업</CardTitle>
          </div>
          <RecentWeeks days={days} />
          <div className="mt-auto">
            <LevelLegend />
          </div>
        </Card>

        <Card className="min-w-0 flex-[999_1_520px] gap-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <CardTitle>최근 커밋</CardTitle>
            {repos.size === 1 && (
              <span className="truncate text-[13px] text-subtle">
                {recentCommits[0].repo}
              </span>
            )}
          </div>
          {recentCommits.length === 0 ? (
            <p className="text-sm text-subtle">아직 가져온 커밋이 없습니다.</p>
          ) : (
            recentCommits.map((commit) => (
              <CommitRow
                key={`${commit.repo}-${commit.committedAt}`}
                commit={commit}
                today={dashboard.date}
              />
            ))
          )}
        </Card>
      </div>
    </>
  );
}

// 요일마다 하루치 띠를 한 줄씩 쌓아, 어느 시간대에 작업하는지가 세로로 보이게 한다.
function WeekView({ range, today }: { range: ActivityRange; today: string }) {
  return (
    <>
      <RangeStats days={range.days} today={today} />
      <Card className="gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <CardTitle>요일별 띠</CardTitle>
            <span className="text-[13px] text-subtle">30분 = 1칸</span>
          </div>
          <SourceLegend />
        </div>
        <div className="overflow-x-auto px-3">
          <div className="flex min-w-[760px] flex-col gap-1.5">
            {range.days.map((day) => (
              <div
                key={day.date}
                className={`-mx-3 flex items-center gap-4 rounded-xl px-3 py-2 ${
                  day.date === today ? "bg-[#f1f8f3]" : ""
                } ${day.date > today ? "opacity-45" : ""}`}
              >
                <div className="flex w-[92px] flex-none items-center gap-2">
                  <span
                    className={`text-sm ${day.date === today ? "font-bold" : "font-medium"}`}
                  >
                    {formatDate(day.date, "weekday")}
                  </span>
                  <span className="font-mono text-[13px] text-muted">
                    {formatDate(day.date, "short")}
                  </span>
                </div>
                <div className="min-w-0 flex-auto">
                  <DayStrip
                    size="medium"
                    blocks={range.blocks.filter(
                      (block) => block.date === day.date,
                    )}
                  />
                </div>
                <span
                  className={`w-11 flex-none text-right text-sm font-semibold tabular-nums ${
                    day.activeBlocks > 0 ? "text-brand" : "text-faint"
                  }`}
                >
                  {day.activeBlocks}칸
                </span>
              </div>
            ))}
            <div className="flex gap-4">
              <span className="w-[92px] flex-none" />
              <div className="flex-auto">
                <HourAxis />
              </div>
              <span className="w-11 flex-none" />
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function MonthView({ range, today }: { range: ActivityRange; today: string }) {
  const todayStats = range.days.find((day) => day.date === today);
  const rows = todayStats && [
    ["작업 블록", `${todayStats.activeBlocks}칸`],
    ["흔적이 남은 시간", formatDuration(todayStats.activeBlocks)],
    ["커밋", `${todayStats.commits}개`],
    ["캡처", `${todayStats.captures}개`],
  ];
  return (
    <>
      <RangeStats days={range.days} today={today} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[999_1_560px] gap-[18px]">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>달력</CardTitle>
            <LevelLegend />
          </div>
          <MonthCalendar days={range.days} today={today} />
        </Card>

        {rows && (
          <Card className="flex-[1_1_300px] gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="self-start rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                오늘
              </span>
              <h2 className="text-[21px] font-bold text-ink-strong">
                {formatDate(today, "long")}
              </h2>
            </div>
            <DayStrip
              size="small"
              blocks={range.blocks.filter((block) => block.date === today)}
            />
            <dl className="flex flex-col">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-hairline py-3.5 text-[15px] last:border-b-0"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pill text-sm font-semibold text-brand-deep"
            >
              오늘 자세히 보기
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}

function YearView({ range, today }: { range: ActivityRange; today: string }) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const prefix = `${range.from.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
    const days = range.days.filter((day) => day.date.startsWith(prefix));
    return {
      label: `${i + 1}월`,
      blocks: sum(days, "activeBlocks"),
      activeDays: days.filter((day) => day.activeBlocks > 0).length,
      future: `${prefix}-01` > today,
    };
  });
  const maxBlocks = Math.max(1, ...months.map((month) => month.blocks));

  return (
    <>
      <RangeStats days={range.days} today={today} />
      <Card className="gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>한 해의 흔적</CardTitle>
          <LevelLegend />
        </div>
        <YearGrid days={range.days} today={today} />
      </Card>
      <Card className="gap-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <CardTitle>월별 작업 블록</CardTitle>
          <span className="text-[13px] text-subtle">칸 · 작업한 날</span>
        </div>
        {months.map((month) => (
          <div
            key={month.label}
            className={`flex items-center gap-4 ${month.future ? "opacity-40" : ""}`}
          >
            <span className="w-9 flex-none text-sm font-medium text-ink-soft">
              {month.label}
            </span>
            <div className="h-[22px] flex-auto overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full ${
                  month.blocks === maxBlocks ? "bg-brand" : "bg-[#5db884]"
                }`}
                style={{ width: `${(month.blocks / maxBlocks) * 100}%` }}
              />
            </div>
            <span className="w-[92px] flex-none text-right text-sm text-ink-soft tabular-nums">
              <b className="font-bold text-ink-strong">{month.blocks}칸</b> ·{" "}
              {month.activeDays}일
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

const RANGES = { week: weekRange, month: monthRange, year: yearRange };
const RANGE_VIEWS = { week: WeekView, month: MonthView, year: YearView };

function periodLabel(view: View, today: string, range?: ActivityRange) {
  if (view === "week" && range) {
    return `${formatDate(range.from)} ~ ${formatDate(range.to)}`;
  }
  if (view === "month") {
    return `${Number(today.slice(0, 4))}년 ${Number(today.slice(5, 7))}월`;
  }
  if (view === "year") return `${Number(today.slice(0, 4))}년`;
  return formatDate(today);
}

export default async function ActivityPage({ searchParams }: PageProps<"/">) {
  const { view: viewParam } = await searchParams;
  const view: View =
    VIEWS.find((candidate) => candidate.key === viewParam)?.key ?? "today";
  const today = todayDate();

  // 조회만 try 안에서 하고, 화면은 그 결과로 바깥에서 그린다.
  let dashboard: ActivityDashboard | undefined;
  let range: ActivityRange | undefined;
  let failure: string | undefined;
  try {
    if (view === "today") {
      dashboard = await fetchDashboard();
    } else {
      const { from, to } = RANGES[view](today);
      range = await fetchRange(from, to);
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  let content: React.ReactNode;
  if (dashboard) {
    content = <TodayView dashboard={dashboard} />;
  } else if (range) {
    const RangeView = RANGE_VIEWS[view as keyof typeof RANGE_VIEWS];
    content = <RangeView range={range} today={today} />;
  } else {
    content = (
      <Card className="gap-2">
        <p className="font-medium">
          활동을 불러오지 못했습니다. API 서버(<code>pnpm dev:api</code>)가 떠
          있는지 확인하세요.
        </p>
        <p className="text-sm text-subtle">{failure}</p>
      </Card>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-6 px-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-brand">
            {periodLabel(view, today, range)}
          </span>
          <h1 className="text-[34px] leading-tight font-bold tracking-[-0.02em] text-ink-strong">
            작업 흔적
          </h1>
        </div>
        <nav
          aria-label="기간"
          className="flex gap-1 rounded-full bg-white p-[5px] shadow-seg"
        >
          {VIEWS.map(({ key, label }) => (
            <Link
              key={key}
              href={key === "today" ? "/" : `/?view=${key}`}
              aria-current={key === view ? "page" : undefined}
              className={`rounded-full px-[22px] py-2.5 text-sm ${
                key === view
                  ? "bg-brand font-semibold text-white shadow-seg-active"
                  : "font-medium text-ink-soft hover:bg-[#eaf3ed]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {content}
    </main>
  );
}
