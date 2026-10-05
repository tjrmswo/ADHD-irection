import type {
  CommitDetail,
  GithubSyncResult,
  GithubSyncStatus,
} from '@adhd-irection/shared-types';
import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GithubClient } from './github.client.js';
import { GithubSyncService } from './github-sync.service.js';

@Controller('github')
export class GithubController {
  constructor(
    private readonly githubSync: GithubSyncService,
    private readonly github: GithubClient,
    private readonly dataSource: DataSource,
  ) {}

  // 커밋 한 건의 상세. 동기화로 저장된 커밋만 조회할 수 있다.
  @Get('commits/:sha')
  async commit(@Param('sha') sha: string): Promise<CommitDetail> {
    const [stored] = await this.dataSource.query<{ repo: string }[]>(
      `SELECT r.github_full_name AS repo
       FROM github_events e
       JOIN repos r ON r.id = e.repo_id
       WHERE e.sha = $1
       ORDER BY r.github_full_name
       LIMIT 1`,
      [sha],
    );
    if (!stored) throw new NotFoundException('저장된 커밋이 아닙니다');
    const detail = await this.github.getCommit(stored.repo, sha);
    return {
      repo: stored.repo,
      sha,
      ...detail,
      committedAt: new Date(detail.committedAt).toISOString(),
    };
  }

  // 마지막 동기화 상태 (웹 헤더 표시용)
  @Get('sync')
  status(): GithubSyncStatus {
    return this.githubSync.status();
  }

  // 주기를 기다리지 않고 지금 바로 동기화한다.
  @Post('sync')
  @HttpCode(200)
  sync(): Promise<GithubSyncResult> {
    return this.githubSync.sync();
  }
}
