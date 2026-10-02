import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1790920800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE repos (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name             text NOT NULL,
        local_path       text,
        github_full_name text UNIQUE
      )
    `);

    // 카카오 로그인 도입 전까지는 최소 컬럼만 둔다.
    await queryRunner.query(`
      CREATE TABLE users (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE captures (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        repo_id     uuid REFERENCES repos (id) ON DELETE SET NULL,
        type        text NOT NULL CHECK (type IN ('voice', 'tag')),
        content     text NOT NULL,
        source      text NOT NULL CHECK (source IN ('desktop', 'web')),
        captured_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX captures_user_id_captured_at_idx
        ON captures (user_id, captured_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX captures_repo_id_idx ON captures (repo_id)
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        started_at   timestamptz NOT NULL,
        ended_at     timestamptz,
        trigger_type text NOT NULL
          CHECK (trigger_type IN ('idle_resume', 'manual')),
        CHECK (ended_at IS NULL OR ended_at >= started_at)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX sessions_started_at_idx ON sessions (started_at DESC)
    `);

    // sessions ↔ captures N:M. PK가 (session_id, capture_id) 순서라
    // capture_id로 찾는 조회를 위해 인덱스를 따로 둔다.
    await queryRunner.query(`
      CREATE TABLE session_captures (
        session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        capture_id uuid NOT NULL REFERENCES captures (id) ON DELETE CASCADE,
        PRIMARY KEY (session_id, capture_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX session_captures_capture_id_idx
        ON session_captures (capture_id)
    `);

    await queryRunner.query(`
      CREATE TABLE github_events (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        repo_id      uuid NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
        event_type   text NOT NULL,
        committed_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX github_events_repo_id_committed_at_idx
        ON github_events (repo_id, committed_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE notion_events (
        id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id   text NOT NULL,
        edited_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX notion_events_page_id_edited_at_idx
        ON notion_events (page_id, edited_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE study_notes (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        uploaded_at       timestamptz NOT NULL DEFAULT now(),
        source_pdf_path   text NOT NULL,
        extracted_summary text,
        repo_id           uuid REFERENCES repos (id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX study_notes_uploaded_at_idx
        ON study_notes (uploaded_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // FK 의존 순서의 역순으로 지운다.
    await queryRunner.query(`DROP TABLE study_notes`);
    await queryRunner.query(`DROP TABLE notion_events`);
    await queryRunner.query(`DROP TABLE github_events`);
    await queryRunner.query(`DROP TABLE session_captures`);
    await queryRunner.query(`DROP TABLE sessions`);
    await queryRunner.query(`DROP TABLE captures`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TABLE repos`);
  }
}
