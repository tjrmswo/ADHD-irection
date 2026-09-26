# ADHD-irection 기술 스택 및 아키텍처 결정

> 2026-09-26 기준으로 확정된 내용을 정리한 문서입니다. 이후 결정이 바뀌면 이 문서를 갱신합니다.

## 프로젝트 개요

집중력·단기 작업 기억이 좋지 않은 사용자(개발자 본인)를 위해, 코딩·학습·작업 전환 등의 패턴을 분석해주는 모바일 앱.

## 기술 스택

- **프레임워크**: Expo (React Native)
  - 기존 Next.js / TypeScript / React Query / Zustand / FSD 아키텍처를 거의 그대로 재사용 가능
  - 네이티브 프로젝트(Xcode/Android Studio) 설정 부담 없이 빌드·서명·배포·OTA 업데이트 처리
  - 특정 기능에 순수 RN 모듈이 필요해지면 `expo prebuild`로 bare workflow 전환 가능
- **백엔드**: Next.js API Route + Supabase(또는 S3) — 기존 스택 재사용

## 패턴 분석 방식

OS 레벨 사용량 API(Android `UsageStatsManager`, iOS Screen Time 계열)는 권한 제약과 플랫폼 간 비대칭이 크므로, **앱 자체 행동 로그**를 1차 신호로 사용한다.

- 포모도로/집중 세션 시작·중단·재시작 로그
- `AppState` 기반 백그라운드 진입/복귀 감지 (특별 권한 불필요)
- 작업 유형 전환 빈도 (코딩 ↔ 학습 ↔ 문서작업 등)

### 플랫폼별 참고

- **Android**: `UsageStatsManager`(커뮤니티 RN 패키지)로 앱별 사용 시간 조회 가능 — 사용자가 "사용정보 접근" 권한을 수동으로 켜야 함. 선택적 추가 기능으로 남겨둠.
- **iOS**: FamilyControls / ManagedSettings / DeviceActivity 구조상, `DeviceActivityReport` 확장 안에서만 사용 데이터를 볼 수 있고 메인 앱으로 추출은 불가능함이 확인됨. iOS에서는 OS 레벨 사용량 트래킹을 기대하지 않음.

## 외부 데이터 소스 연동

- **GitHub API + Webhook**: 커밋 타임스탬프를 코딩 리듬 신호로 사용 (커밋 간격, 심야 작업 빈도 등)
- **Notion API + Webhook**: 페이지 편집 이력 동기화, 폴링 없이 실시간 반영

## 학습 노트(태블릿) 연동

- 태블릿에서는 갤럭시 기본 Notes 앱으로 개념 정리/시각화 자료를 작성하는 경우가 많음
- Samsung Notes는 서드파티 개발자용 콘텐츠 접근 API를 제공하지 않아 자동 실시간 연동은 불가능함을 확인
- **확정된 방식**: 자동 연동 대신, 오늘 공부한 내용을 PDF로 export하여 앱에 직접 업로드
  - `expo-document-picker`로 PDF 업로드
  - 업로드 시각 = 해당 학습 세션의 타임스탬프로 자동 기록
  - 텍스트 위주 PDF는 `pdf-parse`로 텍스트 바로 추출
  - 손글씨/그림 위주 PDF는 비전 모델(예: Claude API)로 핵심 개념 요약 + 키워드 태그 추출 (텍스트 추출 실패 시 자동 fallback)

## 패턴 연결 분석 아이디어

- 학습노트 업로드 시각 ↔ 이후 GitHub 커밋 시각 간격 → 개념 이해에 걸린 시간 추정
- 업로드 빈도/시간대 패턴 → 컨텍스트 스위칭 및 집중 패턴 추정
- 하루 내 여러 개념을 짧게 업로드 vs 한 개념을 길게 파고드는 패턴 비교

## 보류/미확정

- Samsung Notes 자유 필기 자산을 구조화된 데이터로 옮길지(Excalidraw 전환 등)는 현재 보류 — 개념 위주 학습이 주된 용도라 PDF 업로드 방식으로 충분하다고 판단, 우선순위 낮음
