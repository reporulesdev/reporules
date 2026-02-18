# About This Project

## 출처

RepoRules v0.1.0이 `layered-architecture-template` 프로젝트를 분석하여 생성한 규칙 세트입니다.

- 분석 대상: `samples/java/layered/layered-architecture-template/`
- 총 파일 수: 34개
- 생성된 구획(모듈): 9개
- 분석 일시: 2026-02-17

## 아키텍처 스타일

**계층형 아키텍처 (Layered Architecture)**

요청은 다음 방향으로 흐릅니다:

```
Client -> api (Controller) -> service (Service) -> repository (Repository) -> DB
```

각 계층의 역할:
- **api**: HTTP 요청/응답 처리, 입력 유효성 검증, ResponseEntity 반환
- **service**: 비즈니스 로직, DTO/도메인/엔티티 간 변환 (ModelMapper 사용)
- **repository**: JPA 엔티티 정의, Spring Data JPA 기반 데이터 접근
- **config**: Spring Bean 등록 (ModelMapper 등)
- **exception**: 도메인 예외 클래스 (RuntimeException 상속)

사용 기술 스택:
- Spring Boot (Spring Web, Spring Data JPA)
- Lombok (`@Data`, `@Builder`, `@AllArgsConstructor`)
- ModelMapper (계층 간 객체 변환)
- JUnit 5 + Mockito (단위 테스트)
- REST Assured (통합 테스트)
- Jakarta Persistence (JPA 애노테이션)
- OpenAPI/Swagger (API 스펙 인터페이스)

## 이 템플릿이 적합한 상황

- CRUD 중심의 REST API 서버를 빠르게 구축할 때
- 팀 내 계층 분리 컨벤션을 명확히 정착시키고 싶을 때
- Spring Boot + JPA 기반의 표준 패턴을 따르는 신규 도메인 추가가 반복될 때
- 단위 테스트(Mockito)와 통합 테스트(REST Assured)를 함께 유지하는 프로젝트
- OpenAPI 스펙 인터페이스를 컨트롤러가 구현하는 Contract-First 방식을 채택할 때

## 이 템플릿이 적합하지 않은 상황

- DDD 전술 패턴(Aggregate, Domain Event 등)을 적용해야 할 때
- Hexagonal/Clean Architecture처럼 의존성 역전이 필요한 복잡한 도메인
- 리액티브(WebFlux) 기반 비동기 처리가 필요한 경우
