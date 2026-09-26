# ADHD-irection 기술 스택 및 아키텍처

> 현재 확정된 상태를 정리한 문서. 결정이 바뀐 배경과 근거는 `decision-log.md` 참고.

## 프로젝트 개요

집중력·단기 작업 기억이 좋지 않은 사용자(개발자 본인)를 위해, 코딩·학습·작업 전환 등의 패턴을 분석하고 인터럽트 발생 시점을 저마찰로 캡처해주는 개인용 시스템.

## 레포 구조 — 모노레포

세 앱(모바일/데스크톱/백엔드)이 같은 API 계약(Capture, Session 등)을 공유하고, 스키마 변경이 세 곳을 동시에 건드리는 구조라 모노레포로 관리한다. 빌드 파이프라인(Expo EAS / Tauri Cargo / NestJS Docker)이 서로 다르므로 pnpm workspaces + Turborepo로 태스크를 스코프별로 분리한다.

```
adhd-irection/
├── apps/
│   ├── mobile/       (Expo)
│   ├── desktop/      (Tauri)
│   └── api/          (NestJS)
├── packages/
│   └── shared-types/ (Capture/Session Zod 스키마 + API 타입 — 3개 앱이 공유)
├── docs/
├── pnpm-workspace.yaml
└── turbo.json
```

## 구성 요소

| 구성 요소 | 역할 | 스택 |
|---|---|---|
| 데스크톱 캡처 앱 | 실제 작업 전환 순간의 저마찰 캡처 (핵심) | Tauri — UI는 React/TS, 네이티브 셸(트레이 아이콘·전역 단축키·idle 감지)만 Rust |
| 모바일 앱 | 이동 중 캡처, 학습노트 PDF 업로드, 패턴 대시보드 리뷰 | Expo (React Native) |
| 백엔드 | 캡처 API, GitHub/Notion 웹훅 수신, 패턴 분석 | NestJS |
| DB | 스키마 직접 설계 목적으로 매니지드 BaaS(Supabase) 대신 순수 Postgres 채택 | PostgreSQL + TypeORM (마이그레이션은 raw SQL로 직접 작성), 배포는 Neon/Railway |

## 캡처 트리거 로직 (실측 데이터 기반)

로컬 저장소 6개의 실제 커밋 이력 1,375건을 분석해 결정 — 근거는 `decision-log.md` 6~7절 참고.

- **자동 트리거**: 시스템 유휴시간 20분 이상 지속 후 활동 재개(idle→resume) 시점에 캡처 모달 팝업. 직전 캡처로부터 20분 이내 재발생 안 함. 시간대 제한 없음(심야 작업 22.7%).
- **수동 트리거**: 전역 단축키로 항상 보조 가능
- **보류**: 활성 창 전환 자동 감지(Accessibility API 기반) — 실측상 소수 케이스(6%)라 2단계로 연기

## 캡처 입력 방식 (타이핑 마찰 제거)

- 1순위: 음성 메모 — 원탭 녹음 → 비동기 STT(Whisper/Claude API)
- 2순위: 원탭 프리셋 태그 — "막힘" / "거의 다 함" / "전환함" / "휴식"
- 보조: 캡처 시점 활성 앱 정보 자동 기록

## 패턴 분석 방식

OS 레벨 사용량 API(Android `UsageStatsManager`, iOS Screen Time 계열)는 권한 제약과 플랫폼 비대칭이 커서, 앱 자체 행동 로그(캡처 이벤트, 세션 로그)를 1차 신호로 사용한다.

- **Android**: `UsageStatsManager`로 앱별 사용 시간 조회 가능 — 선택적 추가 기능
- **iOS**: `DeviceActivity` 구조상 사용 데이터를 메인 앱으로 추출 불가 — 기대하지 않음

## 외부 데이터 소스 연동

- **GitHub API + Webhook**: 커밋 타임스탬프를 코딩 리듬 신호로 사용
- **Notion API + Webhook**: 페이지 편집 이력 동기화

## 학습 노트(태블릿) 연동

- Samsung Notes는 서드파티 API 미제공 → 자동 연동 대신 PDF export 후 앱에 직접 업로드
- 텍스트 위주는 `pdf-parse`로 추출, 손글씨 위주는 비전 모델 fallback

## 패턴 연결 분석 아이디어

- 학습노트 업로드 시각 ↔ 이후 GitHub 커밋 시각 간격 → 개념 이해에 걸린 시간 추정
- 업로드 빈도/시간대 패턴 → 컨텍스트 스위칭 및 집중 패턴 추정

## 보류/미확정

- Samsung Notes 자유 필기 자산의 구조화된 데이터 전환(Excalidraw 등) — 우선순위 낮음
- 활성 창 전환 자동 감지 — 2단계 이후 재검토
