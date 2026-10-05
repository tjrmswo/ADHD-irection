import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// 세션 쿠키가 없으면 화면을 그리기 전에 로그인으로 보낸다.
// 쿠키가 있어도 토큰이 유효한지는 API가 판단한다 (만료됐으면 apiFetch가 로그인으로 보냄).
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // 로그인 화면, 로그인 처리 경로, Next 내부 파일과 정적 파일은 열어 둔다.
  matcher: ["/((?!login|auth/|_next/|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
