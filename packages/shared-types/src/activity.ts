import { z } from 'zod';

// 작업 흔적의 출처. Notion 편집은 동기화가 붙을 때 추가한다.
export const ActivitySourceSchema = z.enum(['github', 'capture']);
export type ActivitySource = z.infer<typeof ActivitySourceSchema>;

// 하루를 30분 칸 48개로 나눈 것 중 흔적이 있는 칸 ("작업 블록")
export const ActivityBlockSchema = z.object({
  // 0 = 00:00~00:30, 47 = 23:30~24:00
  index: z.number().int().min(0).max(47),
  sources: z.array(ActivitySourceSchema),
});
export type ActivityBlock = z.infer<typeof ActivityBlockSchema>;

export const ActivityDaySchema = z.object({
  date: z.iso.date(),
  activeBlocks: z.number().int(),
  commits: z.number().int(),
  captures: z.number().int(),
  // 자리를 비웠다 돌아와서 남긴 캡처 수 (triggerType이 idle_resume)
  resumes: z.number().int(),
});
export type ActivityDay = z.infer<typeof ActivityDaySchema>;

export const RecentCommitSchema = z.object({
  repo: z.string(),
  message: z.string(),
  committedAt: z.iso.datetime({ offset: true }),
});
export type RecentCommit = z.infer<typeof RecentCommitSchema>;

export const GithubSyncStatusSchema = z.object({
  // GITHUB_TOKEN이 설정돼 있는지
  enabled: z.boolean(),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  lastError: z.string().nullable(),
});
export type GithubSyncStatus = z.infer<typeof GithubSyncStatusSchema>;

export const ActivityDashboardSchema = z.object({
  // 기준일과, 날짜 경계를 자를 때 쓴 시간대
  date: z.iso.date(),
  timeZone: z.string(),
  // 기준일의 작업 블록 (index 오름차순)
  blocks: z.array(ActivityBlockSchema),
  // 기준일까지 최근 28일 (오래된 날부터, 마지막이 기준일)
  days: z.array(ActivityDaySchema),
  recentCommits: z.array(RecentCommitSchema),
  githubSync: GithubSyncStatusSchema,
});
export type ActivityDashboard = z.infer<typeof ActivityDashboardSchema>;

// GET /activity/dashboard 쿼리. date를 생략하면 오늘.
export const ActivityDashboardQuerySchema = z.object({
  date: z.iso.date().optional(),
});
export type ActivityDashboardQuery = z.infer<
  typeof ActivityDashboardQuerySchema
>;

export const GithubSyncResultSchema = z.object({
  // 이번에 새로 저장한 커밋 수와, 커밋이 있었던 레포 수
  inserted: z.number().int(),
  repos: z.number().int(),
});
export type GithubSyncResult = z.infer<typeof GithubSyncResultSchema>;

// 기간 조회에서 쓰는, 날짜가 붙은 작업 블록
export const DatedActivityBlockSchema = ActivityBlockSchema.extend({
  date: z.iso.date(),
});
export type DatedActivityBlock = z.infer<typeof DatedActivityBlockSchema>;

export const ActivityRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  timeZone: z.string(),
  // from부터 to까지 하루도 빠짐없이 (오래된 날부터)
  days: z.array(ActivityDaySchema),
  // 흔적이 있는 칸만 (날짜, index 오름차순)
  blocks: z.array(DatedActivityBlockSchema),
});
export type ActivityRange = z.infer<typeof ActivityRangeSchema>;

const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /activity/range 쿼리. 양 끝 날짜를 포함하고 최대 366일.
export const ActivityRangeQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => from <= to, {
    path: ['to'],
    error: 'to는 from보다 빠를 수 없습니다',
  })
  .refine(
    ({ from, to }) =>
      (Date.parse(to) - Date.parse(from)) / DAY_MS < MAX_RANGE_DAYS,
    { path: ['to'], error: `기간은 최대 ${MAX_RANGE_DAYS}일입니다` },
  );
export type ActivityRangeQuery = z.infer<typeof ActivityRangeQuerySchema>;
