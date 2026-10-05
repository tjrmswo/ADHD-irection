import {
  ActivityDashboardQuerySchema,
  ActivityRangeQuerySchema,
  ActivityRecapQuerySchema,
  WorkItemsQuerySchema,
  type ActivityDashboard,
  type ActivityDashboardQuery,
  type ActivityRange,
  type ActivityRangeQuery,
  type ActivityRecapQuery,
  type ActivityRecapResponse,
  type WorkItems,
  type WorkItemsQuery,
  type WorkLog,
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

  // 작업 기록: 기간 안의 작업 구간과 가장 많이 한 것
  @Get('log')
  log(
    @Query(new ZodValidationPipe(ActivityRangeQuerySchema))
    query: ActivityRangeQuery,
  ): Promise<WorkLog> {
    return this.activityService.log(query.from, query.to);
  }

  // 하루의 개별 작업 (커밋, Notion 편집, 캡처)
  @Get('log/items')
  async logItems(
    @Query(new ZodValidationPipe(WorkItemsQuerySchema))
    query: WorkItemsQuery,
  ): Promise<WorkItems> {
    return {
      date: query.date,
      items: await this.activityService.work({
        from: query.date,
        to: query.date,
        captures: true,
      }),
    };
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
