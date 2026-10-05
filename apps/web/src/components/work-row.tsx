import {
  PRESET_TAG_LABELS,
  PresetTagSchema,
  type RecentWork,
} from "@adhd-irection/shared-types";
import Link from "next/link";
import { dateOf, TIME_ZONE } from "@/lib/dates";
import { WorkDetailPanel, type WorkDetail } from "./work-detail";

// 주소의 ?open=…&ref=…&at=… 로 "펼쳐 둔 줄"을 가리킨다.
export interface OpenWork {
  kind: "commit" | "notion";
  ref: string;
  at: string;
}

export function parseOpenWork(
  params: Record<string, string | string[] | undefined>,
): OpenWork | null {
  return (params.open === "commit" || params.open === "notion") &&
    typeof params.ref === "string" &&
    typeof params.at === "string"
    ? { kind: params.open, ref: params.ref, at: params.at }
    : null;
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

const ICONS = {
  // 병합 커밋
  merge: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 7v10" />
      <path d="M6 7c0 4 4 5 10 5" />
    </>
  ),
  commit: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M2 12h6.5" />
      <path d="M15.5 12H22" />
    </>
  ),
  // Notion 페이지 편집 (문서 모양)
  notion: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h5" />
      <path d="M10 16h5" />
    </>
  ),
  // 캡처 (깃발: 그 순간의 상태를 꽂아 둔 것)
  capture: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2 4 2 4H6" />
    </>
  ),
};

// 종류별 아이콘 바탕색과 선 색
const TONES = {
  commit: { bg: "bg-brand-soft", stroke: "#1B6E42" },
  notion: { bg: "bg-[#e2f1f3]", stroke: "#1D5F6B" },
  capture: { bg: "bg-[#eef2ef]", stroke: "#0F4A2E" },
};

function titleOf(work: RecentWork): string {
  if (work.kind !== "capture") return work.title;
  // 태그 캡처는 코드값(blocked 등)으로 저장돼 있어 한글 라벨로 바꾼다.
  const tag = PresetTagSchema.safeParse(work.title);
  return tag.success ? PRESET_TAG_LABELS[tag.data] : work.title;
}

function subtitleOf(work: RecentWork): string {
  if (work.kind === "notion") return "Notion 편집";
  if (work.kind === "capture") {
    return work.detail ? `캡처 · ${work.detail}` : "캡처";
  }
  return work.detail ?? "";
}

/**
 * 작업 한 줄. 커밋과 Notion 편집은 누르면 그 아래에 상세가 펼쳐지고 다시 누르면 접힌다.
 * `path`와 `params`는 지금 보고 있는 화면의 주소로, 펼침 상태만 덧붙여 링크를 만든다.
 */
export function WorkRow({
  work,
  today,
  open,
  detail,
  path,
  params = {},
}: {
  work: RecentWork;
  today: string;
  open: OpenWork | null;
  detail: WorkDetail | null;
  path: string;
  params?: Record<string, string>;
}) {
  const at = new Date(work.at);
  // 오늘 것은 시각만, 다른 날 것은 날짜까지 보여준다.
  const time =
    dateOf(work.at) === today ? clock.format(at) : dayAndClock.format(at);
  const icon =
    work.kind === "commit" && work.title.startsWith("Merge ")
      ? "merge"
      : work.kind;
  const tone = TONES[work.kind];
  const isOpen =
    open !== null &&
    open.kind === work.kind &&
    open.ref === work.ref &&
    open.at === work.at;

  const body = (
    <>
      <span
        className={`flex size-9 flex-none items-center justify-center rounded-[10px] ${tone.bg}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={tone.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {ICONS[icon]}
        </svg>
      </span>
      <div className="flex min-w-0 flex-auto flex-col gap-[3px]">
        <span className="truncate text-[15px] font-medium">
          {titleOf(work)}
        </span>
        <span className="truncate text-[13px] text-subtle">
          {subtitleOf(work)}
        </span>
      </div>
      <span className="flex-none rounded-full bg-pill px-2.5 py-1 font-mono text-[13px] text-ink-soft">
        {time}
      </span>
    </>
  );
  const rowClass = "-mx-3 flex items-center gap-3.5 rounded-xl p-3";

  // 캡처는 펼칠 상세가 없다.
  if (work.kind === "capture") {
    return (
      <div className={rowClass}>
        {body}
        <span className="w-4 flex-none" />
      </div>
    );
  }

  const query = new URLSearchParams(
    isOpen
      ? params
      : { ...params, open: work.kind, ref: work.ref, at: work.at },
  ).toString();
  return (
    <div>
      <Link
        href={query ? `${path}?${query}` : path}
        scroll={false}
        aria-expanded={isOpen}
        className={`${rowClass} hover:bg-row ${isOpen ? "bg-row" : ""}`}
      >
        {body}
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
          className={`flex-none text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>
      {isOpen && detail && <WorkDetailPanel detail={detail} />}
    </div>
  );
}
