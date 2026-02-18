---
paths:
  - "vet/**/*"
---

# vet

## 책임

Vet(수의사)과 Specialty(전문 분야) 도메인 엔티티, 리포지토리, 컨트롤러를 포함하며 HTML/JSON/XML 다중 응답 형식을 지원한다.

## 연관관계

```
HTTP 요청 (/vets.html, /vets.json, /vets.xml)
  → VetController → VetRepository (@Cacheable("vets"))
  → Vet (specialties: MutableSet<Specialty>)
  → Vets 래퍼 (@XmlRootElement) → JSON/XML 직렬화
```

---

## Naming

- 도메인 엔티티: 단수형 (`Vet`, `Specialty`) / 컬렉션 래퍼: 복수형 (`Vets`)
- 리포지토리: `{Entity}Repository` / 컨트롤러: `{Domain}Controller`

## Constraints

### 1. JPA 엔티티 매핑

```kotlin
@Entity @Table(name = "specialties")
class Specialty : NamedEntity()

@Entity @Table(name = "vets")
class Vet : Person() {
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "vet_specialties",
        joinColumns = [JoinColumn(name = "vet_id")],
        inverseJoinColumns = [JoinColumn(name = "specialty_id")])
    var specialties: MutableSet<Specialty> = HashSet()
}
```

### 2. 컬렉션 접근 메서드

```kotlin
@XmlElement
fun getSpecialties(): List<Specialty> = specialties.sortedWith(compareBy { it.name })
fun getNrOfSpecialties(): Int = specialties.size
fun addSpecialty(specialty: Specialty) = specialties.add(specialty)
```

### 3. 리포지토리 — 캐시 적용

```kotlin
interface VetRepository : Repository<Vet, Int> {
    @Transactional(readOnly = true)
    @Cacheable("vets")
    fun findAll(): Collection<Vet>
}
```

### 4. 컨트롤러 — 다중 응답 형식

```kotlin
@Controller
class VetController(val vetRepository: VetRepository) {
    @GetMapping("/vets.html")
    fun showHtmlVetList(model: MutableMap<String, Any>): String {
        model["vets"] = Vets(vetRepository.findAll())
        return "vets/vetList"
    }
    @GetMapping("vets.json", produces = ["application/json"])
    @ResponseBody
    fun showJsonVetList(): Vets = Vets(vetRepository.findAll())
}
```

### 5. XML/JSON 직렬화 래퍼

```kotlin
@XmlRootElement
data class Vets(var vetList: Collection<Vet>? = null)
```
