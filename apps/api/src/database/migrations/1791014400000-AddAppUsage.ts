import type { MigrationInterface, QueryRunner } from 'typeorm';

// 사용 흔적: 자리에 있는 동안 주기적으로 기록하는 맨 앞 앱.
// 커밋·캡처가 없는 시간에도 "그때 무엇을 쓰고 있었는지"를 남긴다.
export class AddAppUsage1791014400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app_usage (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        active_app   text NOT NULL,
        window_title text,
        observed_at  timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX app_usage_user_id_observed_at_idx
        ON app_usage (user_id, observed_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app_usage`);
  }
}
