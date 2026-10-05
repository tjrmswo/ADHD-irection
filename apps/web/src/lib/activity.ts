import {
  ActivityDashboardSchema,
  ActivityRangeSchema,
  CommitDetailSchema,
  GithubSyncStatusSchema,
  NotionPageDetailSchema,
  WorkItemsSchema,
  WorkLogSchema,
  type ActivityDashboard,
  type ActivityRange,
  type CommitDetail,
  type GithubSyncStatus,
  type NotionPageDetail,
  type RecentWork,
  type WorkLog,
} from "@adhd-irection/shared-types";
import { API_URL } from "./api";

export async function fetchDashboard(): Promise<ActivityDashboard> {
  const res = await fetch(`${API_URL}/activity/dashboard`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`활동 조회 실패 (${res.status})`);
  return ActivityDashboardSchema.parse(await res.json());
}

export async function fetchRange(
  from: string,
  to: string,
): Promise<ActivityRange> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`${API_URL}/activity/range?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`활동 조회 실패 (${res.status})`);
  return ActivityRangeSchema.parse(await res.json());
}

export async function fetchSyncStatus(): Promise<GithubSyncStatus> {
  const res = await fetch(`${API_URL}/github/sync`, { cache: "no-store" });
  if (!res.ok) throw new Error(`동기화 상태 조회 실패 (${res.status})`);
  return GithubSyncStatusSchema.parse(await res.json());
}

// 커밋 한 건의 전체 메시지와 바뀐 파일 (API가 GitHub에서 가져온다)
export async function fetchCommitDetail(sha: string): Promise<CommitDetail> {
  const res = await fetch(
    `${API_URL}/github/commits/${encodeURIComponent(sha)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`커밋 조회 실패 (${res.status})`);
  return CommitDetailSchema.parse(await res.json());
}

// Notion 페이지의 현재 내용 (API가 Notion에서 가져온다)
export async function fetchNotionPage(
  pageId: string,
): Promise<NotionPageDetail> {
  const res = await fetch(
    `${API_URL}/notion/pages/${encodeURIComponent(pageId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Notion 페이지 조회 실패 (${res.status})`);
  return NotionPageDetailSchema.parse(await res.json());
}

// 기간 안의 작업 구간과 가장 많이 한 것
export async function fetchWorkLog(from: string, to: string): Promise<WorkLog> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`${API_URL}/activity/log?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`작업 기록 조회 실패 (${res.status})`);
  return WorkLogSchema.parse(await res.json());
}

// 하루의 개별 작업 (커밋, Notion 편집, 캡처) 최신순
export async function fetchWorkItems(date: string): Promise<RecentWork[]> {
  const res = await fetch(`${API_URL}/activity/log/items?date=${date}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`작업 목록 조회 실패 (${res.status})`);
  return WorkItemsSchema.parse(await res.json()).items;
}
