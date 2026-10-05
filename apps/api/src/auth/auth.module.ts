import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { KakaoClient } from './kakao.client.js';

@Module({
  controllers: [AuthController],
  providers: [
    KakaoClient,
    AuthService,
    AuthGuard,
    // 모든 라우트에 가드를 건다. useExisting이라 테스트에서 AuthGuard를 바꿔 끼울 수 있다.
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AuthModule {}
