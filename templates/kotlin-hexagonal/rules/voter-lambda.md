---
paths:
  - "voter-lambda/**/*"
---

# voter-lambda

## 책임
Quarkus + AWS Lambda 환경에서 도메인 유스케이스를 노출하는 입력 어댑터 - Lambda 핸들러, 입력 Command DTO, 출력 Json DTO로 구성

## 연관관계
```
AWS Lambda 이벤트
  --> {Action}{Domain}Lambda (RequestHandler)
      --> Find{Domain}Port (출력 포트, voter-application-core)
          --> {Domain}PersistenceAdapter (adapter-output)
  결과: List<{Domain}Json> 반환
```

---

## 파일 구조

```text
src/main/kotlin/com/hexarchbootdemo/adapter/input/lambda/
  {Action}{Domain}Lambda.kt          # Lambda 핸들러
  data/
    {Action}{Domain}Command.kt       # 입력 DTO (Lambda 이벤트)
    {Domain}Json.kt                  # 출력 DTO (Lambda 응답)
```

- `{Action}`: 유스케이스 동사 (`Find`, `Create`, `Update` 등)
- `{Domain}`: 도메인 이름 (`Voter`, `Order` 등)

---

## 패턴

### Lambda 핸들러

```kotlin
@Named("findvoter")
class FindVoterLambda : RequestHandler<FindVoterCommand, List<VoterJson>> {

    @Inject
    lateinit var findPort: FindVoterPort

    override fun handleRequest(
        command: FindVoterCommand,
        context: Context
    ): List<VoterJson> =
        findPort.findVotersByLastName(FindByLastNameQuery(command.lastName))
            .map { VoterJson(id = it.id, firstName = it.firstName, lastName = it.lastName) }
}
```
- `@Named` 값 = `application.properties`의 `quarkus.lambda.handler`와 동기화
- 입력 변환 + 포트 호출 + 출력 변환만 수행, 비즈니스 로직 금지

### 입력 Command DTO

```kotlin
data class FindVoterCommand(
    val lastName: String
) {
    constructor() : this("not provided")   // Jackson 역직렬화 필수

    init {
        validate(this) {
            validate(FindVoterCommand::lastName)
                .hasSize(min = LAST_NAME_MIN_LENGTH, max = LAST_NAME_MAX_LENGTH)
        }
    }
}
```
- Jackson 역직렬화를 위해 파라미터 없는 보조 생성자 필수
- `init` 블록에서 valiktor 검증, 도메인 상수 재사용

### 출력 Json DTO

```kotlin
data class VoterJson(
    val id: UUID,
    val firstName: String,
    val lastName: String,
    val socialSecurityNumber: String
) {
    constructor() : this(UUID.randomUUID(), "not provided", "not provided", "not provided")
}
```
- Jackson 호환을 위해 파라미터 없는 보조 생성자 제공
- 도메인 엔티티를 직접 노출하지 않고 필요한 필드만 포함

---

## 중요 규칙

- 다른 adapter 모듈에 직접 의존 금지 - 항상 application port를 통해서만 통신
- 내부 기술 구성요소는 `...lambda.internal` 패키지에 격리
- `JacksonObjectMapperCustomizer`, `JooqContextProducer` 등 인프라 설정은 새 도메인 추가 시 수정 불필요
