import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [GithubModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
