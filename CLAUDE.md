# ADHD-irection

집중력·단기 작업 기억이 약한 사용자(본인) 전용 개인 프로젝트. 코딩·학습·작업 전환 패턴을 분석하고, 인터럽트가 발생한 순간의 맥락을 저마찰로 캡처한다.

## 현재 상태

- 기획·기술 스택 확정, 모노레포 스캐폴딩 완료 (각 앱은 생성기 기본 템플릿 상태, 기능 코드는 아직 없음).
- 실행: `pnpm dev`(전체) / `pnpm dev:api`(4000) / `pnpm dev:web`(3000) / `pnpm dev:desktop`(Rust 툴체인 필요). 검증: `pnpm typecheck && pnpm build && pnpm test && pnpm lint`
- DB: 초기 스키마 마이그레이션 작성 완료 (`apps/api/src/database/migrations/`). 로컬 실행은 `pnpm db:up`(Docker 필요) → `apps/api/.env.example`을 `.env`로 복사 → `pnpm db:migrate`. Nest 앱은 `TypeOrmModule`로 DB에 연결됨(`GET /health`로 확인). 엔티티와 기능 모듈은 아직 없음
- 확정된 스택 전체와 선택 이유: @docs/tech-stack.md
- 결정이 바뀐 과정과 실측 데이터 근거(커밋 1,375건 분석 등) — 필요할 때만 `docs/decision-log.md` 열어볼 것. 매 세션 자동 로드 대상 아님.

## 아키텍처 한눈에

- **데스크톱 캡처**: Tauri (React/TS UI + Rust 셸) — idle 20분→resume 자동 트리거 + 전역 단축키 수동 트리거
- **웹/모바일**: Next.js PWA (`apps/web`) — 캡처 외 모든 화면(대시보드, 기록 조회, PDF 업로드, 이동 중 캡처). 맥 브라우저와 폰에서 같이 사용 (Expo 아님 — Apple Developer Program 불필요)
- **백엔드**: NestJS
- **DB**: PostgreSQL + TypeORM — 마이그레이션은 raw SQL 직접 작성, 자동생성 금지 (SQL 학습이 목적)
- **모노레포**: pnpm workspaces — `apps/web`, `apps/desktop`, `apps/api`, `packages/shared-types`. Turborepo는 아직 도입 안 함(보류)
- **배포**: Vercel(PWA, 무료) + Railway(API, $5/월 고정) + Neon(Postgres, 무료) + GitHub Actions(CI/CD, public repo라 전부 무료)

## 지금 할 일 (우선순위 순)

1. Tauri 캡처 MVP 하나만 — idle→resume 자동 트리거 또는 수동 단축키 중 하나부터 동작시키기 (한 번에 전체 구현 X)

## 작업 규칙

- `packages/shared-types`는 빌드 없이 소스(`.ts`)를 직접 노출한다 — enum/namespace 금지, 상대 import에 `.ts` 확장자 필수 (`docs/decision-log.md` 16절).
- DB 마이그레이션은 TypeORM 자동생성 대신 반드시 raw SQL로 직접 작성한다.
- 새 아키텍처 결정은 `docs/tech-stack.md`에 반영하고, 바뀐 이유는 `docs/decision-log.md`에 이어서 기록한다 (기존 결정 히스토리를 덮어쓰지 않음).
- git author/committer는 `Keunjae <zeus990506@gmail.com>`로 유지한다. Claude/AI 관련 attribution을 커밋에 넣지 않는다.
- 비용 상한선: 월 $0~5 유지가 목표. NAT Gateway를 실무처럼 켜는 순간부터 "미니 프로젝트 범위 초과"로 판단 (`docs/tech-stack.md` 비용 상한선 원칙 참고).
