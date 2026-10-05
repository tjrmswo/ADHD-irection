import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  // 배포 환경의 상태 확인이 로그인 없이 부를 수 있어야 한다.
  @Public()
  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', db: 'up' };
  }
}
