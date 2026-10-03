import type {
  GithubSyncResult,
  GithubSyncStatus,
} from '@adhd-irection/shared-types';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GithubClient } from './github.client.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// 웹훅을 받을 공개 주소가 생기기 전까지는 주기적으로 가져온다.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
// 평소에는 최근 며칠만 다시 훑는다. 늦게 푸시된 커밋을 놓치지 않을 만큼의 여유.
const LOOKBACK_DAYS = 7;
// 저장된 커밋이 하나도 없을 때(첫 동기화) 거슬러 올라가는 기간.
const DEFAULT_BACKFILL_DAYS = 730;

// 내 GitHub 커밋을 github_events에 쌓는다. 커밋 시각이 "그때 작업하고 있었다"는 신호다.
@Injectable()
export class GithubSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(GithubSyncService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<GithubSyncResult>;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly github: GithubClient,
    private readonly dataSource: DataSource,
  ) {}

  /** 주기 동기화를 시작한다. 서버 기동 시(main.ts)에만 부른다 — 테스트에서는 돌지 않는다. */
  start(): void {
    if (!this.github.enabled) {
      this.logger.warn('GITHUB_TOKEN이 없어 GitHub 동기화를 건너뜁니다');
      return;
    }
    const tick = () =>
      void this.sync().catch(() => {
        // 실패는 sync()가 기록한다. 다음 주기에 다시 시도한다.
      });
    tick();
    this.timer = setInterval(tick, SYNC_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  status(): GithubSyncStatus {
    return {
      enabled: this.github.enabled,
      lastSyncedAt: this.lastSyncedAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }

  /** 이미 돌고 있으면 그 결과를 함께 기다린다. */
  sync(): Promise<GithubSyncResult> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(): Promise<GithubSyncResult> {
    try {
      const since = new Date(Date.now() - (await this.lookbackDays()) * DAY_MS);
      const viewer = await this.github.viewer();
      const repos = await this.github.listReposPushedSince(since);

      const result = { inserted: 0, repos: 0 };
      for (const repo of repos) {
        const commits = await this.github.listCommits(
          repo.fullName,
          since,
          viewer.id,
        );
        if (commits.length === 0) continue;
        result.repos += 1;

        const [{ id: repoId }] = await this.dataSource.query<{ id: string }[]>(
          `INSERT INTO repos (name, github_full_name)
           VALUES ($1, $2)
           ON CONFLICT (github_full_name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [repo.name, repo.fullName],
        );
        // 이미 저장된 커밋(같은 repo_id, sha)은 건너뛴다.
        const inserted = await this.dataSource.query<{ id: string }[]>(
          `INSERT INTO github_events (repo_id, event_type, sha, message, committed_at)
           SELECT $1, 'commit', sha, message, committed_at
           FROM unnest($2::text[], $3::text[], $4::timestamptz[])
             AS commit (sha, message, committed_at)
           ON CONFLICT (repo_id, sha) DO NOTHING
           RETURNING id`,
          [
            repoId,
            commits.map((commit) => commit.sha),
            commits.map((commit) => commit.message),
            commits.map((commit) => commit.authoredAt),
          ],
        );
        result.inserted += inserted.length;
      }

      this.lastSyncedAt = new Date();
      this.lastError = null;
      if (result.inserted > 0) {
        this.logger.log(
          `커밋 ${result.inserted}건 저장 (레포 ${result.repos}개)`,
        );
      }
      return result;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`GitHub 동기화 실패: ${this.lastError}`);
      throw error;
    }
  }

  private async lookbackDays(): Promise<number> {
    const [{ exists }] = await this.dataSource.query<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM github_events) AS exists`,
    );
    if (exists) return LOOKBACK_DAYS;
    return Number(process.env.GITHUB_BACKFILL_DAYS) || DEFAULT_BACKFILL_DAYS;
  }
}
