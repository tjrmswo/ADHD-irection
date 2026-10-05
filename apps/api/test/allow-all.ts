// 인증은 auth.e2e-spec.ts에서 따로 검증한다. 다른 e2e는 가드를 이것으로 바꿔 끼워 통과시킨다.
export const allowAll = { canActivate: () => true };
