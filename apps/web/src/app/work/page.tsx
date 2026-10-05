import type {
  RecentWork,
  WorkLog,
  WorkSession,
} from "@adhd-irection/shared-types";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Card, CardTitle, Stat, StatGrid } from "@/components/activity";
import { DatePicker } from "@/components/date-picker";
import { loadWorkDetail, type WorkDetail } from "@/components/work-detail";
import { parseOpenWork, WorkRow, type OpenWork } from "@/components/work-row";
import { fetchWorkItems, fetchWorkLog } from "@/lib/activity";
import {
  addDays,
  formatDate,
  isDate,
  isMonth,
  monthRange,
  TIME_ZONE,
  today as todayDate,
  weekRange,
  yearRange,
} from "@/lib/dates";

export const metadata: Metadata = { title: "작업 기록" };

const RANGES = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "year", label: "올해" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const KINDS = [
  { key: "commit", label: "커밋" },
  { key: "notion", label: "노션" },
  { key: "capture", label: "캡처" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 구간의 길이(분). 흔적이 하나뿐인 구간은 0이다. */
function minutesOf(session: WorkSession): number {
  return Math.round(
    (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000,
  );
}

function totalsOf(sessions: WorkSession[]) {
  return sessions.reduce(
    (total, session) => ({
      minutes: total.minutes + minutesOf(session),
      commits: total.commits + session.commits,
      notionEdits: total.notionEdits + session.notionEdits,
      captures: total.captures + session.captures,
    }),
    { minutes: 0, commits: 0, notionEdits: 0, captures: 0 },
  );
}

// "커밋 3 · 노션 2 · 캡처 1" — 0인 것은 뺀다.
function countsLabel(totals: ReturnType<typeof totalsOf>): string {
  return [
    totals.commits > 0 && `커밋 ${totals.commits}`,
    totals.notionEdits > 0 && `노션 ${totals.notionEdits}`,
    totals.captures > 0 && `캡처 ${totals.captures}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// 여러 구간에서 쓴 앱을 합쳐 많이 쓴 순서로.
function appsOf(sessions: WorkSession[], limit: number): string {
  const minutes = new Map<string, number>();
  for (const session of sessions) {
    for (const app of session.apps) {
      minutes.set(app.name, (minutes.get(app.name) ?? 0) + app.minutes);
    }
  }
  return [...minutes]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => `${name} ${formatMinutes(total)}`)
    .join(" · ");
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups];
}

// 작업과 무관하게 시간을 쓰기 쉬운 사이트에 붙이는 표시 (색과 글자를 함께 쓴다)
function DistractionTag() {
  return (
    <span className="flex-none rounded-full bg-[#fdf0dc] px-2 py-0.5 text-xs font-semibold text-[#7a4a00]">
      딴짓
    </span>
  );
}

function TopList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { name: string; value: string; distraction?: boolean }[];
  empty: string;
}) {
  return (
    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
      <h3 className="text-[13px] font-medium text-brand">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.name} className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-auto truncate" title={row.name}>
                {row.name}
              </span>
              {row.distraction && <DistractionTag />}
              <span className="flex-none font-mono text-[13px] text-ink-soft">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 하루 보기: 작업 구간마다 카드 하나. 그 구간의 개별 작업을 안에 나열한다.
function SessionCard({
  session,
  items,
  today,
  open,
  detail,
  params,
}: {
  session: WorkSession;
  items: RecentWork[];
  today: string;
  open: OpenWork | null;
  detail: WorkDetail | null;
  params: Record<string, string>;
}) {
  const minutes = minutesOf(session);
  const counts = countsLabel(totalsOf([session]));
  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-mono text-[19px] font-medium text-ink-strong">
          {clock.format(new Date(session.startedAt))}
          {minutes > 0 && ` ~ ${clock.format(new Date(session.endedAt))}`}
        </h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
          {minutes > 0 ? formatMinutes(minutes) : "잠깐"}
        </span>
        {counts && <span className="text-[13px] text-subtle">{counts}</span>}
      </div>

      {session.apps.length > 0 && (
        <p className="text-sm text-ink-soft">
          <span className="mr-2 text-[13px] text-subtle">쓴 앱</span>
          {session.apps
            .map((app) => `${app.name} ${formatMinutes(app.minutes)}`)
            .join(" · ")}
        </p>
      )}

      {session.screens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-subtle">주로 본 화면</span>
          <ul className="flex flex-col gap-1.5">
            {session.screens.map((screen) => (
              <li
                key={`${screen.app}-${screen.title}`}
                className="flex items-baseline gap-2 text-sm"
              >
                <span className="flex-none rounded-md bg-track px-1.5 py-0.5 text-[13px] font-medium">
                  {screen.app}
                </span>
                <span className="min-w-0 flex-auto truncate" title={screen.title}>
                  {screen.title}
                </span>
                {screen.distraction && <DistractionTag />}
                <span className="flex-none font-mono text-[13px] text-subtle">
                  {formatMinutes(screen.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col border-t border-hairline pt-2">
          {items.map((work) => (
            <WorkRow
              key={`${work.kind}-${work.ref}-${work.at}`}
              work={work}
              today={today}
              open={open}
              detail={detail}
              path="/work"
              params={params}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// 주·월·년 보기: 날짜(또는 달)마다 요약 한 줄. 누르면 그 범위로 들어간다.
function SummaryRow({
  href,
  label,
  badge,
  sessions,
  extra,
}: {
  href: string;
  label: string;
  badge?: string;
  sessions: WorkSession[];
  extra?: string;
}) {
  const totals = totalsOf(sessions);
  const apps = appsOf(sessions, 3);
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[18px] bg-white px-6 py-4 shadow-card hover:shadow-chip-hover"
    >
      <div className="flex w-[150px] flex-none items-center gap-2">
        <span className="text-[17px] font-bold text-ink-strong">{label}</span>
        {badge && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            {badge}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <span className="text-sm font-medium">
          {extra && `${extra} · `}구간 {sessions.length}개
          {totals.minutes > 0 && ` · ${formatMinutes(totals.minutes)}`}
          {countsLabel(totals) && ` · ${countsLabel(totals)}`}
        </span>
        {apps && (
          <span className="truncate text-[13px] text-subtle">{apps}</span>
        )}
      </div>
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
        className="flex-none text-faint"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

const dayLink =
  "inline-flex size-11 items-center justify-center rounded-full bg-white text-ink-soft shadow-seg hover:bg-[#eaf3ed]";

export default async function WorkPage({ searchParams }: PageProps<"/work">) {
  const params = await searchParams;
  const today = todayDate();

  // 무엇을 보고 있는지: 특정 날짜 > 특정 달 > 기간 버튼(기본 오늘)
  const pickedDate =
    isDate(params.date) && params.date <= today ? params.date : null;
  const pickedMonth =
    !pickedDate && isMonth(params.month) ? params.month : null;
  const range: RangeKey | null =
    pickedDate || pickedMonth
      ? null
      : (RANGES.find(({ key }) => key === params.range)?.key ?? "today");

  let from = pickedDate ?? today;
  let to = from;
  if (pickedMonth) ({ from, to } = monthRange(`${pickedMonth}-01`));
  if (range === "week") ({ from, to } = weekRange(today));
  if (range === "month") ({ from, to } = monthRange(today));
  if (range === "year") ({ from, to } = yearRange(today));
  const mode = from === to ? "day" : range === "year" ? "months" : "days";

  const kind: Kind | null =
    KINDS.find(({ key }) => key === params.kind)?.key ?? null;
  const open = mode === "day" ? parseOpenWork(params) : null;
  // 하루 보기에서 줄을 펼치거나 종류를 걸러도 유지할 주소 값
  const baseParams: Record<string, string> = pickedDate
    ? { date: pickedDate }
    : {};

  // 조회만 try 안에서 하고, 화면은 그 결과로 바깥에서 그린다.
  let log: WorkLog | undefined;
  let items: RecentWork[] = [];
  let detail: WorkDetail | null = null;
  let failure: string | undefined;
  try {
    [log, items, detail] = await Promise.all([
      fetchWorkLog(from, to),
      mode === "day" ? fetchWorkItems(from) : [],
      open ? loadWorkDetail(open) : null,
    ]);
  } catch (error) {
    // 로그인 화면으로 보내는 redirect는 그대로 통과시킨다.
    unstable_rethrow(error);
    failure = error instanceof Error ? error.message : String(error);
  }

  const next = addDays(from, 1);
  const periodLabel =
    mode === "day"
      ? formatDate(from, "long")
      : pickedMonth || range === "month"
        ? `${Number(from.slice(0, 4))}년 ${Number(from.slice(5, 7))}월`
        : range === "year"
          ? `${Number(from.slice(0, 4))}년`
          : `${formatDate(from)} ~ ${formatDate(to)}`;

  let content: React.ReactNode;
  if (!log) {
    content = (
      <Card className="gap-2">
        <p className="font-medium">
          작업 기록을 불러오지 못했습니다. API 서버(<code>pnpm dev:api</code>)가
          떠 있는지 확인하세요.
        </p>
        <p className="text-sm text-subtle">{failure}</p>
      </Card>
    );
  } else {
    const totals = totalsOf(log.sessions);
    const visible = kind ? items.filter((item) => item.kind === kind) : items;
    const kindHref = (key: Kind | null) => {
      const query = new URLSearchParams(
        key ? { ...baseParams, kind: key } : baseParams,
      ).toString();
      return query ? `/work?${query}` : "/work";
    };
    const rowParams = kind ? { ...baseParams, kind } : baseParams;

    content = (
      <>
        <StatGrid>
          <Stat
            hero
            label="작업 구간"
            value={log.sessions.length}
            unit="개"
            hint={
              totals.minutes > 0
                ? `이어서 작업한 시간 ${formatMinutes(totals.minutes)}`
                : "30분 넘게 끊기지 않은 작업 덩어리"
            }
          />
          <Stat label="커밋" value={totals.commits} unit="개" />
          <Stat label="노션 편집" value={totals.notionEdits} unit="번" />
          <Stat label="캡처" value={totals.captures} unit="개" />
        </StatGrid>

        <Card className="gap-4">
          <CardTitle>이 기간에 많이 한 작업</CardTitle>
          <div className="flex flex-wrap gap-x-8 gap-y-5">
            <TopList
              title="레포 (커밋)"
              rows={log.top.repos.map((repo) => ({
                name: repo.name,
                value: `${repo.count}개`,
              }))}
              empty="커밋이 없어요."
            />
            <TopList
              title="Notion 페이지 (편집)"
              rows={log.top.notionPages.map((page) => ({
                name: page.name,
                value: `${page.count}번`,
              }))}
              empty="편집이 없어요."
            />
            <TopList
              title="앱 (사용 시간)"
              rows={log.top.apps.map((app) => ({
                name: app.name,
                value: formatMinutes(app.minutes),
              }))}
              empty="사용 흔적이 없어요."
            />
            <TopList
              title="브라우저에서 본 사이트"
              rows={log.top.sites.map((site) => ({
                name: site.name,
                value: formatMinutes(site.minutes),
                distraction: site.distraction,
              }))}
              empty="브라우저 사용 흔적이 없어요."
            />
          </div>
        </Card>

        {log.sessions.length === 0 && (
          <p className="rounded-[18px] bg-white px-6 py-8 text-sm text-subtle shadow-card">
            이 기간에는 남은 작업 흔적이 없어요.
          </p>
        )}

        {mode === "day" && log.sessions.length > 0 && (
          <>
            <div role="group" aria-label="종류" className="flex flex-wrap gap-2">
              {[{ key: null, label: "전체" }, ...KINDS].map((chip) => {
                const on = chip.key === kind;
                const count = chip.key
                  ? items.filter((item) => item.kind === chip.key).length
                  : items.length;
                return (
                  <Link
                    key={chip.label}
                    href={kindHref(chip.key)}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-chip hover:shadow-chip-hover ${
                      on
                        ? "border-brand-deep bg-brand-deep text-white"
                        : "border-[#e1e8e3] bg-white text-ink"
                    }`}
                  >
                    {chip.label}
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                        on ? "bg-white/15" : "bg-track"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
            {log.sessions.map((session) => (
              <SessionCard
                key={session.startedAt}
                session={session}
                items={visible.filter(
                  (item) =>
                    item.at >= session.startedAt && item.at <= session.endedAt,
                )}
                today={today}
                open={open}
                detail={detail}
                params={rowParams}
              />
            ))}
          </>
        )}

        {mode === "days" && (
          <div className="flex flex-col gap-3">
            {groupBy(log.sessions, (session) => session.date).map(
              ([date, sessions]) => (
                <SummaryRow
                  key={date}
                  href={`/work?date=${date}`}
                  label={formatDate(date)}
                  badge={date === today ? "오늘" : undefined}
                  sessions={sessions}
                />
              ),
            )}
          </div>
        )}

        {mode === "months" && (
          <div className="flex flex-col gap-3">
            {groupBy(log.sessions, (session) => session.date.slice(0, 7)).map(
              ([month, sessions]) => (
                <SummaryRow
                  key={month}
                  href={`/work?month=${month}`}
                  label={`${Number(month.slice(5))}월`}
                  sessions={sessions}
                  extra={`작업한 날 ${new Set(sessions.map((s) => s.date)).size}일`}
                />
              ),
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-6 px-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-brand">{periodLabel}</span>
          <h1 className="text-[34px] leading-tight font-bold tracking-[-0.02em] text-ink-strong">
            작업 기록
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="기간"
            className="flex gap-1 rounded-full bg-white p-[5px] shadow-seg"
          >
            {RANGES.map(({ key, label }) => (
              <Link
                key={key}
                href={key === "today" ? "/work" : `/work?range=${key}`}
                aria-current={key === range ? "page" : undefined}
                className={`rounded-full px-[22px] py-2.5 text-sm ${
                  key === range
                    ? "bg-brand font-semibold text-white shadow-seg-active"
                    : "font-medium text-ink-soft hover:bg-[#eaf3ed]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {mode === "day" && (
            <Link
              href={`/work?date=${addDays(from, -1)}`}
              aria-label="이전 날"
              className={dayLink}
            >
              ‹
            </Link>
          )}
          <DatePicker
            value={from}
            max={today}
            active={pickedDate !== null}
            basePath="/work"
          />
          {mode === "day" && next <= today && (
            <Link
              href={`/work?date=${next}`}
              aria-label="다음 날"
              className={dayLink}
            >
              ›
            </Link>
          )}
        </div>
      </div>
      {content}
    </main>
  );
}
