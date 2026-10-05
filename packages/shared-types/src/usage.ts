import { z } from 'zod';

// 사용 흔적: 자리에 있는 동안 데스크톱 앱이 주기적으로 남기는 "지금 맨 앞에 있는 앱".
// 커밋하지 않은 작업도 작업 블록에 잡히게 하는 신호다.
export const AppUsageSchema = z.object({
  id: z.uuid(),
  activeApp: z.string().min(1).max(200),
  // macOS 화면 기록 권한이 없으면 null
  windowTitle: z.string().max(500).nullable(),
  observedAt: z.iso.datetime({ offset: true }),
});
export type AppUsage = z.infer<typeof AppUsageSchema>;

// observedAt을 보내지 않으면 API가 받은 시각으로 저장한다.
export const CreateAppUsageSchema = AppUsageSchema.omit({ id: true }).extend({
  windowTitle: AppUsageSchema.shape.windowTitle.default(null),
  observedAt: AppUsageSchema.shape.observedAt.optional(),
});
export type CreateAppUsage = z.infer<typeof CreateAppUsageSchema>;
export type CreateAppUsageInput = z.input<typeof CreateAppUsageSchema>;
