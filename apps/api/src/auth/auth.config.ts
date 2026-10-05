// 인증 설정은 요청마다 환경변수에서 읽는다 (테스트가 값을 바꿔 가며 쓸 수 있게).

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * DAY_MS;
// 카카오 로그인 화면에 다녀오는 동안만 유효한 state
export const STATE_TTL_MS = 10 * 60 * 1000;

export const authConfig = {
  /** 세션 토큰 서명 키. 없으면 로그인도, 세션 확인도 되지 않는다. */
  get sessionSecret(): string | undefined {
    return process.env.SESSION_SECRET || undefined;
  },
  /** 데스크톱 앱이 x-api-key 헤더로 보내는 키. 없으면 키 인증을 받지 않는다. */
  get desktopApiKey(): string | undefined {
    return process.env.DESKTOP_API_KEY || undefined;
  },
  get kakaoRestApiKey(): string | undefined {
    return process.env.KAKAO_REST_API_KEY || undefined;
  },
  /** 카카오 콘솔에서 클라이언트 시크릿을 켰을 때만 필요하다. */
  get kakaoClientSecret(): string | undefined {
    return process.env.KAKAO_CLIENT_SECRET || undefined;
  },
  /** 카카오 콘솔의 Redirect URI에 등록한 주소와 정확히 같아야 한다. */
  get kakaoRedirectUri(): string {
    return (
      process.env.KAKAO_REDIRECT_URI ??
      'http://localhost:4000/auth/kakao/callback'
    );
  },
  /** 로그인이 끝난 뒤 돌려보낼 웹 주소 */
  get webUrl(): string {
    return (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  },
};
