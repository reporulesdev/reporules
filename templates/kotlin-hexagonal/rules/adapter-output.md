---
paths:
  - "adapter-output/**/*"
---

# adapter-output

## 책임
애플리케이션 계층의 출력 포트를 구현하는 영속성(H2/Memory) 및 외부 서비스(RPC) 어댑터

## 연관관계
```
{UseCase}Port (출력 포트 인터페이스, voter-application-core)
  --> {Domain}PersistenceH2Adapter     (jOOQ + R2DBC)
  --> {Domain}PersistenceMemoryAdapter (인메모리 Map)
  --> {Domain}RpcAdapter               (WebClient + Resilience4j)
```

---

## 파일 구조

```text
adapter-output/
  persistence/h2/.../adapter/output/persistence/h2/internal/
    {Domain}PersistenceH2Adapter.kt
  persistence/memory/.../adapter/output/persistence/h2/internal/
    {Domain}PersistenceMemoryAdapter.kt
  rpc/{rpc-domain}/.../adapter/output/rpc/{rpc-domain}/internal/
    {Domain}RpcAdapter.kt
```

---

## 패턴

### H2 영속성 어댑터 (jOOQ + R2DBC)

```kotlin
@Repository("VoterPersistenceH2Adapter")
internal class VoterPersistenceH2Adapter(
    private val dsl: DSLContext, private val db: DatabaseClient
) : FindVoterPort, RegisterVoterPort {

    override fun findBy(query: FindByQuery): List<Voter> =
        dsl.select().from(T_VOTER)
            .where(T_VOTER.NAME.equalIgnoreCase(query.nameContains))
            .fetch().map { /* Record -> Voter */ }

    override suspend fun saveReactive(cmd: RegisterVoterCommand): UUID {
        val id = UUID.randomUUID()
        db.execute(dsl.insertInto(T_VOTER).values(id).getSQL(ParamType.INLINED)).await()
        return id
    }
}
```
- `internal` + `@Repository("...")`로 Bean 이름 명시 (동일 포트 다중 구현 시 필수)
- 동기: `DSLContext`, Reactive: `DatabaseClient` + `suspend`
- jOOQ Record ↔ 도메인 객체 매핑은 어댑터 내부 책임

### 인메모리 어댑터

```kotlin
@Repository("VoterPersistenceMemoryAdapter")
internal class VoterRepository : FindVoterPort, RegisterVoterPort {
    private val store = mutableMapOf<UUID, Voter>()

    override fun findBy(query: FindByQuery): List<Voter> =
        store.values.filter { it.name.contains(query.nameContains, true) }
}
```
- H2 어댑터와 동일 포트 인터페이스 구현
- `init` 블록에서 초기 데이터 구성 가능

### RPC 어댑터

```kotlin
@Repository
internal class VoterEligibilityRpcAdapter(
    private val webClient: WebClient = WebClient.create()
) : VoterEligibilityPort {

    override suspend fun isEligible(query: VoterEligibilityQuery): Boolean {
        val cb = CircuitBreaker.ofDefaults("eligibility-service")
        return cb.executeSuspendFunction {
            webClient.get().uri("https://example.com")
                .awaitExchange().awaitBody<String>().isNotEmpty()
        }
    }
}
```
- Resilience4j `CircuitBreaker`로 외부 호출 래핑
- 도메인에 HTTP 세부사항 노출 금지, 포트 메서드는 도메인 언어로만 표현

---

## 중요 규칙

- 구현 클래스는 `...adapter.output.[persistence|rpc].{subdomain}.internal` 패키지에 위치
- `internal` 가시성 + `@InternalPackage` (`voter-common`) 조합으로 내부 구현 명시
- H2 어댑터 스키마/샘플 데이터는 Flyway 마이그레이션 SQL로 관리
- Resilience4j, WebClient 의존성은 이 모듈에만 한정