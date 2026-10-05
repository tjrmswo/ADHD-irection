import { createHmac, timingSafeEqual } from 'node:crypto';

// 서명한 토큰: base64url(JSON 페이로드) + "." + HMAC-SHA256 서명.
// 서버에 세션을 저장하지 않고, 서명이 맞고 만료 전이면 유효하다.

interface Payload {
  // 토큰이 가리키는 것 (세션이면 유저 ID, 로그인 state면 용도 표시)
  sub: string;
  // 만료 시각 (epoch ms)
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signToken(sub: string, ttlMs: number, secret: string): string {
  const payload: Payload = { sub, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

/** 서명이 맞고 만료 전이면 sub를, 아니면 null을 돌려준다. */
export function verifyToken(token: string, secret: string): string | null {
  const [data, signature, ...rest] = token.split('.');
  if (!data || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  // 길이가 다르면 timingSafeEqual이 던지므로 먼저 거른다.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString(),
    ) as Payload;
    return typeof payload.sub === 'string' && payload.exp > Date.now()
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

/** 두 비밀값을 걸린 시간으로 추측할 수 없게 비교한다. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
