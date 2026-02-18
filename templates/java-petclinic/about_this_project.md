# about_this_project

## 출처

[spring-petclinic](https://github.com/spring-projects/spring-petclinic) - Spring 공식 샘플 애플리케이션.
반려동물 병원 관리 시스템을 주제로 Spring Boot, Spring MVC, Spring Data JPA, Thymeleaf 스택을 시연한다.
RepoRules v0.1.0 으로 분석하여 4개 구획(model, owner, system, vet)으로 분류했다.

## 아키텍처 스타일

**패키지 단위 레이어드 아키텍처** (Domain-Package 방식)

```
petclinic/
  model/     - 공통 베이스 엔티티 (BaseEntity, NamedEntity, Person)
  owner/     - Owner 도메인 전체 (Entity + Repository + Controller + Formatter + Validator)
  vet/       - Vet 도메인 전체 (Entity + Repository + Controller + XML 래퍼)
  system/    - 인프라 설정 (CacheConfiguration, WebConfiguration, WelcomeController)
```

- 도메인별 패키지 안에 Entity, Repository, Controller를 함께 배치 (기술 계층 분리 없음)
- Spring Data JPA 리포지토리 + Thymeleaf 뷰 + 폼 기반 CRUD 패턴
- REST API와 HTML 뷰를 같은 컨트롤러에서 엔드포인트 분기로 제공
- JCache(`@Cacheable`)로 조회 성능 최적화

## 적합한 상황

| 상황 | 적합 여부 |
|------|-----------|
| Spring Boot + Spring MVC + JPA 학습 | 적합 |
| 폼 기반 CRUD + 검증(Validator/Bean Validation) 조합 | 적합 |
| 도메인이 2~5개 수준의 중소규모 웹앱 | 적합 |
| MSA / Hexagonal / 복잡한 CQRS 구조 | 부적합 |
| API-only (no View) 백엔드 | 부적합 |

## 주요 기술 스택

- Java 17+, Spring Boot 3.x
- Spring Data JPA (`JpaRepository`, `Repository`)
- Bean Validation (`@NotBlank`, `@Pattern`, `@Valid`)
- Thymeleaf 템플릿 (뷰 이름 `String` 반환)
- JCache / EhCache (`@Cacheable`, `@EnableCaching`)
- Apache 2.0 라이선스 (모든 소스 파일 헤더 필수)
