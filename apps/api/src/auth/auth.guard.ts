import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { authConfig } from './auth.config.js';
import { IS_PUBLIC } from './public.decorator.js';
import { safeEqual, verifyToken } from './session.js';

// 모든 라우트에 걸리는 가드. @Public()이 없으면 둘 중 하나가 있어야 통과한다.
// - 웹: 카카오 로그인으로 받은 세션 토큰 (Authorization: Bearer …)
// - 데스크톱 앱: 미리 나눠 가진 키 (x-api-key)
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    const apiKey = request.header('x-api-key');
    const expectedKey = authConfig.desktopApiKey;
    if (apiKey && expectedKey && safeEqual(apiKey, expectedKey)) return true;

    const [scheme, token] = (request.header('authorization') ?? '').split(' ');
    const secret = authConfig.sessionSecret;
    if (scheme === 'Bearer' && token && secret && verifyToken(token, secret)) {
      return true;
    }
    throw new UnauthorizedException('로그인이 필요합니다');
  }
}
