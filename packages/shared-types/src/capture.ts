import { z } from 'zod';
import { SessionTriggerTypeSchema } from './session.ts';

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
  // 캡처 창이 뜬 계기. 이 컬럼이 생기기 전의 캡처와 웹 캡처는 null
  triggerType: SessionTriggerTypeSchema.nullable(),
  // 캡처 창이 뜨기 직전에 맨 앞에 있던 앱. 알 수 없으면 null
  activeApp: z.string().max(200).nullable(),
  // 그 앱의 창 제목. macOS 화면 기록 권한이 없으면 null
  windowTitle: z.string().max(500).nullable(),
});
export type Capture = z.infer<typeof CaptureSchema>;

// 맥락 필드는 보내지 않으면 null로 저장한다.
export const CreateCaptureSchema = CaptureSchema.omit({
  id: true,
  userId: true,
})
  .extend({
    triggerType: CaptureSchema.shape.triggerType.default(null),
    activeApp: CaptureSchema.shape.activeApp.default(null),
    windowTitle: CaptureSchema.shape.windowTitle.default(null),
  })
  .refine(
    (capture) =>
      capture.type !== 'tag' ||
      PresetTagSchema.safeParse(capture.content).success,
    { path: ['content'], error: 'tag 캡처의 content는 프리셋 태그여야 합니다' },
  );
export type CreateCapture = z.infer<typeof CreateCaptureSchema>;
// 보내는 쪽 타입 — 맥락 필드를 생략할 수 있다.
export type CreateCaptureInput = z.input<typeof CreateCaptureSchema>;

// GET /captures 쿼리. 쿼리스트링은 문자열로 오므로 limit은 숫자로 변환한다.
export const ListCapturesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  // 이 시각보다 이전 캡처만 돌려준다 (기간의 끝, 끝 시각은 포함하지 않음)
  before: z.iso.datetime({ offset: true }).optional(),
  // 이 시각부터의 캡처만 돌려준다 (기간의 시작, 시작 시각 포함)
  after: z.iso.datetime({ offset: true }).optional(),
});
export type ListCapturesQuery = z.infer<typeof ListCapturesQuerySchema>;

// 최신순(capturedAt 내림차순)
export const CaptureListSchema = z.array(CaptureSchema);
