import type { MigrationInterface, QueryRunner } from 'typeorm';

// 카카오 로그인 도입 전까지 모든 캡처가 귀속되는 임시 유저.
const TEMP_USER_ID = '00000000-0000-4000-8000-000000000001';

export class SeedTempUser1790920800001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO users (id, name) VALUES ($1, 'temp')`,
      [TEMP_USER_ID],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE id = $1`, [TEMP_USER_ID]);
  }
}
