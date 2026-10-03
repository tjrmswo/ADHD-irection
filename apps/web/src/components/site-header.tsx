import type { GithubSyncStatus } from "@adhd-irection/shared-types";
import Link from "next/link";
import { fetchSyncStatus } from "@/lib/activity";
import { TIME_ZONE } from "@/lib/dates";
import { SiteNav } from "./site-nav";

const syncTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 점 색으로 정상(초록) / 주의(주황) / 꺼짐(회색)을 구분하고, 글자로도 상태를 적는다.
function syncPill(status: GithubSyncStatus | null): {
  dot: string;
  label: string;
} {
  if (!status) return { dot: "bg-faint", label: "API 연결 안 됨" };
  if (!status.enabled) return { dot: "bg-faint", label: "GitHub 동기화 꺼짐" };
  if (status.lastError) {
    return { dot: "bg-[#e09a2b]", label: "GitHub 동기화 실패" };
  }
  if (!status.lastSyncedAt) {
    return { dot: "bg-[#e09a2b]", label: "GitHub 동기화 중…" };
  }
  return {
    dot: "bg-[#2e9b5f] shadow-[0_0_0_3px_rgba(46,155,95,0.18)]",
    label: `GitHub 동기화 · ${syncTime.format(new Date(status.lastSyncedAt))}`,
  };
}

export async function SiteHeader() {
  const pill = syncPill(await fetchSyncStatus().catch(() => null));
  return (
    <header className="border-b border-line bg-white shadow-header">
      <div className="mx-auto flex min-h-[72px] max-w-[1120px] flex-wrap items-stretch gap-x-10 px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink-strong">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-brand shadow-logo">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3l7 18-7-4-7 4z" />
            </svg>
          </span>
          <span className="text-[17px] font-bold tracking-[-0.01em]">
            ADHD-irection
          </span>
        </Link>
        <SiteNav />
        <div className="flex items-center py-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-pill px-3.5 py-2 text-[13px] text-ink-soft">
            <span className={`size-2 rounded-full ${pill.dot}`} />
            {pill.label}
          </span>
        </div>
      </div>
    </header>
  );
}
