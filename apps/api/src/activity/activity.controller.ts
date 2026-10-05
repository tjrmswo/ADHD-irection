import {
  ActivityDashboardQuerySchema,
  ActivityRangeQuerySchema,
  ActivityRecapQuerySchema,
  type ActivityDashboard,
  type ActivityDashboardQuery,
  type ActivityRange,
  type ActivityRangeQuery,
  type ActivityRecapQuery,
  type ActivityRecapResponse,
} from '@adhd-irection/shared-types';
import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ActivityService } from './activity.service.js';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('dashboard')
  dashboard(
    @Query(new ZodValidationPipe(ActivityDashboardQuerySchema))
    query: ActivityDashboardQuery,
  ): Promise<ActivityDashboard> {
    return this.activityService.dashboard(query.date);
  }

  @Get('range')
  range(
    @Query(new ZodValidationPipe(ActivityRangeQuerySchema))
    query: ActivityRangeQuery,
  ): Promise<ActivityRange> {
    return this.activityService.range(query.from, query.to);
  }

  @Get('recap')
  async recap(
    @Query(new ZodValidationPipe(ActivityRecapQuerySchema))
    query: ActivityRecapQuery,
  ): Promise<ActivityRecapResponse> {
    const at = query.at ? new Date(query.at) : undefined;
    return { recap: await this.activityService.recap(at) };
  }
}
