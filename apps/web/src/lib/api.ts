import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";

// 서버 컴포넌트에서만 쓴다 — 브라우저가 아니라 Next 서버가 API에 붙는다.
export const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** 로그인 화면 주소. 세션이 끊겨서 온 경우를 구분해 안내한다. */
const LOGIN_EXPIRED = "/login?error=expired";

/**
 * 세션 토큰을 붙여 API를 부른다. 토큰이 없거나 만료됐으면(401) 로그인 화면으로 보낸다.
 * redirect()는 예외를 던지는 방식이라, 호출하는 쪽이 try/catch로 감쌌다면
 * catch 안에서 unstable_rethrow(error)를 먼저 불러야 한다.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  if (res.status === 401) redirect(LOGIN_EXPIRED);
  return res;
}
