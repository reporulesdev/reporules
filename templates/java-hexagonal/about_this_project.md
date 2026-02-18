# about_this_project

## 출처

- 오픈소스 프로젝트: `hexagonal-architecture-java` (HappyCoders.eu 예제)
- 패키지 루트: `eu.happycoders.shop`
- RepoRules v0.1.0으로 분석됨 (2026-02-17)
- 총 94개 파일, 4개 구획 (model, application, adapter, bootstrap)

## 아키텍처 스타일

**Hexagonal Architecture (Ports & Adapters)**

```
[REST Controller]    [JPA/InMemory Adapter]
      |                      |
   (in-port)            (out-port)
      |                      |
   UseCase Interface    Repository Interface
           \               /
            Service (구현체)
                  |
             Domain Model
```

- **model**: 순수 도메인 계층. 외부 의존 없음. 엔티티, 값 객체, 도메인 예외
- **application**: 유스케이스 정의(port/in) + 구현(service) + 영속성 포트 선언(port/out)
- **adapter**: REST 진입점(in/rest) + 영속성 구현(out/persistence). 인프라 세부사항만 담당
- **bootstrap**: 서버 기동, 수동 DI 조립, ArchUnit 의존성 규칙 검증

의존 방향: `bootstrap → adapter → application → model` (단방향)

## 적합한 상황

- Java + JAX-RS(RESTEasy) + Undertow 기반 백엔드 서비스를 Hexagonal 구조로 시작할 때
- Spring 없이 순수 Java로 의존성 역전 원칙을 실습/적용할 때
- 인메모리 / JPA(MySQL) 양쪽 persistence 전략을 런타임에 전환해야 할 때
- ArchUnit으로 계층 간 의존성 규칙을 테스트 코드로 강제하고 싶을 때
- 도메인 로직을 인프라와 완전히 분리하여 단위 테스트 커버리지를 높이고 싶을 때
