import type {
  ActivityDashboard,
  ActivityDay,
  ActivityRange,
  ActivityRecap,
  ActivitySource,
  DatedActivityBlock,
  RecentWork,
  WorkLog,
  WorkSession,
} from '@adhd-irection/shared-types';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TEMP_USER_ID } from '../common/temp-user.js';
import { GithubSyncService } from '../github/github-sync.service.js';
import { NotionSyncService } from '../notion/notion-sync.service.js';
import { BROWSER_APPS, OTHER_SITES, siteOf } from '../usage/sites.js';
import { titleVisibleApps, visibleTitle } from '../usage/visibility.js';
import { workApps } from '../usage/work-apps.js';

// 하루의 경계와 30분 칸을 자르는 기준 시간대. 사용자가 한 명이라 상수로 둔다.
const TIME_ZONE = 'Asia/Seoul';
const DAYS = 28;
const RECENT_WORK = 5;
// 작업 기록의 "가장 많이 한 것"에 보여줄 개수
const TOP_COUNT = 5;
// 구간마다 보여줄 앱과 화면 수
const SESSION_APPS = 3;
const SESSION_SCREENS = 5;
// 복귀 요약: 이만큼 거슬러 올라가며, 흔적 사이가 이보다 벌어지면 다른 구간으로 본다.
const RECAP_LOOKBACK = '12 hours';
const RECAP_GAP = '30 minutes';
// 요약 직전에 방금 푸시한 커밋과 방금 편집한 Notion 페이지를 가져오되, 캡처 창이 기다리지 않도록 오래 붙잡지 않는다.
const RECAP_SYNC_WAIT_MS = 1500;

interface BlockRow {
  day: string;
  block: number;
  sources: ActivitySource[];
  commits: number;
  captures: number;
  resumes: number;
}

/** YYYY-MM-DD에 일수를 더한다. */
function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function today(): string {
  // en-CA 로케일의 날짜 형식이 YYYY-MM-DD다.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

/**
 * 한 구간의 (앱, 창 제목, 분) 목록을 내보낼 모양으로 바꾼다.
 * 작업 도구는 창 제목 그대로, 브라우저는 사이트 이름으로 묶는다.
 */
function screensOf(
  rows: { app: string; title: string; minutes: number }[],
): WorkSession['screens'] {
  const merged = new Map<string, WorkSession['screens'][number]>();
  for (const row of rows) {
    const site = BROWSER_APPS.includes(row.app) ? siteOf(row.title) : null;
    const title = site ? site.name : row.title;
    const key = `${row.app}\n${title}`;
    const minutes = (merged.get(key)?.minutes ?? 0) + row.minutes;
    merged.set(key, {
      app: row.app,
      title,
      minutes,
      distraction: site?.distraction ?? false,
    });
  }
  return (
    [...merged.values()]
      // 어느 사이트인지 모르는 묶음은 정보가 없으니 맨 뒤로 보낸다.
      .sort(
        (a, b) =>
          Number(a.title === OTHER_SITES) - Number(b.title === OTHER_SITES) ||
          b.minutes - a.minutes ||
          a.title.localeCompare(b.title),
      )
      .slice(0, SESSION_SCREENS)
  );
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly githubSync: GithubSyncService,
    private readonly notionSync: NotionSyncService,
  ) {}

  /** from부터 to까지(양 끝 포함)의 날짜별 집계와 작업 블록. */
  async range(from: string, to: string): Promise<ActivityRange> {
    // 커밋·캡처·사용 흔적을 한 줄의 "흔적"으로 합친 뒤, 현지 시각 기준 (날짜, 30분 칸)으로 묶는다.
    // 사용 흔적은 작업용 앱을 쓰고 있던 것만 센다.
    // 포크와 원본처럼 같은 커밋(sha)이 여러 레포에 있으면 한 번만 센다.
    const rows = await this.dataSource.query<BlockRow[]>(
      `WITH events AS (
         SELECT committed_at AS at, 'github' AS source, sha AS key, false AS is_resume
         FROM github_events
         UNION ALL
         SELECT captured_at, 'capture', id::text, trigger_type IS NOT DISTINCT FROM 'idle_resume'
         FROM captures
         WHERE user_id = $1
         UNION ALL
         SELECT observed_at, 'usage', id::text, false
         FROM app_usage
         WHERE user_id = $1 AND active_app = ANY($5)
         UNION ALL
         SELECT edited_at, 'notion', id::text, false
         FROM notion_events
       ),
       local AS (
         SELECT at AT TIME ZONE $2 AS local_at, source, key, is_resume
         FROM events
         WHERE at >= $3::date::timestamp AT TIME ZONE $2
           AND at <  ($4::date + 1)::timestamp AT TIME ZONE $2
       )
       SELECT to_char(local_at, 'YYYY-MM-DD') AS day,
              (EXTRACT(hour FROM local_at) * 2
                + floor(EXTRACT(minute FROM local_at) / 30))::int AS block,
              array_agg(DISTINCT source ORDER BY source) AS sources,
              (count(DISTINCT key) FILTER (WHERE source = 'github'))::int AS commits,
              (count(*) FILTER (WHERE source = 'capture'))::int           AS captures,
              (count(*) FILTER (WHERE is_resume))::int                    AS resumes
       FROM local
       GROUP BY day, block
       ORDER BY day, block`,
      [TEMP_USER_ID, TIME_ZONE, from, to, workApps()],
    );

    const days: ActivityDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      days.push({ date, activeBlocks: 0, commits: 0, captures: 0, resumes: 0 });
    }
    const byDate = new Map(days.map((day) => [day.date, day]));
    const blocks: DatedActivityBlock[] = [];
    for (const row of rows) {
      const day = byDate.get(row.day);
      if (!day) continue;
      day.activeBlocks += 1;
      day.commits += row.commits;
      day.captures += row.captures;
      day.resumes += row.resumes;
      blocks.push({ date: row.day, index: row.block, sources: row.sources });
    }
    return { from, to, timeZone: TIME_ZONE, days, blocks };
  }

  async dashboard(date = today()): Promise<ActivityDashboard> {
    const { days, blocks } = await this.range(addDays(date, -(DAYS - 1)), date);

    const recentWork = await this.work({ to: date, limit: RECENT_WORK });

    return {
      date,
      timeZone: TIME_ZONE,
      blocks: blocks
        .filter((block) => block.date === date)
        .map(({ index, sources }) => ({ index, sources })),
      days,
      recentWork,
      githubSync: this.githubSync.status(),
      notionSync: this.notionSync.status(),
    };
  }

  /**
   * 개별 작업을 최신순으로. `to`(포함)까지, `from`을 주면 그 날부터.
   * 커밋과 Notion 편집은 항상 넣고, 캡처는 `captures`일 때만 넣는다.
   * 포크와 원본에 같은 커밋이 있으면 하나만 남긴다.
   */
  async work(options: {
    from?: string;
    to: string;
    limit?: number;
    captures?: boolean;
  }): Promise<RecentWork[]> {
    const rows = await this.dataSource.query<
      {
        kind: RecentWork['kind'];
        title: string;
        detail: string | null;
        at: Date;
        ref: string;
      }[]
    >(
      `SELECT kind, title, detail, at, ref
       FROM (
         (SELECT DISTINCT ON (e.committed_at, e.sha)
                 'commit' AS kind, e.message AS title,
                 r.github_full_name AS detail, e.committed_at AS at, e.sha AS ref
          FROM github_events e
          JOIN repos r ON r.id = e.repo_id
          ORDER BY e.committed_at DESC, e.sha, r.github_full_name)
         UNION ALL
         SELECT 'notion', COALESCE(page_title, '제목 없는 페이지'), NULL, edited_at, page_id
         FROM notion_events
         UNION ALL
         -- 창 제목은 내보내도 되는 앱의 것만 붙인다.
         SELECT 'capture', content,
                CASE WHEN active_app = ANY($7)
                     THEN concat_ws(' — ', active_app, window_title)
                     ELSE active_app END,
                captured_at, id::text
         FROM captures
         WHERE user_id = $5 AND $6::boolean
       ) AS work
       WHERE at < ($1::date + 1)::timestamp AT TIME ZONE $2
         AND ($3::date IS NULL OR at >= $3::date::timestamp AT TIME ZONE $2)
       ORDER BY at DESC
       LIMIT $4`,
      [
        options.to,
        TIME_ZONE,
        options.from ?? null,
        options.limit ?? null,
        TEMP_USER_ID,
        options.captures ?? false,
        titleVisibleApps(),
      ],
    );
    return rows.map((row) => ({ ...row, at: row.at.toISOString() }));
  }

  /** 기간 안의 작업 구간(최신순)과 그 기간에 가장 많이 한 것. */
  async log(from: string, to: string): Promise<WorkLog> {
    // 흔적을 시간순으로 놓고 30분 넘게 벌어진 곳마다 구간 번호를 올린다 (복귀 요약과 같은 방식).
    const numbered = `
      WITH events AS (
        SELECT committed_at AS at, 'github' AS source, sha AS key,
               NULL::text AS app, NULL::text AS title
        FROM github_events
        UNION ALL
        SELECT captured_at, 'capture', id::text, NULL, NULL
        FROM captures
        WHERE user_id = $1
        UNION ALL
        SELECT edited_at, 'notion', id::text, NULL, NULL
        FROM notion_events
        UNION ALL
        SELECT observed_at, 'usage', id::text, active_app, window_title
        FROM app_usage
        WHERE user_id = $1 AND active_app = ANY($5)
      ),
      ranged AS (
        SELECT * FROM events
        WHERE at >= $3::date::timestamp AT TIME ZONE $2
          AND at <  ($4::date + 1)::timestamp AT TIME ZONE $2
      ),
      marked AS (
        SELECT *,
               CASE WHEN at - lag(at) OVER (ORDER BY at) > $6::interval
                    THEN 1 ELSE 0 END AS starts_session
        FROM ranged
      ),
      numbered AS (
        SELECT *, (sum(starts_session) OVER (ORDER BY at))::int AS session
        FROM marked
      )`;
    const params = [TEMP_USER_ID, TIME_ZONE, from, to, workApps(), RECAP_GAP];

    const sessions = await this.dataSource.query<
      {
        session: number;
        date: string;
        started_at: Date;
        ended_at: Date;
        commits: number;
        captures: number;
        notion_edits: number;
        usage_minutes: number;
      }[]
    >(
      `${numbered}
       SELECT session,
              to_char(min(at) AT TIME ZONE $2, 'YYYY-MM-DD') AS date,
              min(at) AS started_at,
              max(at) AS ended_at,
              (count(DISTINCT key) FILTER (WHERE source = 'github'))::int AS commits,
              (count(*) FILTER (WHERE source = 'capture'))::int           AS captures,
              (count(*) FILTER (WHERE source = 'notion'))::int            AS notion_edits,
              (count(*) FILTER (WHERE source = 'usage'))::int             AS usage_minutes
       FROM numbered
       GROUP BY session
       ORDER BY started_at DESC`,
      params,
    );
    const apps = await this.dataSource.query<
      { session: number; app: string; minutes: number }[]
    >(
      `${numbered}
       SELECT session, app, count(*)::int AS minutes
       FROM numbered
       WHERE source = 'usage'
       GROUP BY session, app
       ORDER BY minutes DESC, app`,
      params,
    );
    // 화면(창 제목)은 양이 많아서 하루만 볼 때만 가져온다. 작업 도구는 창 제목 그대로,
    // 브라우저는 탭 제목 대신 사이트 이름으로 바꿔서 내보낸다 (screensOf).
    const screens =
      from === to
        ? await this.dataSource.query<
            { session: number; app: string; title: string; minutes: number }[]
          >(
            `${numbered}
             SELECT session, app, title, count(*)::int AS minutes
             FROM numbered
             WHERE source = 'usage' AND title IS NOT NULL AND app = ANY($7)
             GROUP BY session, app, title
             ORDER BY minutes DESC, title`,
            [...params, [...titleVisibleApps(), ...BROWSER_APPS]],
          )
        : [];

    const range = `>= $1::date::timestamp AT TIME ZONE $3
               AND %s < ($2::date + 1)::timestamp AT TIME ZONE $3`;
    const within = (column: string) =>
      `${column} ${range.replace('%s', column)}`;
    const topRepos = await this.dataSource.query<
      { name: string; count: number }[]
    >(
      `SELECT name, count(*)::int AS count
       FROM (
         -- 포크와 원본에 같은 커밋이 있으면 이름순으로 앞선 레포 하나에만 센다.
         SELECT DISTINCT ON (e.sha) r.github_full_name AS name
         FROM github_events e
         JOIN repos r ON r.id = e.repo_id
         WHERE ${within('e.committed_at')}
         ORDER BY e.sha, r.github_full_name
       ) AS commits
       GROUP BY name
       ORDER BY count DESC, name
       LIMIT $4`,
      [from, to, TIME_ZONE, TOP_COUNT],
    );
    const topPages = await this.dataSource.query<
      { name: string; count: number }[]
    >(
      `SELECT COALESCE(max(page_title), '제목 없는 페이지') AS name,
              count(*)::int AS count
       FROM notion_events
       WHERE ${within('edited_at')}
       GROUP BY page_id
       ORDER BY count DESC, name
       LIMIT $4`,
      [from, to, TIME_ZONE, TOP_COUNT],
    );
    const topApps = await this.dataSource.query<
      { name: string; minutes: number }[]
    >(
      `SELECT active_app AS name, count(*)::int AS minutes
       FROM app_usage
       WHERE user_id = $5 AND active_app = ANY($6)
         AND ${within('observed_at')}
       GROUP BY active_app
       ORDER BY minutes DESC, name
       LIMIT $4`,
      [from, to, TIME_ZONE, TOP_COUNT, TEMP_USER_ID, workApps()],
    );

    return {
      from,
      to,
      timeZone: TIME_ZONE,
      sessions: sessions.map((row): WorkSession => ({
        date: row.date,
        startedAt: row.started_at.toISOString(),
        endedAt: row.ended_at.toISOString(),
        commits: row.commits,
        captures: row.captures,
        notionEdits: row.notion_edits,
        usageMinutes: row.usage_minutes,
        apps: apps
          .filter((app) => app.session === row.session)
          .slice(0, SESSION_APPS)
          .map(({ app, minutes }) => ({ name: app, minutes })),
        screens: screensOf(
          screens.filter((screen) => screen.session === row.session),
        ),
      })),
      top: {
        repos: topRepos,
        notionPages: topPages,
        apps: topApps,
        sites: await this.topSites(from, to),
      },
    };
  }

  // 기간 동안 브라우저에서 오래 본 사이트. 탭 제목은 서버 안에서만 쓰고 사이트 이름만 내보낸다.
  private async topSites(
    from: string,
    to: string,
  ): Promise<WorkLog['top']['sites']> {
    const rows = await this.dataSource.query<
      { title: string; minutes: number }[]
    >(
      `SELECT window_title AS title, count(*)::int AS minutes
       FROM app_usage
       WHERE user_id = $1 AND active_app = ANY($2) AND window_title IS NOT NULL
         AND observed_at >= $3::date::timestamp AT TIME ZONE $5
         AND observed_at <  ($4::date + 1)::timestamp AT TIME ZONE $5
       GROUP BY window_title`,
      [TEMP_USER_ID, BROWSER_APPS, from, to, TIME_ZONE],
    );
    const sites = new Map<string, { minutes: number; distraction: boolean }>();
    for (const row of rows) {
      const site = siteOf(row.title);
      const total = sites.get(site.name)?.minutes ?? 0;
      sites.set(site.name, {
        minutes: total + row.minutes,
        distraction: site.distraction,
      });
    }
    return [...sites]
      .map(([name, site]) => ({ name, ...site }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
      .slice(0, TOP_COUNT);
  }

  /** `at` 직전에 이어서 작업한 구간의 요약. 최근 흔적이 없으면 null. */
  async recap(at = new Date()): Promise<ActivityRecap | null> {
    await this.syncBriefly();

    // 흔적을 시간순으로 놓고, 앞 흔적과의 간격이 벌어진 곳마다 구간 번호를 올린다
    // (gaps-and-islands). 그중 마지막 구간만 집계한다.
    const [session] = await this.dataSource.query<
      {
        started_at: Date | null;
        ended_at: Date | null;
        commits: number;
        captures: number;
        notion_edits: number;
      }[]
    >(
      `WITH events AS (
         SELECT committed_at AS at, 'github' AS source, sha AS key
         FROM github_events
         UNION ALL
         SELECT captured_at, 'capture', id::text
         FROM captures
         WHERE user_id = $1
         UNION ALL
         SELECT observed_at, 'usage', id::text
         FROM app_usage
         WHERE user_id = $1 AND active_app = ANY($5)
         UNION ALL
         SELECT edited_at, 'notion', id::text
         FROM notion_events
       ),
       recent AS (
         SELECT * FROM events
         WHERE at > $2::timestamptz - $3::interval AND at <= $2::timestamptz
       ),
       marked AS (
         SELECT *,
                CASE WHEN at - lag(at) OVER (ORDER BY at) > $4::interval
                     THEN 1 ELSE 0 END AS starts_session
         FROM recent
       ),
       numbered AS (
         SELECT *, sum(starts_session) OVER (ORDER BY at) AS session
         FROM marked
       )
       SELECT min(at) AS started_at,
              max(at) AS ended_at,
              (count(DISTINCT key) FILTER (WHERE source = 'github'))::int AS commits,
              (count(*) FILTER (WHERE source = 'capture'))::int           AS captures,
              (count(*) FILTER (WHERE source = 'notion'))::int            AS notion_edits
       FROM numbered
       WHERE session = (SELECT max(session) FROM numbered)`,
      [TEMP_USER_ID, at, RECAP_LOOKBACK, RECAP_GAP, workApps()],
    );
    if (!session.started_at || !session.ended_at) return null;
    const window = [session.started_at, session.ended_at];

    const [lastCommit] = await this.dataSource.query<
      { repo: string; message: string; committed_at: Date }[]
    >(
      `SELECT r.github_full_name AS repo, e.message, e.committed_at
       FROM github_events e
       JOIN repos r ON r.id = e.repo_id
       WHERE e.committed_at BETWEEN $1 AND $2
       ORDER BY e.committed_at DESC, r.github_full_name
       LIMIT 1`,
      window,
    );
    const [lastContext] = await this.dataSource.query<
      { active_app: string; window_title: string | null }[]
    >(
      `SELECT active_app, window_title
       FROM (
         SELECT captured_at AS at, active_app, window_title
         FROM captures
         WHERE user_id = $3 AND active_app IS NOT NULL
         UNION ALL
         SELECT observed_at, active_app, window_title
         FROM app_usage
         WHERE user_id = $3 AND active_app = ANY($4)
       ) AS seen
       WHERE at BETWEEN $1 AND $2
       ORDER BY at DESC
       LIMIT 1`,
      [...window, TEMP_USER_ID, workApps()],
    );

    const [lastNotion] = await this.dataSource.query<
      { page_title: string | null }[]
    >(
      `SELECT page_title
       FROM notion_events
       WHERE edited_at BETWEEN $1 AND $2
       ORDER BY edited_at DESC
       LIMIT 1`,
      window,
    );

    return {
      startedAt: session.started_at.toISOString(),
      endedAt: session.ended_at.toISOString(),
      commits: session.commits,
      captures: session.captures,
      notionEdits: session.notion_edits,
      lastNotionPage: lastNotion?.page_title ?? null,
      lastCommit: lastCommit
        ? {
            repo: lastCommit.repo,
            message: lastCommit.message,
            committedAt: lastCommit.committed_at.toISOString(),
          }
        : null,
      lastContext: lastContext
        ? {
            activeApp: lastContext.active_app,
            windowTitle: visibleTitle(
              lastContext.active_app,
              lastContext.window_title,
            ),
          }
        : null,
    };
  }

  // 동기화가 꺼져 있거나 느리거나 실패해도 요약은 저장된 것으로 만든다.
  private async syncBriefly(): Promise<void> {
    const syncs = [this.githubSync, this.notionSync]
      .filter((service) => service.status().enabled)
      .map((service) => service.sync().catch(() => undefined));
    if (syncs.length === 0) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.all(syncs),
      new Promise((resolve) => {
        timer = setTimeout(resolve, RECAP_SYNC_WAIT_MS);
      }),
    ]);
    clearTimeout(timer);
  }
}
