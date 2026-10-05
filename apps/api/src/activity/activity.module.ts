import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { NotionModule } from '../notion/notion.module.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [GithubModule, NotionModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
