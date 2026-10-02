import {
  PRESET_TAG_LABELS,
  PresetTagSchema,
  type Capture,
} from "@adhd-irection/shared-types";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchCaptures } from "@/lib/captures";

export const metadata: Metadata = { title: "캡처 기록" };

const PAGE_SIZE = 50;

// 서버에서 렌더링하므로 서버 시간대(Vercel은 UTC)에 맡기지 않고 한국 시간으로 고정한다.
const TIME_ZONE = "Asia/Seoul";
const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  dateStyle: "full",
});
const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SOURCE_LABELS: Record<Capture["source"], string> = {
  desktop: "데스크톱",
  web: "웹",
};

function contentLabel(capture: Capture): string {
  const tag = PresetTagSchema.safeParse(capture.content);
  return capture.type === "tag" && tag.success
    ? PRESET_TAG_LABELS[tag.data]
    : capture.content;
}

// 최신순으로 정렬된 캡처를 날짜별로 묶는다.
function groupByDay(captures: Capture[]): [string, Capture[]][] {
  const days = new Map<string, Capture[]>();
  for (const capture of captures) {
    const day = dayFormat.format(new Date(capture.capturedAt));
    days.set(day, [...(days.get(day) ?? []), capture]);
  }
  return [...days];
}

export default async function CapturesPage({
  searchParams,
}: PageProps<"/captures">) {
  const { before } = await searchParams;
  const cursor = typeof before === "string" ? before : undefined;

  let captures: Capture[];
  try {
    captures = await fetchCaptures({ limit: PAGE_SIZE, before: cursor });
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">캡처 기록</h1>
        <p className="mt-6 text-red-600 dark:text-red-400">
          캡처를 불러오지 못했습니다. API 서버(<code>pnpm dev:api</code>)가 떠
          있는지 확인하세요.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </main>
    );
  }

  const last = captures.at(-1);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">캡처 기록</h1>

      {cursor && (
        <Link href="/captures" className="mt-2 inline-block text-sm underline">
          최신 기록으로
        </Link>
      )}

      {captures.length === 0 && (
        <p className="mt-6 text-zinc-500">아직 캡처가 없습니다.</p>
      )}

      {groupByDay(captures).map(([day, items]) => (
        <section key={day} className="mt-8">
          <h2 className="text-sm font-medium text-zinc-500">{day}</h2>
          <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((capture) => (
              <li key={capture.id} className="flex items-center gap-3 py-3">
                <time
                  dateTime={capture.capturedAt}
                  className="w-12 shrink-0 font-mono text-sm text-zinc-500"
                >
                  {timeFormat.format(new Date(capture.capturedAt))}
                </time>
                <span className="min-w-0 flex-1 break-words">
                  {contentLabel(capture)}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {SOURCE_LABELS[capture.source]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {last && captures.length === PAGE_SIZE && (
        <Link
          href={`/captures?before=${encodeURIComponent(last.capturedAt)}`}
          className="mt-8 inline-block text-sm underline"
        >
          이전 기록 더 보기
        </Link>
      )}
    </main>
  );
}
