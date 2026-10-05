import type { MigrationInterface, QueryRunner } from 'typeorm';

// 카카오 로그인: 유저가 어느 카카오 계정인지 기록한다.
// 기존 임시 유저는 처음 로그인한 카카오 계정에 연결되므로(주인 등록) nullable로 둔다.
export class AddUserKakaoId1791021600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN kakao_id text UNIQUE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN kakao_id`);
  }
}
