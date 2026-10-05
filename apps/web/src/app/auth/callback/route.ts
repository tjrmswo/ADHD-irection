import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

// 카카오 로그인이 끝나면 API가 세션 토큰을 들려서 여기로 돌려보낸다.
// 토큰을 이 사이트의 쿠키로 심고 첫 화면으로 보낸다.
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=kakao", request.url));
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    // 브라우저 스크립트가 읽지 못하게 하고, 다른 사이트에서 온 요청에는 붙지 않게 한다.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
