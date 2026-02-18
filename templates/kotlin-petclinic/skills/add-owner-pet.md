# add-owner-pet

Owner와 Pet 도메인을 신규 추가하는 전체 흐름이다.
참고 규칙: `rules/model.md`, `rules/owner.md`

---

## 파일 생성 순서

### 1. model/ — 상위 클래스 선택

사람 도메인 → `Person` 상속 / 이름만 있는 타입 → `NamedEntity` / 그 외 → `BaseEntity`

### 2. owner/Owner.kt — 엔티티

```kotlin
@Entity @Table(name = "owners")
class Owner : Person() {
    @Column(name = "address") @NotEmpty var address = ""
    @Column(name = "telephone") @NotEmpty @Digits(fraction = 0, integer = 10) var telephone = ""
    @OneToMany(cascade = [CascadeType.ALL], mappedBy = "owner")
    var pets: MutableSet<Pet> = HashSet()
    fun getPets(): List<Pet> = pets.sortedWith(compareBy { it.name })
    fun addPet(pet: Pet) { if (pet.isNew) pets.add(pet); pet.owner = this }
}
```

핵심: 컬렉션 `MutableSet` + 정렬된 `List` 반환 / `addPet()`에서 양방향 연관관계 설정

### 3. owner/Pet.kt — 엔티티

```kotlin
@Entity @Table(name = "pets")
class Pet : NamedEntity() {
    @DateTimeFormat(pattern = "yyyy-MM-dd") var birthDate: LocalDate? = null
    @ManyToOne @JoinColumn(name = "type_id") var type: PetType? = null
    @ManyToOne @JoinColumn(name = "owner_id") var owner: Owner? = null
    @Transient var visits: MutableSet<Visit> = LinkedHashSet()
}
```

### 4. owner/OwnerRepository.kt — 리포지토리

```kotlin
interface OwnerRepository : Repository<Owner, Int> {
    @Query("SELECT DISTINCT owner FROM Owner owner left join fetch owner.pets WHERE owner.lastName LIKE :lastName%")
    @Transactional(readOnly = true)
    fun findByLastName(lastName: String): Collection<Owner>
    @Transactional(readOnly = true)
    fun findById(id: Int): Owner
    fun save(owner: Owner)
}
```

핵심: `left join fetch`로 N+1 방지 / `@Transactional(readOnly = true)` 필수

### 5. owner/OwnerController.kt — 컨트롤러

```kotlin
@Controller
class OwnerController(val owners: OwnerRepository) {
    @InitBinder
    fun setAllowedFields(binder: WebDataBinder) { binder.setDisallowedFields("id") }

    @GetMapping("/owners/new")
    fun initCreationForm(model: MutableMap<String, Any>): String {
        model["owner"] = Owner(); return "owners/createOrUpdateOwnerForm"
    }
    @PostMapping("/owners/new")
    fun processCreationForm(@Valid owner: Owner, result: BindingResult): String =
        if (result.hasErrors()) "owners/createOrUpdateOwnerForm"
        else { owners.save(owner); "redirect:/owners/" + owner.id }
}
```

핵심: `@InitBinder`로 id 수정 금지 / POST: `@Valid` + `BindingResult` → 에러 시 폼 / 성공 시 redirect

### 6. templates/owners/ — 뷰 파일

`createOrUpdateOwnerForm.html`, `ownerDetails.html`, `ownersList.html`, `findOwners.html`

---

## 체크리스트

- [ ] 엔티티: 적절한 상위 클래스 상속, `@Entity @Table`, 편의 메서드
- [ ] 컬렉션: `MutableSet` + `getXxx(): List` 패턴
- [ ] 리포지토리: `@Transactional(readOnly = true)`, `left join fetch`
- [ ] 컨트롤러: `@InitBinder` id 수정 금지, POST에 `@Valid` + `BindingResult`
