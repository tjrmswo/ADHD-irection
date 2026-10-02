import { z } from 'zod';

export const CaptureTypeSchema = z.enum(['voice', 'tag']);
export type CaptureType = z.infer<typeof CaptureTypeSchema>;

export const CaptureSourceSchema = z.enum(['desktop', 'web']);
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;

// 원탭 프리셋 태그: 막힘 / 거의 다 함 / 전환함 / 휴식
export const PresetTagSchema = z.enum([
  'blocked',
  'almost_done',
  'switched',
  'break',
]);
export type PresetTag = z.infer<typeof PresetTagSchema>;

export const PRESET_TAG_LABELS: Record<PresetTag, string> = {
  blocked: '막힘',
  almost_done: '거의 다 함',
  switched: '전환함',
  break: '휴식',
};

export const CaptureSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  repoId: z.uuid().nullable(),
  type: CaptureTypeSchema,
  // type이 tag면 PresetTag 값, voice면 STT 결과 텍스트
  content: z.string(),
  source: CaptureSourceSchema,
  capturedAt: z.iso.datetime({ offset: true }),
});
export type Capture = z.infer<typeof CaptureSchema>;

export const CreateCaptureSchema = CaptureSchema.omit({
  id: true,
  userId: true,
});
export type CreateCapture = z.infer<typeof CreateCaptureSchema>;
