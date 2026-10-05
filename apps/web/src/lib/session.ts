// proxy.ts(요청마다 먼저 도는 코드)와 서버 코드가 함께 쓰는 값. next/headers를 끌어오지 않게 따로 둔다.

// 카카오 로그인으로 받은 세션 토큰을 담는 쿠키 (브라우저 스크립트에서는 읽을 수 없다)
export const SESSION_COOKIE = "adhd_session";
// API가 발급하는 세션 토큰의 유효 기간과 맞춘다 (30일).
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
