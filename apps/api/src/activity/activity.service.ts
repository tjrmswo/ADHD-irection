import type {
  ActivityDashboard,
  ActivityDay,
  ActivityRange,
  ActivitySource,
  DatedActivityBlock,
  RecentCommit,
} from '@adhd-irection/shared-types';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GithubSyncService } from '../github/github-sync.service.js';

// 카카오 로그인 도입 전까지 모든 캡처는 임시 유저에 귀속된다 (captures.service.ts와 같은 값).
const TEMP_USER_ID = '00000000-0000-4000-8000-000000000001';
// 하루의 경계와 30분 칸을 자르는 기준 시간대. 사용자가 한 명이라 상수로 둔다.
const TIME_ZONE = 'Asia/Seoul';
const DAYS = 28;
const RECENT_COMMITS = 5;

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
    // 커밋과 캡처를 한 줄의 "흔적"으로 합친 뒤, 현지 시각 기준 (날짜, 30분 칸)으로 묶는다.
    // 포크와 원본처럼 같은 커밋(sha)이 여러 레포에 있으면 한 번만 센다.
    const rows = await this.dataSource.query<BlockRow[]>(
      `WITH events AS (
         SELECT committed_at AS at, 'github' AS source, sha AS key, false AS is_resume
         FROM github_events
         UNION ALL
         SELECT captured_at, 'capture', id::text, trigger_type IS NOT DISTINCT FROM 'idle_resume'
         FROM captures
         WHERE user_id = $1
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
      [TEMP_USER_ID, TIME_ZONE, from, to],
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
}
