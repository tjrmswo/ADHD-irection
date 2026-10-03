import type { MigrationInterface, QueryRunner } from 'typeorm';

// GitHub 커밋 동기화에 필요한 컬럼.
// - sha: 같은 커밋을 여러 번(여러 브랜치에서) 가져와도 한 번만 저장하기 위한 키
// - message: 커밋 메시지 첫 줄 (복귀 요약, 최근 커밋 표시용)
// github_events는 아직 한 번도 쓰인 적이 없어 비어 있으므로 NOT NULL을 바로 건다.
export class AddGithubCommitFields1791010800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE github_events
        ADD COLUMN sha     text NOT NULL,
        ADD COLUMN message text NOT NULL,
        ADD CONSTRAINT github_events_repo_id_sha_key UNIQUE (repo_id, sha)
    `);
    // 기존 인덱스는 (repo_id, committed_at)이라 레포를 가리지 않는 기간 조회에는 못 쓴다.
    await queryRunner.query(`
      CREATE INDEX github_events_committed_at_idx
        ON github_events (committed_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // sha가 사라지면 남은 행은 중복을 가릴 수 없고, 다시 up 할 때 NOT NULL에 걸린다.
    // 커밋은 GitHub에서 다시 가져올 수 있으므로 비운다.
    await queryRunner.query(`DELETE FROM github_events`);
    await queryRunner.query(`DROP INDEX github_events_committed_at_idx`);
    await queryRunner.query(`
      ALTER TABLE github_events
        DROP CONSTRAINT github_events_repo_id_sha_key,
        DROP COLUMN message,
        DROP COLUMN sha
    `);
  }
}
