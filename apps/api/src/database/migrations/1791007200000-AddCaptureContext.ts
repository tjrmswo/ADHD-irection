import type { MigrationInterface, QueryRunner } from 'typeorm';

// 캡처 시점의 맥락: 창이 뜬 계기와 직전에 쓰던 앱.
// 기존 행과 웹 캡처는 값을 알 수 없으므로 전부 nullable로 둔다.
export class AddCaptureContext1791007200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE captures
        ADD COLUMN trigger_type text
          CHECK (trigger_type IN ('idle_resume', 'manual')),
        ADD COLUMN active_app   text,
        ADD COLUMN window_title text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE captures
        DROP COLUMN window_title,
        DROP COLUMN active_app,
        DROP COLUMN trigger_type
    `);
  }
}
