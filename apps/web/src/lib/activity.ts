import {
  ActivityDashboardSchema,
  ActivityRangeSchema,
  GithubSyncStatusSchema,
  type ActivityDashboard,
  type ActivityRange,
  type GithubSyncStatus,
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
