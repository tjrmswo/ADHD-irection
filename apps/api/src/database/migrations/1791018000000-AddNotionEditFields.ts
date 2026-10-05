import type { MigrationInterface, QueryRunner } from 'typeorm';

// Notion 편집 동기화에 필요한 것.
// - (page_id, edited_at) 유일 제약: Notion은 페이지마다 "마지막 편집 시각"만 알려주므로,
//   같은 시각을 여러 번 가져와도 한 번만 저장하기 위한 키다.
// - page_title: 복귀 요약에 "마지막으로 편집한 페이지"를 보여주기 위한 제목
// 같은 컬럼 순서의 기존 인덱스(notion_events_page_id_edited_at_idx)는 유일 인덱스가 대신하므로 지운다.
export class AddNotionEditFields1791018000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX notion_events_page_id_edited_at_idx`);
    await queryRunner.query(`
      ALTER TABLE notion_events
        ADD COLUMN page_title text,
        ADD CONSTRAINT notion_events_page_id_edited_at_key UNIQUE (page_id, edited_at)
    `);
    // 페이지를 가리지 않는 기간 조회용
    await queryRunner.query(`
      CREATE INDEX notion_events_edited_at_idx ON notion_events (edited_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX notion_events_edited_at_idx`);
    await queryRunner.query(`
      ALTER TABLE notion_events
        DROP CONSTRAINT notion_events_page_id_edited_at_key,
        DROP COLUMN page_title
    `);
    await queryRunner.query(`
      CREATE INDEX notion_events_page_id_edited_at_idx
        ON notion_events (page_id, edited_at DESC)
    `);
  }
}
