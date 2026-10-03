import type {
  GithubSyncResult,
  GithubSyncStatus,
} from '@adhd-irection/shared-types';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { GithubSyncService } from './github-sync.service.js';

@Controller('github')
export class GithubController {
  constructor(private readonly githubSync: GithubSyncService) {}

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
