# ADHD-irection

집중력·단기 작업 기억이 약한 사용자(본인) 전용 개인 프로젝트. 코딩·학습·작업 전환 패턴을 분석하고, 인터럽트가 발생한 순간의 맥락을 저마찰로 캡처한다.

## 현재 상태

- 기획·기술 스택 확정 완료. **코드는 아직 한 줄도 없음** — 레포에는 `docs/`만 존재.
- 확정된 스택 전체와 선택 이유: @docs/tech-stack.md
- 결정이 바뀐 과정과 실측 데이터 근거(커밋 1,375건 분석 등) — 필요할 때만 `docs/decision-log.md` 열어볼 것. 매 세션 자동 로드 대상 아님.

## 아키텍처 한눈에

- **데스크톱 캡처**: Tauri (React/TS UI + Rust 셸) — idle 20분→resume 자동 트리거 + 전역 단축키 수동 트리거
- **모바일**: Next.js PWA (Expo 아님 — Apple Developer Program 불필요)
- **백엔드**: NestJS
- **DB**: PostgreSQL + TypeORM — 마이그레이션은 raw SQL 직접 작성, 자동생성 금지 (SQL 학습이 목적)
- **모노레포**: pnpm workspaces — `apps/mobile`, `apps/desktop`, `apps/api`, `packages/shared-types`. Turborepo는 아직 도입 안 함(보류)
- **배포**: Vercel(PWA, 무료) + Railway(API, $5/월 고정) + Neon(Postgres, 무료) + GitHub Actions(CI/CD, public repo라 전부 무료)

## 지금 할 일 (우선순위 순)

1. 모노레포 스캐폴딩 — `pnpm-workspace.yaml` + `apps/*` + `packages/shared-types`(Capture/Session Zod 스키마부터 정의)
2. `docs/decision-log.md` 9절의 테이블 초안을 TypeORM raw SQL 마이그레이션으로 작성, Docker Compose Postgres로 로컬 검증
3. Tauri 캡처 MVP 하나만 — idle→resume 자동 트리거 또는 수동 단축키 중 하나부터 동작시키기 (한 번에 전체 구현 X)

## 작업 규칙

- DB 마이그레이션은 TypeORM 자동생성 대신 반드시 raw SQL로 직접 작성한다.
- 새 아키텍처 결정은 `docs/tech-stack.md`에 반영하고, 바뀐 이유는 `docs/decision-log.md`에 이어서 기록한다 (기존 결정 히스토리를 덮어쓰지 않음).
- git author/committer는 `Keunjae <zeus990506@gmail.com>`로 유지한다. Claude/AI 관련 attribution을 커밋에 넣지 않는다.
- 비용 상한선: 월 $0~5 유지가 목표. NAT Gateway를 실무처럼 켜는 순간부터 "미니 프로젝트 범위 초과"로 판단 (`docs/tech-stack.md` 비용 상한선 원칙 참고).
