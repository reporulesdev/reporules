---
paths:
  - "voter-ms/**/*"
---

# voter-ms

## 책임
Spring WebFlux 기반의 REST 입력 어댑터 - Reactor Controller와 Kotlin Flow Handler 두 가지 방식으로 HTTP API를 제공

## 연관관계
```
HTTP 요청
  --> Find{Domain}Controller (Reactor, @RestController)         --> FindVoterUseCase
  --> Register{Domain}Controller (Reactor, @RestController)     --> RegisterVoterUseCase
  --> Find{Domain}KotlinFlowHandler (@Component, suspend)       --> FindVoterUseCase (Reactive)
  --> Register{Domain}KotlinFlowHandler (@Component, suspend)   --> RegisterVoterUseCase (Reactive)
```

---

## 파일 구조

```text
adapter/input/rest/
  data/  {Domain}Json.kt
  reactor/
    Find{Domain}Controller.kt
    Register{Domain}Controller.kt
  kotlinflow/
    Find{Domain}KotlinFlowHandler.kt
    Register{Domain}KotlinFlowHandler.kt
    {Domain}KotlinFlowRouterConfiguration.kt
```

---

## 패턴

### REST DTO

```kotlin
data class VoterJson(
    val firstInitial: Char,
    val lastName: String,
    val socialSecurityNumber: String
)
```
- 도메인 모델 직접 노출 금지, 필요한 필드만 매핑

### Reactor Controller (조회/등록)

```kotlin
// 조회
@RestController
class FindVoterController(private val findVotersUseCase: FindVoterUseCase) {
    @GetMapping("/voters")
    fun findVoters(@RequestParam lastName: String): Mono<List<VoterJson>> =
        just(findVotersUseCase.findByLastName(FindByLastNameQuery(lastName))
            .map { VoterJson(it.firstName[0], it.lastName, it.socialSecurityNumber.toString()) })
}

// 등록: @PostMapping, @RequestBody Form, 검증 후 201+Location 반환
// data class RegisterVoterForm { init { validate(this) { ... valiktor ... } } }
```

### Kotlin Flow Handler + Router

```kotlin
@Component
class FindVoterKotlinFlowHandler(private val findVotersUseCase: FindVoterUseCase) {
    suspend fun findVoters(request: ServerRequest): ServerResponse {
        val lastName = request.queryParam("lastName")
            .orElseThrow { ResponseStatusException(HttpStatus.BAD_REQUEST, "lastName is required.") }
        return ServerResponse.ok().bodyAndAwait(
            findVotersUseCase.findByLastNameReactive(FindByLastNameQuery(lastName))
                .map { VoterJson(it.firstName[0], it.lastName, it.socialSecurityNumber.toString()) }
        )
    }
}

@Configuration
class VoterKotlinFlowRouterConfiguration {
    @Bean fun routes(find: FindVoterKotlinFlowHandler, register: RegisterVoterKotlinFlowHandler) = coRouter {
        "/kotlin-reactive-flow/voters".nest { GET("/", find::findVoters); POST("/", register::save) }
    }
}
```

---

## 중요 규칙

- 비즈니스 로직은 UseCase에 위임, 어댑터는 입출력/검증/매핑에만 집중
- 상태코드: 조회 200, 생성 201, 잘못된 요청 400, 검증 실패 422
- HTTP 경로는 도메인 복수형 기준 (`/voters`, `/kotlin-reactive-flow/voters`)
- Kotlin Flow Handler는 `@Component` + `suspend fun`, Router는 `coRouter { ... }` 패턴