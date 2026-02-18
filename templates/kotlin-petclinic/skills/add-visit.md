# add-visit

Pet에 Visit(진료 기록)을 추가하는 흐름이다.
참고 규칙: `rules/visit.md`, `rules/owner.md`

---

## 파일 생성 순서

### 1. visit/Visit.kt — 엔티티

```kotlin
@Entity @Table(name = "visits")
class Visit : BaseEntity() {
    var date: LocalDate = LocalDate.now()
    @NotEmpty var description: String? = null
    var petId: Int? = null
}
```

핵심: `BaseEntity` 상속 / `petId`는 JPA `@ManyToOne` 없이 `Int?` 필드로만 저장

### 2. visit/VisitRepository.kt — 리포지토리

```kotlin
interface VisitRepository : Repository<Visit, Int> {
    fun save(visit: Visit)
    fun findByPetId(petId: Int): MutableSet<Visit>
}
```

### 3. owner/Pet.kt — addVisit 편의 메서드 확인

```kotlin
@Transient var visits: MutableSet<Visit> = LinkedHashSet()

fun addVisit(visit: Visit) {
    visits.add(visit)
    visit.petId = this.id   // petId 연결은 여기서 이루어짐
}
```

### 4. owner/VisitController.kt — 컨트롤러

```kotlin
@Controller
class VisitController(val visits: VisitRepository, val pets: PetRepository) {

    @InitBinder
    fun setAllowedFields(binder: WebDataBinder) { binder.setDisallowedFields("id") }

    @ModelAttribute("visit")
    fun loadPetWithVisit(@PathVariable("petId") petId: Int, model: MutableMap<String, Any>): Visit {
        val pet = pets.findById(petId)
        model["pet"] = pet
        val visit = Visit()
        pet.addVisit(visit)  // petId 자동 설정
        return visit
    }

    @GetMapping("/owners/*/pets/{petId}/visits/new")
    fun initNewVisitForm(@PathVariable("petId") petId: Int, model: Map<String, Any>): String =
        "pets/createOrUpdateVisitForm"

    @PostMapping("/owners/{ownerId}/pets/{petId}/visits/new")
    fun processNewVisitForm(@Valid visit: Visit, result: BindingResult): String =
        if (result.hasErrors()) "pets/createOrUpdateVisitForm"
        else { visits.save(visit); "redirect:/owners/{ownerId}" }
}
```

핵심: `@ModelAttribute("visit")`에서 Pet 조회 + Visit 생성 + `pet.addVisit()` 동시 처리

### 5. owner/OwnerController.showOwner() — Visit 목록 로딩

```kotlin
for (pet in owner.getPets()) {
    pet.visits = visits.findByPetId(pet.id!!)  // @Transient 필드에 수동 로딩
}
```

핵심: `@Transient` 컬렉션은 컨트롤러에서 직접 채워야 한다.

### 6. templates/pets/createOrUpdateVisitForm.html — 뷰

---

## 체크리스트

- [ ] `Visit`: `BaseEntity` 상속, `petId: Int?` 필드
- [ ] `VisitRepository`: `findByPetId` 조회 메서드 포함
- [ ] `VisitController`: `@ModelAttribute("visit")`에서 `pet.addVisit(visit)` 호출
- [ ] `OwnerController.showOwner()`: `visits.findByPetId(pet.id!!)` 로 visits 채우기
