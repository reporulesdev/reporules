---
paths:
  - "visit/**/*"
---

# visit

## 책임

Visit(진료 기록) 도메인 엔티티와 리포지토리를 정의하며, Pet에 진료 기록을 연결하는 최소한의 구획이다.

## 연관관계

```
owner/VisitController
  → VisitRepository.save(visit)
  → Visit (petId: Int?)

owner/Pet.addVisit(visit)
  → visit.petId = this.id   (Pet과의 연결은 petId 필드로 단방향)

owner/OwnerController.showOwner()
  → VisitRepository.findByPetId(petId)
  → pet.visits (MutableSet, @Transient)
```

---

## Naming

- 도메인 엔티티: 단수형 명사 `Visit`
- 리포지토리: `{Entity}Repository` → `VisitRepository`

## Constraints

### 1. 패키지

```kotlin
package org.springframework.samples.petclinic.visit
```

### 2. 엔티티 클래스

- `BaseEntity` 상속, `@Entity`, `@Table(name = "visits")`
- 필드는 `var` 사용
- `date`는 `LocalDate.now()`로 기본값 설정

```kotlin
@Entity
@Table(name = "visits")
class Visit : BaseEntity() {
    var date: LocalDate = LocalDate.now()
    var description: String? = null
    var petId: Int? = null
}
```

### 3. Repository 인터페이스

- `Repository<Visit, Int>` 상속
- 저장: `fun save(visit: Visit)`
- 조회: Spring Data 네이밍 규칙 (`findBy{Property}`)

```kotlin
interface VisitRepository : Repository<Visit, Int> {
    fun save(visit: Visit)
    fun findByPetId(petId: Int): MutableSet<Visit>
}
```

### 4. Visit과 Pet의 연결

- Pet과의 연관관계는 외래키(`petId`)로만 설정 (JPA `@ManyToOne` 없음)
- `Pet.addVisit(visit)` 편의 메서드에서 `visit.petId = this.id` 설정
