# Skill: REST 엔드포인트 추가

기존 유스케이스가 있을 때 REST 엔드포인트만 추가하는 단계

---

## 전제 조건
- `{UseCase}UseCase` 인터페이스가 voter-application-core에 이미 존재
- 출력 포트와 어댑터도 이미 구현되어 있음

---

## Step 1: REST DTO 정의
`voter-ms/adapter/input/rest/data/{Domain}Json.kt`

```kotlin
data class VoterJson(
    val firstInitial: Char,
    val lastName: String,
    val socialSecurityNumber: String
)
```
- 도메인 모델을 직접 노출하지 않음
- 필드 이름은 소문자 카멜케이스로 JSON 키와 일치

---

## Step 2-A: Reactor 조회 Controller 추가
`voter-ms/adapter/input/rest/reactor/Find{Domain}Controller.kt`

```kotlin
@RestController
class FindVoterController(private val findVotersUseCase: FindVoterUseCase) {
    @GetMapping("/voters")
    fun findVoters(@RequestParam lastName: String): Mono<List<VoterJson>> =
        just(findVotersUseCase.findByLastName(FindByLastNameQuery(lastName))
            .map { VoterJson(it.firstName[0], it.lastName, it.socialSecurityNumber.toString()) })
}
```

---

## Step 2-B: Reactor 등록 Controller 추가
`voter-ms/adapter/input/rest/reactor/Register{Domain}Controller.kt`

```kotlin
@RestController
class RegisterVoterController(private val registerVoterUseCase: RegisterVoterUseCase) {
    @PostMapping("/voters")
    fun save(@RequestBody form: RegisterVoterForm): ResponseEntity<Unit> {
        val voterId = registerVoterUseCase.registerVoter(
            RegisterVoterCommand(SocialSecurityNumber(form.socialSecurityNumber), form.firstName, form.lastName)
        )
        return ResponseEntity.created(URI.create("/voters/$voterId")).build()
    }

    data class RegisterVoterForm(val socialSecurityNumber: String, val firstName: String, val lastName: String) {
        init {
            validate(this) {
                validate(RegisterVoterForm::socialSecurityNumber).matches(SSN_REGEX)
                validate(RegisterVoterForm::firstName).hasSize(min = 1, max = 50)
                validate(RegisterVoterForm::lastName).hasSize(min = 1, max = 50)
            }
        }
    }
}
```
- Form DTO 내부 `init`에서 valiktor 검증
- 생성 성공 시 201 + `Location: /voters/{id}` 헤더

---

## Step 3-A: Kotlin Flow 조회 Handler 추가
`voter-ms/adapter/input/rest/kotlinflow/Find{Domain}KotlinFlowHandler.kt`

```kotlin
@Component
class FindVoterKotlinFlowHandler(private val findVotersUseCase: FindVoterUseCase) {
    suspend fun findVoters(request: ServerRequest): ServerResponse {
        val lastName = request.queryParam("lastName")
            .orElseThrow { ResponseStatusException(HttpStatus.BAD_REQUEST, "lastName is required.") }
        val flow = findVotersUseCase.findByLastNameReactive(FindByLastNameQuery(lastName))
            .map { VoterJson(it.firstName[0], it.lastName, it.socialSecurityNumber.toString()) }
        return ServerResponse.ok().bodyAndAwait(flow)
    }
}
```

---

## Step 3-B: Kotlin Flow 등록 Handler + Router 추가
`voter-ms/adapter/input/rest/kotlinflow/{Domain}KotlinFlowRouterConfiguration.kt`

```kotlin
@Configuration
class VoterKotlinFlowRouterConfiguration {
    @Bean
    fun routes(
        findHandler: FindVoterKotlinFlowHandler,
        registerHandler: RegisterVoterKotlinFlowHandler
    ) = coRouter {
        "/kotlin-reactive-flow/voters".nest {
            GET("/", findHandler::findVoters)
            POST("/", registerHandler::save)
        }
    }
}
```
- `coRouter { ... }` 패턴으로 도메인별 베이스 경로 아래 GET/POST 묶음

---

## 체크리스트

- [ ] `{Domain}Json.kt` (REST DTO)
- [ ] `Find{Domain}Controller.kt` (Reactor 조회)
- [ ] `Register{Domain}Controller.kt` (Reactor 등록, 필요 시)
- [ ] `Find{Domain}KotlinFlowHandler.kt` (Flow 조회, 필요 시)
- [ ] `Register{Domain}KotlinFlowHandler.kt` (Flow 등록, 필요 시)
- [ ] `{Domain}KotlinFlowRouterConfiguration.kt` (Flow 라우터, 필요 시)

## 상태코드 기준
| 상황 | 상태코드 |
|------|---------|
| 조회 성공 | 200 OK |
| 생성 성공 | 201 Created + Location 헤더 |
| 필수 파라미터 누락 | 400 Bad Request |
| Form 검증 실패 | 422 Unprocessable Entity |
