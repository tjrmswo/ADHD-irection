import { CaptureListSchema, type Capture } from "@adhd-irection/shared-types";
import { API_URL } from "./api";

/** after(포함)부터 before(제외)까지의 캡처를 최신순으로. */
export async function fetchCaptures(query: {
  limit: number;
  after: string;
  before: string;
}): Promise<Capture[]> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    after: query.after,
    before: query.before,
  });

  const res = await fetch(`${API_URL}/captures?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`캡처 조회 실패 (${res.status})`);
  return CaptureListSchema.parse(await res.json());
}
