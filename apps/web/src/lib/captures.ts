import { CaptureListSchema, type Capture } from "@adhd-irection/shared-types";

// 서버 컴포넌트에서만 호출한다 — 브라우저가 아니라 Next 서버가 API에 붙는다.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function fetchCaptures(query: {
  limit: number;
  before?: string;
}): Promise<Capture[]> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.before) params.set("before", query.before);

  const res = await fetch(`${API_URL}/captures?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`캡처 조회 실패 (${res.status})`);
  return CaptureListSchema.parse(await res.json());
}
