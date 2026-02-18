---
paths:
  - "voter-application-core/**/*"
---

# voter-application-core

## 책임
유스케이스 인터페이스(입력 포트), 출력 포트 추상화, 애플리케이션 서비스 구현을 정의하는 도메인/애플리케이션 계층

## 연관관계
```
[입력 어댑터] --> {UseCase}UseCase (입력 포트) --> {UseCase}Service --> {UseCase}Port (출력 포트) --> [출력 어댑터]
```

---

## 파일 구조

```text
application/
  port/
    input/  {UseCase}UseCase.kt         # 입력 포트 + Command/Query DTO
    output/repository/  {UseCase}Port.kt  # 출력 포트
  service/  {UseCase}Service.kt         # 유스케이스 구현체
domain/model/  {DomainAggregate}.kt
```

---

## 패턴

### 입력 포트 + Command/Query

```kotlin
interface FindVoterUseCase {
    fun findByLastName(query: FindByLastNameQuery): List<Voter>
    data class FindByLastNameQuery(val lastNameContains: String)
}
```
- Command/Query는 UseCase 인터페이스 내부 중첩 클래스로 선언
- 생성자 `init` 블록에서 `valiktor`로 검증 수행
- 동기/비동기(Reactive) 메서드가 필요하면 둘 다 인터페이스에 선언

### 애플리케이션 서비스

```kotlin
@Named
class FindVoterService(
    private val findVoterRepository: FindVoterPort
) : FindVoterUseCase
```
- `@Named` 등 DI 어노테이션으로 빈 등록
- 입력 포트만 구현, 출력 포트만 의존 (인프라 직접 참조 금지)
- 복잡한 비즈니스 규칙은 `domain.service` 또는 `domain.model`로 이동

### 출력 포트

```kotlin
interface FindVoterPort {
    fun findVotersByLastName(query: FindByLastNameQuery): List<Voter>
}
```
- 한 유스케이스가 필요한 저장소 연산만 노출
- 입력 타입으로 UseCase의 Command/Query를 재사용하여 중복 제거
- 구현체는 adapter-output 모듈에서 작성 (이 모듈은 인터페이스만 정의)

---

## 중요 규칙

- 모든 유스케이스는 `application.port.input.{UseCase}UseCase` 인터페이스로 시작
- 서비스는 인프라 세부사항을 알지 않고 출력 포트 인터페이스에만 의존
- 출력 포트는 `application.port.output.repository.{UseCase}Port` 패키지에 위치
