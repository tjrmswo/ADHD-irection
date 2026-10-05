import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// 로그아웃: 세션 쿠키를 지우고 로그인 화면으로 보낸다.
// 링크를 미리 불러오는 동작으로 로그아웃되지 않도록 POST만 받는다.
export function POST(request: NextRequest) {
  // 303: POST 뒤에 GET으로 이동시킨다.
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
