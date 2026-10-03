"use client";

import {
  PRESET_TAG_LABELS,
  PresetTagSchema,
  type Capture,
  type PresetTag,
} from "@adhd-irection/shared-types";
import { useCallback, useEffect, useState } from "react";
import { dateOf, formatDate, TIME_ZONE } from "@/lib/dates";

// 상태별 색. 색만으로 구분하지 않도록 항상 라벨을 함께 쓴다.
const TAG_STYLES: Record<PresetTag, { pill: string; dot: string }> = {
  almost_done: { pill: "bg-[#e3f3e9] text-[#16603a]", dot: "bg-[#2e9b5f]" },
  blocked: { pill: "bg-[#fdf0dc] text-[#7a4a00]", dot: "bg-[#e09a2b]" },
  break: { pill: "bg-[#eef2ef] text-[#45544b]", dot: "bg-[#8a9a90]" },
  switched: { pill: "bg-[#e2f1f3] text-[#1d5f6b]", dot: "bg-[#3a9aaa]" },
};
// 디자인의 필터 순서
const TAG_ORDER: PresetTag[] = ["almost_done", "blocked", "break", "switched"];

const TRIGGER_LABELS: Record<NonNullable<Capture["triggerType"]>, string> = {
  idle_resume: "복귀",
  manual: "수동",
};

const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Filter = "all" | PresetTag;

function tagOf(capture: Capture): PresetTag | null {
  const tag = PresetTagSchema.safeParse(capture.content);
  return capture.type === "tag" && tag.success ? tag.data : null;
}

// 마우스를 올린 줄의 전체 내용을 보여주는 말풍선의 대상과 위치
interface Tip {
  capture: Capture;
  // 줄의 화면상 위치 (뷰포트 기준)
  left: number;
  top: number;
  bottom: number;
  width: number;
}

// 한 화면에 많이 들어오도록 한 줄로 촘촘하게 그린다.
// 앱·창 제목은 좁은 카드에서 잘리므로, 마우스를 올리면(또는 Tab으로 가면) 말풍선으로 전체를 보여준다.
function CaptureRow({
  capture,
  onTip,
}: {
  capture: Capture;
  onTip: (tip: Tip | null) => void;
}) {
  const tag = tagOf(capture);
  // 출처는 대부분 데스크톱이라 웹에서 남긴 것만 표시한다.
  const marks = [
    capture.triggerType && TRIGGER_LABELS[capture.triggerType],
    capture.source === "web" && "웹",
  ].filter((mark): mark is string => Boolean(mark));

  // 보여줄 내용(직전에 쓰던 앱)이 없는 줄에는 말풍선을 띄우지 않는다.
  const show = (element: HTMLElement) => {
    if (!capture.activeApp) return;
    const { left, top, bottom, width } = element.getBoundingClientRect();
    onTip({ capture, left, top, bottom, width });
  };

  return (
    <div
      tabIndex={capture.activeApp ? 0 : undefined}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => onTip(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => onTip(null)}
      className="flex break-inside-avoid items-center gap-3 rounded-lg px-3 py-2 outline-none hover:bg-row focus-visible:bg-row"
    >
      <time
        dateTime={capture.capturedAt}
        className="w-11 flex-none font-mono text-[13px] text-ink-soft"
      >
        {clock.format(new Date(capture.capturedAt))}
      </time>
      {tag ? (
        <span
          className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${TAG_STYLES[tag].pill}`}
        >
          <span className={`size-1.5 rounded-full ${TAG_STYLES[tag].dot}`} />
          {PRESET_TAG_LABELS[tag]}
        </span>
      ) : (
        <span className="min-w-0 truncate text-sm">{capture.content}</span>
      )}
      <span className="flex min-w-0 flex-auto items-center gap-2 text-[13px] text-ink-soft">
        {capture.activeApp && (
          <span className="max-w-[120px] flex-none truncate rounded-md bg-track px-1.5 py-0.5 font-medium text-ink">
            {capture.activeApp}
          </span>
        )}
        {capture.windowTitle && (
          <span className="truncate">{capture.windowTitle}</span>
        )}
      </span>
      {marks.map((mark) => (
        <span
          key={mark}
          className="flex-none rounded-full border border-[#dde5df] px-2 py-0.5 text-xs text-muted"
        >
          {mark}
        </span>
      ))}
    </div>
  );
}

const TIP_WIDTH = 360;
// 줄 아래에 띄울 자리가 이만큼 안 남으면 줄 위에 띄운다.
const TIP_ROOM = 120;

// 스크롤되는 카드에 잘리지 않도록 화면 기준(fixed)으로 띄운다.
function CaptureTip({ tip }: { tip: Tip }) {
  const { capture } = tip;
  const above = window.innerHeight - tip.bottom < TIP_ROOM;
  const width = Math.min(TIP_WIDTH, window.innerWidth - 16);
  const left = Math.max(8, Math.min(tip.left, window.innerWidth - width - 8));
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-10 rounded-xl bg-ink-strong px-3.5 py-3 text-[13px] text-white shadow-hero"
      style={{
        left,
        width,
        ...(above
          ? { bottom: window.innerHeight - tip.top + 6 }
          : { top: tip.bottom + 6 }),
      }}
    >
      <p className="font-semibold break-words">{capture.activeApp}</p>
      {capture.windowTitle && (
        <p className="mt-1 break-words text-brand-tint">
          {capture.windowTitle}
        </p>
      )}
    </div>
  );
}

// 스크롤 안내를 이미 따라 해 봤는지. 한 번 넘겨 본 뒤로는 다시 띄우지 않는다.
const HINT_SEEN_KEY = "captures-scroll-hint-seen";

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 옆으로 나열한 날짜 카드(왼쪽이 최신)가 화면 밖으로 넘치는지 지켜본다.
 * - hidden: 오른쪽 화면 밖에 남은 카드 수 (0보다 크면 오른쪽 끝을 흐리게 한다)
 * - showHint: 아직 넘겨 본 적이 없어서 "옆으로 넘기면 N일 더" 안내를 띄울지
 */
function useDayScroller() {
  // 카드 줄 요소. 주·월 보기에서만 그려지므로 ref 콜백으로 받아 둔다.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const measure = useCallback((scroller: HTMLDivElement) => {
    const edge = scroller.getBoundingClientRect().right;
    const remaining = [...scroller.children].filter(
      // 1px은 소수점 반올림 여유
      (card) => card.getBoundingClientRect().right > edge + 1,
    ).length;
    setHidden(remaining);
    setShowHint(remaining > 0 && !hintSeen());
  }, []);

  // 카드 줄이 그려지거나 크기가 바뀔 때마다 다시 잰다.
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(() => measure(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, measure]);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollLeft > 8) {
      try {
        localStorage.setItem(HINT_SEEN_KEY, "1");
      } catch {
        // 저장이 막혀 있으면 이번 화면에서만 숨긴다.
      }
    }
    measure(event.currentTarget);
  };

  const scrollNext = () =>
    element?.scrollBy({ left: element.clientWidth * 0.8, behavior: "smooth" });

  return { attach: setElement, onScroll, scrollNext, hidden, showHint };
}

/**
 * 최신순으로 받은 캡처에 상태 필터를 걸어 보여준다.
 * - day: 하루치를 카드 하나에 (넓은 화면에서는 2단)
 * - days: 날짜별 카드를 옆으로 나열 (넘치면 가로 스크롤)
 */
export function CaptureList({
  captures,
  today,
  layout,
}: {
  captures: Capture[];
  today: string;
  layout: "day" | "days";
}) {
  const [filter, setFilter] = useState<Filter>("all");
  // 마우스를 올린 줄의 말풍선. 스크롤하면 줄 위치가 바뀌므로 닫는다.
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    const close = () => setTip(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);
  const row = (capture: Capture) => (
    <CaptureRow key={capture.id} capture={capture} onTip={setTip} />
  );

  const { attach, onScroll, scrollNext, hidden, showHint } = useDayScroller();

  const chips: { key: Filter; label: string; dot: string; count: number }[] = [
    { key: "all", label: "전체", dot: "bg-ink", count: captures.length },
    ...TAG_ORDER.map((tag) => ({
      key: tag,
      label: PRESET_TAG_LABELS[tag],
      dot: TAG_STYLES[tag].dot,
      count: captures.filter((capture) => tagOf(capture) === tag).length,
    })),
  ];

  const visible = captures.filter(
    (capture) => filter === "all" || tagOf(capture) === filter,
  );
  const groups = new Map<string, Capture[]>();
  for (const capture of visible) {
    const date = dateOf(capture.capturedAt);
    groups.set(date, [...(groups.get(date) ?? []), capture]);
  }

  const empty = (
    <p className="rounded-[18px] bg-white px-6 py-8 text-sm text-subtle shadow-card">
      {captures.length === 0
        ? "이 기간에는 캡처가 없어요."
        : "이 기간에는 해당 상태의 캡처가 없어요."}
    </p>
  );

  return (
    <>
      <div role="group" aria-label="상태 필터" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(chip.key)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-chip hover:shadow-chip-hover ${
                on
                  ? "border-brand-deep bg-brand-deep text-white"
                  : "border-[#e1e8e3] bg-white text-ink"
              }`}
            >
              <span
                className={`size-2 rounded-full ${on ? "bg-white" : chip.dot}`}
              />
              {chip.label}
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                  on ? "bg-white/15" : "bg-track"
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
        {/* 카드를 가리지 않도록 필터 줄 오른쪽 끝에 둔다. */}
        {showHint && (
          <button
            type="button"
            onClick={scrollNext}
            className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-brand-deep px-4 text-sm font-semibold text-white shadow-chip hover:shadow-chip-hover"
          >
            옆으로 넘기면 {hidden}일 더
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
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        empty
      ) : layout === "day" ? (
        <div className="rounded-[18px] bg-white p-3 shadow-card lg:columns-2 lg:gap-6">
          {visible.map(row)}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={attach}
            onScroll={onScroll}
            className="-mx-6 flex snap-x scroll-px-6 items-start gap-4 overflow-x-auto px-6 pb-4"
          >
            {[...groups].map(([date, items]) => (
            <section
              key={date}
              className="flex w-[min(340px,85vw)] flex-none snap-start flex-col rounded-[18px] bg-white p-3 shadow-card"
            >
              <div className="flex items-center gap-2 px-3 pt-1.5 pb-2">
                <h2 className="text-[15px] font-bold text-ink-strong">
                  {formatDate(date)}
                </h2>
                {date === today && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                    오늘
                  </span>
                )}
                <span className="ml-auto text-[13px] text-subtle">
                  {items.length}개
                </span>
              </div>
              {/* 하루치가 길면 카드 안에서 세로로 스크롤한다 (화면 높이에 맞춤). */}
              <div className="max-h-[max(240px,calc(100vh-400px))] overflow-y-auto">
                {items.map(row)}
              </div>
            </section>
            ))}
          </div>
          {hidden > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 -right-6 bottom-4 w-16 bg-gradient-to-l from-page to-transparent"
            />
          )}
        </div>
      )}

      {tip && <CaptureTip tip={tip} />}
    </>
  );
}
