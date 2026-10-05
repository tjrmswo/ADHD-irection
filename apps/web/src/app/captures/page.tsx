import type { Capture } from "@adhd-irection/shared-types";
import type { Metadata } from "next";
import Link from "next/link";
import { CaptureList } from "@/components/capture-list";
import { DatePicker } from "@/components/date-picker";
import { fetchCaptures } from "@/lib/captures";
import {
  addDays,
  formatDate,
  isDate,
  monthRange,
  startOfDay,
  today as todayDate,
  weekRange,
} from "@/lib/dates";

export const metadata: Metadata = { title: "캡처 기록" };

// 한 기간에 불러오는 최대 건수 (API 상한)
const LIMIT = 500;

const RANGES = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const dayLink =
  "inline-flex size-11 items-center justify-center rounded-full bg-white text-ink-soft shadow-seg hover:bg-[#eaf3ed]";

export default async function CapturesPage({
  searchParams,
}: PageProps<"/captures">) {
  const params = await searchParams;
  const today = todayDate();

  // ?date=YYYY-MM-DD 가 있으면 그 날 하루, 없으면 ?range (기본 오늘)
  const picked = isDate(params.date) && params.date <= today ? params.date : null;
  const range: RangeKey | null = picked
    ? null
    : (RANGES.find(({ key }) => key === params.range)?.key ?? "today");

  let from = picked ?? today;
  let to = from;
  if (range === "week") ({ from, to } = weekRange(today));
  if (range === "month") ({ from, to } = monthRange(today));
  const singleDay = from === to;

  // 조회만 try 안에서 하고, 화면은 그 결과로 바깥에서 그린다.
  let captures: Capture[] | undefined;
  let failure: string | undefined;
  try {
    captures = await fetchCaptures({
      limit: LIMIT,
      after: startOfDay(from),
      before: startOfDay(addDays(to, 1)),
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  const next = addDays(from, 1);

  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-5 px-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-brand">
            {singleDay
              ? formatDate(from, "long")
              : `${formatDate(from)} ~ ${formatDate(to)}`}
          </span>
          <h1 className="text-[34px] leading-tight font-bold tracking-[-0.02em] text-ink-strong">
            캡처 기록
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
                href={key === "today" ? "/captures" : `/captures?range=${key}`}
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
          {singleDay && (
            <Link
              href={`/captures?date=${addDays(from, -1)}`}
              aria-label="이전 날"
              className={dayLink}
            >
              ‹
            </Link>
          )}
          <DatePicker
            value={from}
            max={today}
            active={picked !== null}
            basePath="/captures"
          />
          {singleDay && next <= today && (
            <Link
              href={`/captures?date=${next}`}
              aria-label="다음 날"
              className={dayLink}
            >
              ›
            </Link>
          )}
        </div>
      </div>

      {captures ? (
        <>
          <CaptureList
            // 기간이 바뀌면 상태 필터를 처음으로 되돌린다.
            key={`${from}_${to}`}
            captures={captures}
            today={today}
            layout={singleDay ? "day" : "days"}
          />
          {captures.length === LIMIT && (
            <p className="text-sm text-subtle">
              이 기간의 최근 {LIMIT}건만 표시했습니다. 날짜를 골라 나눠서
              보세요.
            </p>
          )}
        </>
      ) : (
        <section className="flex flex-col gap-2 rounded-[18px] bg-white p-7 shadow-card">
          <p className="font-medium">
            캡처를 불러오지 못했습니다. API 서버(<code>pnpm dev:api</code>)가 떠
            있는지 확인하세요.
          </p>
          <p className="text-sm text-subtle">{failure}</p>
        </section>
      )}
    </main>
  );
}
