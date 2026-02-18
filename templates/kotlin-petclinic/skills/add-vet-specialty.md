# add-vet-specialty

Vet(수의사)과 Specialty(전문 분야) 도메인을 추가하고 HTML/JSON/XML 응답을 지원하는 흐름이다.
참고 규칙: `rules/vet.md`, `rules/model.md`

---

## 파일 생성 순서

### 1. vet/Specialty.kt — 엔티티

```kotlin
@Entity @Table(name = "specialties")
class Specialty : NamedEntity()
```

핵심: 단순 타입 엔티티는 `NamedEntity` 상속 + JPA 매핑만으로 충분

### 2. vet/Vet.kt — 엔티티

```kotlin
@Entity @Table(name = "vets")
class Vet : Person() {
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "vet_specialties",
        joinColumns = [JoinColumn(name = "vet_id")],
        inverseJoinColumns = [JoinColumn(name = "specialty_id")])
    var specialties: MutableSet<Specialty> = HashSet()

    @XmlElement
    fun getSpecialties(): List<Specialty> = specialties.sortedWith(compareBy { it.name })
    fun getNrOfSpecialties(): Int = specialties.size
    fun addSpecialty(specialty: Specialty) = specialties.add(specialty)
}
```

핵심: `Person` 상속 / `@ManyToMany(EAGER)` + `@JoinTable` / 정렬된 `getSpecialties()` 제공

### 3. vet/Vets.kt — XML/JSON 래퍼

```kotlin
@XmlRootElement
data class Vets(var vetList: Collection<Vet>? = null)
```

### 4. vet/VetRepository.kt — 리포지토리 (캐시 적용)

```kotlin
interface VetRepository : Repository<Vet, Int> {
    @Transactional(readOnly = true)
    @Cacheable("vets")
    fun findAll(): Collection<Vet>
}
```

핵심: `@Cacheable("vets")` — 캐시 이름은 `system/CacheConfig`에서 등록된 이름과 일치

### 5. system/CacheConfig.kt — 캐시 이름 등록 확인

```kotlin
it.createCache("vets", createCacheConfiguration())  // "vets" 캐시 등록
```

### 6. vet/VetController.kt — 다중 응답 컨트롤러

```kotlin
@Controller
class VetController(val vetRepository: VetRepository) {
    @GetMapping("/vets.html")
    fun showHtmlVetList(model: MutableMap<String, Any>): String {
        model["vets"] = Vets(vetRepository.findAll()); return "vets/vetList"
    }
    @GetMapping("vets.json", produces = ["application/json"])
    @ResponseBody
    fun showJsonVetList(): Vets = Vets(vetRepository.findAll())

    @GetMapping("vets.xml")
    @ResponseBody
    fun showXmlVetList(): Vets = Vets(vetRepository.findAll())
}
```

핵심: HTML은 model에 담아 뷰 반환 / JSON·XML은 `@ResponseBody` + `Vets` 래퍼 직접 반환

### 7. templates/vets/vetList.html — 뷰

---

## 체크리스트

- [ ] `Specialty`: `NamedEntity` 상속, `@Entity @Table`
- [ ] `Vet`: `Person` 상속, `@ManyToMany(EAGER)`, 정렬된 `getSpecialties()`
- [ ] `Vets`: `@XmlRootElement` 래퍼 data class
- [ ] `VetRepository`: `@Cacheable("vets")` + `@Transactional(readOnly = true)`
- [ ] `CacheConfig`: `"vets"` 캐시 이름 등록 확인
- [ ] `VetController`: HTML/JSON/XML 세 가지 엔드포인트 구현
