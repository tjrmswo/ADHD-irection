import {
  CaptureSchema,
  CreateCaptureSchema,
  type Capture,
  type PresetTag,
} from "@adhd-irection/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function createTagCapture(tag: PresetTag): Promise<Capture> {
  const body = CreateCaptureSchema.parse({
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
