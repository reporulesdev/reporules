# kotlin-hexagonal 초기화 가이드

## 폴더 트리 구조

```
project-root/
  voter-application-core/         # 도메인 + 애플리케이션 계층
    domain/model/{Domain}.kt
    application/port/input/{UseCase}UseCase.kt      # 입력 포트 + Command/Query
    application/port/output/repository/{UseCase}Port.kt
    application/service/{UseCase}Service.kt

  adapter-output/                 # 출력 어댑터 계층
    persistence/h2/.../internal/{Domain}PersistenceH2Adapter.kt
    persistence/memory/.../internal/{Domain}PersistenceMemoryAdapter.kt
    rpc/{rpc-domain}/.../internal/{Domain}RpcAdapter.kt

  voter-ms/                       # REST 입력 어댑터 (Spring WebFlux)
    adapter/input/rest/data/{Domain}Json.kt
    adapter/input/rest/reactor/Find{Domain}Controller.kt
    adapter/input/rest/reactor/Register{Domain}Controller.kt
    adapter/input/rest/kotlinflow/Find{Domain}KotlinFlowHandler.kt
    adapter/input/rest/kotlinflow/{Domain}KotlinFlowRouterConfiguration.kt

  voter-lambda/                   # AWS Lambda 입력 어댑터 (Quarkus)
    adapter/input/lambda/{Action}{Domain}Lambda.kt
    adapter/input/lambda/data/{Action}{Domain}Command.kt
    adapter/input/lambda/data/{Domain}Json.kt

  voter-common/                   # 공통 어노테이션 (@InternalPackage)
```

## 새 도메인/기능 추가 순서

1. `voter-application-core` - 도메인 모델 정의
2. `voter-application-core` - 입력 포트 (`{UseCase}UseCase.kt`) + Command/Query 중첩 클래스
3. `voter-application-core` - 출력 포트 (`{UseCase}Port.kt`)
4. `voter-application-core` - 애플리케이션 서비스 (`{UseCase}Service.kt`)
5. `adapter-output` - 출력 어댑터 구현 (Memory 먼저, H2 나중에)
6. `voter-ms` - REST DTO + Controller/Handler 추가
7. `voter-lambda` - Lambda Command/Json DTO + Handler 추가 (필요 시)

## 각 구획별 핵심 예제 코드

**입력 포트 (voter-application-core)**
```kotlin
interface FindVoterUseCase {
    fun findByLastName(query: FindByLastNameQuery): List<Voter>
    data class FindByLastNameQuery(val lastNameContains: String)
}
```

**애플리케이션 서비스 (voter-application-core)**
```kotlin
@Named
class FindVoterService(private val findVoterRepository: FindVoterPort) : FindVoterUseCase
```

**출력 어댑터 (adapter-output)**
```kotlin
@Repository("VoterPersistenceH2Adapter")
internal class VoterPersistenceH2Adapter(
    private val dsl: DSLContext, private val db: DatabaseClient
) : FindVoterPort, RegisterVoterPort
```

**REST 컨트롤러 (voter-ms)**
```kotlin
@RestController
class FindVoterController(private val findVotersUseCase: FindVoterUseCase) {
    @GetMapping("/voters")
    fun findVoters(@RequestParam lastName: String): Mono<List<VoterJson>>
}
```

**Lambda 핸들러 (voter-lambda)**
```kotlin
@Named("findvoter")
class FindVoterLambda : RequestHandler<FindVoterCommand, List<VoterJson>> {
    @Inject lateinit var findPort: FindVoterPort
}
```

## 관련 파일 목록

**rules/** - 구획별 코드 작성 규칙
- `voter-application-core.md` - 입력 포트, 출력 포트, 서비스 패턴
- `adapter-output.md` - H2/Memory/RPC 출력 어댑터 패턴
- `voter-ms.md` - REST Controller / Kotlin Flow Handler 패턴
- `voter-lambda.md` - AWS Lambda 핸들러 패턴
- `voter-common.md` - 공통 어노테이션 규칙

**skills/** - 자주 쓰는 작업 단계별 가이드
- `add-usecase.md` - 새 유스케이스 전체 흐름 추가
- `add-rest-endpoint.md` - REST 엔드포인트 추가
