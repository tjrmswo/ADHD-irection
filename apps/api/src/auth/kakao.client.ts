import { Injectable } from '@nestjs/common';
import { authConfig } from './auth.config.js';

export interface KakaoUser {
  id: string;
  nickname: string | null;
}

const AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const USER_URL = 'https://kapi.kakao.com/v2/user/me';

// 카카오 로그인(OAuth 2.0 인가 코드 방식)의 카카오 쪽 호출을 감싼다.
@Injectable()
export class KakaoClient {
  /** 사용자를 보낼 카카오 로그인 화면 주소. */
  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: authConfig.kakaoRestApiKey ?? '',
      redirect_uri: authConfig.kakaoRedirectUri,
      state,
    });
    return `${AUTHORIZE_URL}?${params}`;
  }

  /** 카카오가 돌려준 인가 코드로 그 계정이 누구인지 알아낸다. */
  async getUser(code: string): Promise<KakaoUser> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: authConfig.kakaoRestApiKey ?? '',
      redirect_uri: authConfig.kakaoRedirectUri,
      code,
    });
    const secret = authConfig.kakaoClientSecret;
    if (secret) body.set('client_secret', secret);

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      throw new Error(`카카오 토큰 발급 실패 (${tokenRes.status})`);
    }
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token: string;
    };

    const userRes = await fetch(USER_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      throw new Error(`카카오 사용자 조회 실패 (${userRes.status})`);
    }
    const user = (await userRes.json()) as {
      id: number;
      kakao_account?: { profile?: { nickname?: string } };
    };
    return {
      id: String(user.id),
      nickname: user.kakao_account?.profile?.nickname ?? null,
    };
  }
}
