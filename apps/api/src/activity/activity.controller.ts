import {
  ActivityDashboardQuerySchema,
  ActivityRangeQuerySchema,
  type ActivityDashboard,
  type ActivityDashboardQuery,
  type ActivityRange,
  type ActivityRangeQuery,
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
}
