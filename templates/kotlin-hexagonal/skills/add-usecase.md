# Skill: 새 유스케이스 전체 흐름 추가

도메인 코어부터 REST 어댑터까지 새 유스케이스를 추가하는 전체 단계

---

## 예시 시나리오
"선거구(District) 조회" 기능 추가

---

## Step 1: 도메인 모델 정의
`voter-application-core/domain/model/District.kt`

```kotlin
data class District(
    val id: UUID,
    val name: String,
    val region: String
)
```

---

## Step 2: 입력 포트 + Command/Query 정의
`voter-application-core/application/port/input/FindDistrictUseCase.kt`

```kotlin
interface FindDistrictUseCase {
    fun findByName(query: FindByNameQuery): List<District>
    suspend fun findByNameReactive(query: FindByNameQuery): Flow<District>

    data class FindByNameQuery(val nameContains: String) {
        init {
            validate(this) {
                validate(FindByNameQuery::nameContains).isNotBlank()
            }
        }
    }
}
```
- Command/Query는 UseCase 인터페이스 내부 중첩 클래스로 선언
- 동기/Reactive 메서드가 필요하면 둘 다 선언

---

## Step 3: 출력 포트 정의
`voter-application-core/application/port/output/repository/FindDistrictPort.kt`

```kotlin
interface FindDistrictPort {
    fun findDistrictsByName(query: FindDistrictUseCase.FindByNameQuery): List<District>
    fun findDistrictsByNameReactive(query: FindDistrictUseCase.FindByNameQuery): Flow<District>
}
```

---

## Step 4: 애플리케이션 서비스 구현
`voter-application-core/application/service/FindDistrictService.kt`

```kotlin
@Named
class FindDistrictService(
    private val findDistrictPort: FindDistrictPort
) : FindDistrictUseCase {

    override fun findByName(query: FindByNameQuery): List<District> =
        findDistrictPort.findDistrictsByName(query)

    override suspend fun findByNameReactive(query: FindByNameQuery): Flow<District> =
        findDistrictPort.findDistrictsByNameReactive(query)
}
```

---

## Step 5: 출력 어댑터 구현 (인메모리 먼저)
`adapter-output/persistence/memory/.../DistrictPersistenceMemoryAdapter.kt`

```kotlin
@Repository("DistrictPersistenceMemoryAdapter")
internal class DistrictPersistenceMemoryAdapter : FindDistrictPort {
    private val store = mutableMapOf<UUID, District>()

    init {
        store[UUID.randomUUID()] = District(UUID.randomUUID(), "Seoul", "Capital")
    }

    override fun findDistrictsByName(query: FindByNameQuery): List<District> =
        store.values.filter { it.name.contains(query.nameContains, ignoreCase = true) }
}
```

---

## Step 6: REST DTO 추가
`voter-ms/adapter/input/rest/data/DistrictJson.kt`

```kotlin
data class DistrictJson(val id: String, val name: String, val region: String)
```

---

## Step 7: REST 컨트롤러 추가
`voter-ms/adapter/input/rest/reactor/FindDistrictController.kt`

```kotlin
@RestController
class FindDistrictController(private val findDistrictUseCase: FindDistrictUseCase) {
    @GetMapping("/districts")
    fun findDistricts(@RequestParam name: String): Mono<List<DistrictJson>> =
        just(findDistrictUseCase.findByName(FindByNameQuery(name))
            .map { DistrictJson(it.id.toString(), it.name, it.region) })
}
```

---

## 체크리스트

- [ ] `District.kt` (도메인 모델)
- [ ] `FindDistrictUseCase.kt` (입력 포트 + Query)
- [ ] `FindDistrictPort.kt` (출력 포트)
- [ ] `FindDistrictService.kt` (서비스)
- [ ] `DistrictPersistenceMemoryAdapter.kt` (출력 어댑터)
- [ ] `DistrictJson.kt` (REST DTO)
- [ ] `FindDistrictController.kt` (REST 컨트롤러)
