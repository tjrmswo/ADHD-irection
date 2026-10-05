import { z } from 'zod';

// 작업 흔적의 출처. usage는 작업용 앱을 쓰고 있던 사용 흔적, notion은 Notion 페이지 편집이다.
export const ActivitySourceSchema = z.enum([
  'github',
  'capture',
  'usage',
  'notion',
]);
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

// 작업 목록의 한 줄: 커밋, Notion 페이지 편집, 캡처
export const RecentWorkSchema = z.object({
  kind: z.enum(['commit', 'notion', 'capture']),
  // 커밋 메시지 첫 줄 / Notion 페이지 제목 / 캡처 내용(태그 코드값 또는 음성 메모 글)
  title: z.string(),
  // 커밋은 레포("owner/name"), 캡처는 그때 쓰던 앱과 창 제목, Notion은 null
  detail: z.string().nullable(),
  at: z.iso.datetime({ offset: true }),
  // 상세 조회에 쓰는 키: 커밋은 sha, Notion은 페이지 ID, 캡처는 캡처 ID
  ref: z.string(),
});
export type RecentWork = z.infer<typeof RecentWorkSchema>;

// 외부 서비스(GitHub, Notion) 동기화의 상태
export const SyncStatusSchema = z.object({
  // 토큰(GITHUB_TOKEN, NOTION_TOKEN)이 설정돼 있는지
  enabled: z.boolean(),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  lastError: z.string().nullable(),
});
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const GithubSyncStatusSchema = SyncStatusSchema;
export type GithubSyncStatus = SyncStatus;

export const ActivityDashboardSchema = z.object({
  // 기준일과, 날짜 경계를 자를 때 쓴 시간대
  date: z.iso.date(),
  timeZone: z.string(),
  // 기준일의 작업 블록 (index 오름차순)
  blocks: z.array(ActivityBlockSchema),
  // 기준일까지 최근 28일 (오래된 날부터, 마지막이 기준일)
  days: z.array(ActivityDaySchema),
  // 기준일까지의 최근 커밋과 Notion 편집 (최신순)
  recentWork: z.array(RecentWorkSchema),
  githubSync: GithubSyncStatusSchema,
  notionSync: SyncStatusSchema,
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

// 가장 최근에 이어서 작업한 구간 ("떠나기 전에 뭘 하고 있었나").
// 흔적 사이가 30분 넘게 벌어지지 않은 연속 구간 하나를 말한다.
export const ActivityRecapSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  // 마지막 흔적이 남은 시각
  endedAt: z.iso.datetime({ offset: true }),
  commits: z.number().int(),
  captures: z.number().int(),
  // Notion 페이지가 편집된 것으로 관측된 횟수
  notionEdits: z.number().int(),
  // 그 구간에서 마지막으로 편집한 Notion 페이지의 제목
  lastNotionPage: z.string().nullable(),
  // 그 구간의 마지막 커밋
  lastCommit: RecentCommitSchema.nullable(),
  // 그 구간에서 마지막으로 기록된, 쓰고 있던 앱 (캡처 또는 사용 흔적)
  lastContext: z
    .object({
      activeApp: z.string(),
      windowTitle: z.string().nullable(),
    })
    .nullable(),
});
export type ActivityRecap = z.infer<typeof ActivityRecapSchema>;

// 최근 12시간 안에 흔적이 없으면 recap은 null
export const ActivityRecapResponseSchema = z.object({
  recap: ActivityRecapSchema.nullable(),
});
export type ActivityRecapResponse = z.infer<typeof ActivityRecapResponseSchema>;

// GET /activity/recap 쿼리. at을 생략하면 지금 기준.
export const ActivityRecapQuerySchema = z.object({
  at: z.iso.datetime({ offset: true }).optional(),
});
export type ActivityRecapQuery = z.infer<typeof ActivityRecapQuerySchema>;

// 동기화 한 번의 결과 (새로 저장한 건수)
export const SyncResultSchema = z.object({ inserted: z.number().int() });
export type SyncResult = z.infer<typeof SyncResultSchema>;

// 커밋 한 건의 상세 (클릭했을 때 GitHub에서 가져온다)
export const CommitDetailSchema = z.object({
  repo: z.string(),
  sha: z.string(),
  // 제목 줄을 포함한 전체 커밋 메시지
  message: z.string(),
  url: z.string(),
  committedAt: z.iso.datetime({ offset: true }),
  additions: z.number().int(),
  deletions: z.number().int(),
  // 바뀐 파일 전체 개수와, 그중 앞에서부터 보여줄 만큼
  fileCount: z.number().int(),
  files: z.array(
    z.object({
      path: z.string(),
      status: z.string(),
      additions: z.number().int(),
      deletions: z.number().int(),
    }),
  ),
});
export type CommitDetail = z.infer<typeof CommitDetailSchema>;

// Notion 페이지의 현재 내용 (클릭했을 때 Notion에서 가져온다).
// Notion은 무엇이 바뀌었는지 알려주지 않으므로 편집 당시가 아니라 지금의 내용이다.
export const NotionPageDetailSchema = z.object({
  pageId: z.string(),
  title: z.string().nullable(),
  url: z.string(),
  lastEditedAt: z.iso.datetime({ offset: true }),
  // 최상위 블록을 위에서부터 (하위 블록은 펼치지 않는다)
  blocks: z.array(
    z.object({
      // paragraph, heading_1, bulleted_list_item, to_do, code, child_page ...
      type: z.string(),
      text: z.string(),
      // to_do 블록만 값이 있다
      checked: z.boolean().nullable(),
    }),
  ),
  // 블록이 더 있어서 잘랐는지
  truncated: z.boolean(),
});
export type NotionPageDetail = z.infer<typeof NotionPageDetailSchema>;

const AppMinutesSchema = z.object({
  name: z.string(),
  // 사용 흔적이 1분마다 찍히므로 찍힌 횟수가 곧 분이다
  minutes: z.number().int(),
});

// 작업 구간: 흔적 사이가 30분 넘게 벌어지지 않은 연속 구간 (복귀 요약과 같은 기준)
export const WorkSessionSchema = z.object({
  // 구간이 시작된 날짜 (기준 시간대)
  date: z.iso.date(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  commits: z.number().int(),
  captures: z.number().int(),
  notionEdits: z.number().int(),
  // 작업용 앱을 쓰고 있던 시간
  usageMinutes: z.number().int(),
  // 많이 쓴 순서
  apps: z.array(AppMinutesSchema),
  // 주로 본 화면 (하루만 조회할 때만 채운다).
  // 작업 도구는 창 제목, 브라우저는 사이트 이름까지만 (탭 제목은 내보내지 않는다).
  screens: z.array(
    z.object({
      app: z.string(),
      title: z.string(),
      minutes: z.number().int(),
      // 작업과 무관하게 시간을 쓰기 쉬운 사이트인지
      distraction: z.boolean(),
    }),
  ),
});
export type WorkSession = z.infer<typeof WorkSessionSchema>;

const CountedSchema = z.object({ name: z.string(), count: z.number().int() });

// 작업 기록: 기간 안의 작업 구간(최신순)과, 그 기간에 가장 많이 한 것
export const WorkLogSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  timeZone: z.string(),
  sessions: z.array(WorkSessionSchema),
  top: z.object({
    // 커밋 수가 많은 레포
    repos: z.array(CountedSchema),
    // 편집 횟수가 많은 Notion 페이지
    notionPages: z.array(CountedSchema),
    // 오래 쓴 작업용 앱
    apps: z.array(AppMinutesSchema),
    // 브라우저에서 오래 본 사이트 (이름을 아는 사이트만, 나머지는 "기타 사이트")
    sites: z.array(AppMinutesSchema.extend({ distraction: z.boolean() })),
  }),
});
export type WorkLog = z.infer<typeof WorkLogSchema>;

// 하루의 개별 작업 (최신순)
export const WorkItemsSchema = z.object({
  date: z.iso.date(),
  items: z.array(RecentWorkSchema),
});
export type WorkItems = z.infer<typeof WorkItemsSchema>;

// GET /activity/log/items 쿼리
export const WorkItemsQuerySchema = z.object({ date: z.iso.date() });
export type WorkItemsQuery = z.infer<typeof WorkItemsQuerySchema>;
