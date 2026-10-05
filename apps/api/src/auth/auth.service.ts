import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TEMP_USER_ID } from '../common/temp-user.js';
import type { KakaoUser } from './kakao.client.js';

// 이 앱은 주인 한 사람만 쓴다. 지금까지 쌓인 기록은 전부 임시 유저에 귀속돼 있으므로,
// 처음 로그인한 카카오 계정을 그 유저에 연결해 주인으로 삼고 이후에는 그 계정만 받는다.
@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  /** 주인이면 유저 ID를 돌려주고, 다른 계정이면 403. */
  async login(kakao: KakaoUser): Promise<string> {
    // 주인이 아직 없을 때만 연결한다. 두 요청이 동시에 와도 하나만 성공한다.
    await this.dataSource.query(
      `UPDATE users
       SET kakao_id = $2, name = COALESCE($3, name)
       WHERE id = $1 AND kakao_id IS NULL`,
      [TEMP_USER_ID, kakao.id, kakao.nickname],
    );
    const [owner] = await this.dataSource.query<{ kakao_id: string | null }[]>(
      `SELECT kakao_id FROM users WHERE id = $1`,
      [TEMP_USER_ID],
    );
    if (owner?.kakao_id !== kakao.id) {
      throw new ForbiddenException('이 앱의 주인이 아닌 계정입니다');
    }
    return TEMP_USER_ID;
  }

  async me(): Promise<{ id: string; name: string }> {
    const [user] = await this.dataSource.query<{ id: string; name: string }[]>(
      `SELECT id, name FROM users WHERE id = $1`,
      [TEMP_USER_ID],
    );
    return user;
  }
}
