import { Module } from '@nestjs/common';
import { GithubClient } from './github.client.js';
import { GithubController } from './github.controller.js';
import { GithubSyncService } from './github-sync.service.js';

@Module({
  controllers: [GithubController],
  providers: [GithubClient, GithubSyncService],
  exports: [GithubSyncService],
})
export class GithubModule {}
