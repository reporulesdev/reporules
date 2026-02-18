# About This Project

## 출처

이 템플릿은 `hex-arch-kotlin-spring-boot` 오픈소스 프로젝트를 분석하여 생성되었습니다.
RepoRules v0.1.0이 2026-02-17에 자동 분석한 결과물입니다.

프로젝트 구성:
- 총 파일 수: 108개
- 모듈: 5개 (voter-application-core, adapter-output, voter-ms, voter-lambda, voter-common)

## 아키텍처 스타일

**헥사고날 아키텍처 (Ports & Adapters)**

```
[입력 어댑터] --> [입력 포트] --> [애플리케이션 서비스] --> [출력 포트] --> [출력 어댑터]
  voter-ms          UseCase        Service                   Port           adapter-output
  voter-lambda      interface      implementation            interface      persistence/rpc
```

핵심 원칙:
- 도메인/애플리케이션 계층은 인프라에 의존하지 않음
- 모든 외부 연동은 포트 인터페이스를 통해서만 수행
- 동기(Reactor) + 비동기(Kotlin Flow/Coroutine) 이중 API 지원
- 입력 어댑터: REST Controller / Kotlin Flow Handler / AWS Lambda Handler

기술 스택:
- Kotlin + Spring Boot (Reactive WebFlux)
- jOOQ + R2DBC (H2), Flyway
- Quarkus + AWS Lambda (voter-lambda 모듈)
- Resilience4j (CircuitBreaker), valiktor (검증)

## 이 템플릿이 적합한 상황

- 도메인 로직과 인프라를 명확히 분리하고 싶을 때
- REST API와 Lambda 핸들러를 동일한 도메인 코어에서 서빙할 때
- 동기/비동기 API를 함께 제공해야 할 때
- 인메모리 어댑터로 빠른 개발 후 DB 어댑터로 교체하는 패턴을 사용할 때
- 팀에서 일관된 Hexagonal 구조 컨벤션이 필요할 때
