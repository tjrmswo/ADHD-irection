import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from './activity/activity.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CapturesModule } from './captures/captures.module.js';
import { dataSourceOptions } from './database/data-source.js';
import { GithubModule } from './github/github.module.js';
import { HealthController } from './health.controller.js';
import { NotionModule } from './notion/notion.module.js';
import { UsageModule } from './usage/usage.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    CapturesModule,
    GithubModule,
    NotionModule,
    ActivityModule,
    UsageModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
