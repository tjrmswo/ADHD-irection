import {
  ActivityRecapResponseSchema,
  CaptureSchema,
  CreateCaptureSchema,
  type ActivityRecap,
  type Capture,
  type CreateCaptureInput,
  type PresetTag,
} from "@adhd-irection/shared-types";
import { invoke } from "@tauri-apps/api/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// 캡처 창이 뜬 순간 Rust 쪽이 기록해 둔 맥락 (계기, 직전에 쓰던 앱).
export type CaptureContext = Pick<
  CreateCaptureInput,
  "triggerType" | "activeApp" | "windowTitle"
>;

export async function createTagCapture(tag: PresetTag): Promise<Capture> {
  const context = await invoke<CaptureContext | null>("capture_context");
  const body = CreateCaptureSchema.parse({
    ...context,
    repoId: null,
    type: "tag",
    content: tag,
    source: "desktop",
    capturedAt: new Date().toISOString(),
  });

  const res = await fetch(`${API_URL}/captures`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`캡처 저장 실패 (${res.status})`);
  return CaptureSchema.parse(await res.json());
}

// 직전에 이어서 작업한 구간의 요약. 최근 흔적이 없으면 null.
export async function fetchRecap(): Promise<ActivityRecap | null> {
  const res = await fetch(`${API_URL}/activity/recap`);
  if (!res.ok) throw new Error(`복귀 요약 조회 실패 (${res.status})`);
  return ActivityRecapResponseSchema.parse(await res.json()).recap;
}
