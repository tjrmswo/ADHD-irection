import {
  CreateAppUsageSchema,
  type AppUsage,
  type CreateAppUsage,
} from '@adhd-irection/shared-types';
import { Body, Controller, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TEMP_USER_ID } from '../common/temp-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('usage')
export class UsageController {
  constructor(private readonly dataSource: DataSource) {}

  // 데스크톱 앱이 자리에 있는 동안 주기적으로 보낸다.
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateAppUsageSchema)) body: CreateAppUsage,
  ): Promise<AppUsage> {
    const observedAt = body.observedAt ?? new Date().toISOString();
    const [{ id }] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO app_usage (user_id, active_app, window_title, observed_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [TEMP_USER_ID, body.activeApp, body.windowTitle, observedAt],
    );
    return { id, ...body, observedAt };
  }
}
