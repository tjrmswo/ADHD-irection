import {
  Controller,
  Get,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { authConfig, SESSION_TTL_MS, STATE_TTL_MS } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { KakaoClient } from './kakao.client.js';
import { Public } from './public.decorator.js';
import { signToken, verifyToken } from './session.js';

// state 토큰의 sub. 세션 토큰(sub = 유저 ID)과 섞어 쓸 수 없게 구분한다.
const STATE_SUBJECT = 'kakao-login';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly kakao: KakaoClient,
    private readonly auth: AuthService,
  ) {}

  // 로그인 시작: 카카오 로그인 화면으로 보낸다.
  @Public()
  @Get('kakao')
  start(@Res() res: Response): void {
    const secret = authConfig.sessionSecret;
    if (!authConfig.kakaoRestApiKey || !secret) {
      throw new ServiceUnavailableException(
        'KAKAO_REST_API_KEY와 SESSION_SECRET을 설정해야 로그인할 수 있습니다',
      );
    }
    // state는 이 서버가 시작한 로그인인지 돌아왔을 때 확인하는 값이다 (CSRF 방지).
    const state = signToken(STATE_SUBJECT, STATE_TTL_MS, secret);
    res.redirect(this.kakao.authorizeUrl(state));
  }

  // 카카오가 인가 코드를 들고 돌아오는 곳. 주인이면 세션 토큰을 웹에 넘긴다.
  @Public()
  @Get('kakao/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const fail = (reason: string) =>
      res.redirect(`${authConfig.webUrl}/login?error=${reason}`);

    const secret = authConfig.sessionSecret;
    if (!secret) return fail('config');
    // 사용자가 동의 화면에서 취소하면 code 없이 돌아온다.
    if (!code) return fail('cancelled');
    if (!state || verifyToken(state, secret) !== STATE_SUBJECT) {
      return fail('state');
    }

    let userId: string;
    try {
      userId = await this.auth.login(await this.kakao.getUser(code));
    } catch (error) {
      return fail(
        error instanceof Error && error.name === 'ForbiddenException'
          ? 'forbidden'
          : 'kakao',
      );
    }
    const token = signToken(userId, SESSION_TTL_MS, secret);
    // 웹과 API의 주소가 달라도 되도록, 쿠키는 웹이 자기 주소에 직접 심는다.
    res.redirect(
      `${authConfig.webUrl}/auth/callback?token=${encodeURIComponent(token)}`,
    );
  }

  // 지금 로그인한 사람 (세션 확인용)
  @Get('me')
  me(): Promise<{ id: string; name: string }> {
    return this.auth.me();
  }
}
