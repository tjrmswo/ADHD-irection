import type {
  ActivityDashboard,
  ActivityDay,
  ActivityRange,
  ActivityRecap,
  ActivitySource,
  DatedActivityBlock,
  RecentCommit,
} from '@adhd-irection/shared-types';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TEMP_USER_ID } from '../common/temp-user.js';
import { GithubSyncService } from '../github/github-sync.service.js';
import { workApps } from '../usage/work-apps.js';

// 하루의 경계와 30분 칸을 자르는 기준 시간대. 사용자가 한 명이라 상수로 둔다.
const TIME_ZONE = 'Asia/Seoul';
const DAYS = 28;
const RECENT_COMMITS = 5;
// 복귀 요약: 이만큼 거슬러 올라가며, 흔적 사이가 이보다 벌어지면 다른 구간으로 본다.
const RECAP_LOOKBACK = '12 hours';
const RECAP_GAP = '30 minutes';
// 요약 직전에 방금 푸시한 커밋을 가져오되, 캡처 창이 기다리지 않도록 오래 붙잡지 않는다.
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

@Injectable()
export class ActivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly githubSync: GithubSyncService,
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

    const recentCommits = await this.dataSource.query<
      { repo: string; message: string; committed_at: Date }[]
    >(
      `SELECT DISTINCT ON (e.committed_at, e.sha)
              r.github_full_name AS repo, e.message, e.committed_at
       FROM github_events e
       JOIN repos r ON r.id = e.repo_id
       WHERE e.committed_at < ($1::date + 1)::timestamp AT TIME ZONE $2
       ORDER BY e.committed_at DESC, e.sha, r.github_full_name
       LIMIT $3`,
      [date, TIME_ZONE, RECENT_COMMITS],
    );

    return {
      date,
      timeZone: TIME_ZONE,
      blocks: blocks
        .filter((block) => block.date === date)
        .map(({ index, sources }) => ({ index, sources })),
      days,
      recentCommits: recentCommits.map((commit): RecentCommit => ({
        repo: commit.repo,
        message: commit.message,
        committedAt: commit.committed_at.toISOString(),
      })),
      githubSync: this.githubSync.status(),
    };
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
              (count(*) FILTER (WHERE source = 'capture'))::int           AS captures
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

    return {
      startedAt: session.started_at.toISOString(),
      endedAt: session.ended_at.toISOString(),
      commits: session.commits,
      captures: session.captures,
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
            windowTitle: lastContext.window_title,
          }
        : null,
    };
  }

  // 동기화가 꺼져 있거나 느리거나 실패해도 요약은 저장된 것으로 만든다.
  private async syncBriefly(): Promise<void> {
    if (!this.githubSync.status().enabled) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.githubSync.sync().catch(() => undefined),
      new Promise((resolve) => {
        timer = setTimeout(resolve, RECAP_SYNC_WAIT_MS);
      }),
    ]);
    clearTimeout(timer);
  }
}
