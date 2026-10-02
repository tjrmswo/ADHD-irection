import { z } from 'zod';

export const SessionTriggerTypeSchema = z.enum(['idle_resume', 'manual']);
export type SessionTriggerType = z.infer<typeof SessionTriggerTypeSchema>;

export const SessionSchema = z.object({
  id: z.uuid(),
  startedAt: z.iso.datetime({ offset: true }),
  // 진행 중인 세션은 null
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  triggerType: SessionTriggerTypeSchema,
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = SessionSchema.omit({ id: true });
export type CreateSession = z.infer<typeof CreateSessionSchema>;
