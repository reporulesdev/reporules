# kotlin-petclinic 템플릿 소개

## 출처

Spring 공식 샘플 프로젝트인 **spring-petclinic-kotlin**을 기반으로 한 템플릿입니다.
원본: [spring-petclinic/spring-petclinic-kotlin](https://github.com/spring-petclinic/spring-petclinic-kotlin)

- Java 원본 프로젝트(spring-petclinic)를 Kotlin으로 이식한 공식 샘플
- Spring Boot + Spring MVC + Spring Data JPA 조합을 Kotlin 관용 코드로 표현
- 총 5개 패키지(model, owner, vet, visit, system), 파일 24개 규모의 소형 프로젝트

## 아키텍처 스타일

**Layered MVC (패키지-by-기능 분리)**

```
HTTP 요청
  → Controller (@Controller, @GetMapping/@PostMapping)
  → Repository (Spring Data, @Query JPQL)
  → JPA Entity (@Entity, @Table, @MappedSuperclass)
  → DB
```

- 서비스 레이어 없이 컨트롤러가 리포지토리를 직접 호출
- 도메인 엔티티가 비즈니스 편의 메서드 포함 (addPet, addVisit 등)
- 폼 데이터 변환은 `Formatter<T>`, 복잡 검증은 Spring `Validator` 구현체로 처리
- JPA 컬렉션: 내부 `MutableSet` 보관, 읽기 시 정렬된 `List` 반환 패턴
- 공통 JPA 기반 계층: `BaseEntity` → `NamedEntity` / `Person` → 도메인 엔티티

## 이 템플릿이 적합한 상황

- **소규모 Kotlin + Spring Boot 웹 CRUD 앱** 신규 구축 시 참고 패턴으로 활용
- 서비스 레이어 없이 컨트롤러-리포지토리 2-tier 구조로 빠르게 프로토타입 제작이 필요한 경우
- Spring MVC 폼(GET/POST), Bean Validation, `@ModelAttribute`, `@InitBinder` 패턴을 익히려는 경우
- 상위 엔티티 상속(`@MappedSuperclass`)으로 공통 필드를 공유하는 JPA 모델링 방식을 참고하려는 경우
- Kotlin data class, open class, `MutableSet`/`List` 혼합 컬렉션 패턴을 실제 코드로 확인하려는 경우

## 이 템플릿이 적합하지 않은 상황

- 대규모 도메인(수십 개 이상의 엔티티)이나 복잡한 비즈니스 로직이 필요한 경우
- Hexagonal(포트-어댑터) 또는 DDD 전술 패턴이 필요한 경우
- CQRS, 이벤트 소싱 등 고급 아키텍처 패턴이 필요한 경우
