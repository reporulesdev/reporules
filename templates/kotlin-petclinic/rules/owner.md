---
paths:
  - "owner/**/*"
---

# owner

## 책임

Owner / Pet / PetType 도메인 엔티티, Spring Data JPA 리포지토리, Spring MVC 컨트롤러, 폼 포맷터 및 검증기를 모두 포함하는 핵심 기능 구획이다.

## 연관관계

```
HTTP 요청
  → OwnerController → OwnerRepository → Owner (+ pets: MutableSet<Pet>)
  → PetController   → PetRepository   → Pet (type: PetType, owner: Owner)
                      PetTypeFormatter (String ↔ PetType)
                      PetValidator (Pet 폼 검증)
  → VisitController → VisitRepository → Visit (petId 설정)
                      PetRepository.findById
```

---

## 엔티티 패턴

### Owner
- `Person` 상속, `@Entity @Table(name = "owners")`
- 컬렉션: `var pets: MutableSet<Pet>`, 외부 노출은 `getPets(): List<Pet>` (정렬)
- 편의 메서드: `addPet(pet)` — 양방향 연관관계 동시 설정

```kotlin
fun addPet(pet: Pet) {
    if (pet.isNew) pets.add(pet)
    pet.owner = this
}
```

### Pet
- `NamedEntity` 상속, `@Entity @Table(name = "pets")`
- 날짜: `@DateTimeFormat(pattern = "yyyy-MM-dd")`
- DB 비저장 컬렉션: `@Transient var visits: MutableSet<Visit>`

### PetType
- `NamedEntity` 상속 + 매핑만 정의: `open class PetType : NamedEntity()`

---

## 리포지토리 패턴

```kotlin
interface OwnerRepository : Repository<Owner, Int> {
    @Query("SELECT DISTINCT owner FROM Owner owner left join fetch owner.pets WHERE owner.lastName LIKE :lastName%")
    @Transactional(readOnly = true)
    fun findByLastName(lastName: String): Collection<Owner>
    fun save(owner: Owner)
}
```

- 읽기 메서드: `@Transactional(readOnly = true)`
- 복잡 조회: `@Query` JPQL + `left join fetch`로 N+1 방지
- 저장: `save(entity)` 하나로 insert/update 통합

---

## 컨트롤러 패턴

- `@InitBinder`: `binder.setDisallowedFields("id")`로 id 폼 수정 금지
- `@ModelAttribute`: 공통 모델 데이터(types, owner) 자동 주입
- POST 패턴: `@Valid` + `BindingResult` → 에러 시 폼 뷰, 성공 시 `save` 후 `"redirect:/..."`
- 하위 리소스: 클래스 레벨 `@RequestMapping("/owners/{ownerId}")` 사용

---

## 포맷터/검증기

- `PetTypeFormatter`: `Formatter<PetType>` + `@Component` — 문자열 ↔ PetType 변환
- `PetValidator`: `Validator` 구현 — `@InitBinder("pet")`에서 수동 등록
