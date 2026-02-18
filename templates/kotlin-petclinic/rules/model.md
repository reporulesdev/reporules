---
paths:
  - "model/**/*"
---

# model

## 책임

공통 JPA 기반 클래스(`BaseEntity`, `NamedEntity`, `Person`)를 정의하여 모든 도메인 엔티티가 ID·이름·사람 속성을 상속받을 수 있게 한다.

## 연관관계

```
BaseEntity (id)
  └─ NamedEntity (name)   ←── PetType, Specialty
  └─ Person (firstName, lastName)  ←── Owner, Vet
  └─ Visit (직접 상속)
```

데이터 흐름: `model` 기반 클래스 → `owner`, `vet`, `visit` 도메인 엔티티가 상속

---

## Naming

- 공통 속성을 가지는 상위 엔티티는 `*Entity` 또는 의미 있는 도메인명(`Person`)으로 선언하며 `open class`로 정의한다.

## Constraints

### 1. 공통 ID 속성은 BaseEntity 상속

- ID를 가지는 도메인 객체는 `BaseEntity`를 상속하여 `id` 필드를 공유한다.
- `@MappedSuperclass` + `@Id` + `@GeneratedValue(strategy = GenerationType.IDENTITY)` 사용.

```kotlin
@MappedSuperclass
open class BaseEntity : Serializable {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    open var id: Int? = null
}
```

### 2. name 속성이 있는 엔티티는 NamedEntity 상속

- `name` 속성이 필요한 엔티티는 `NamedEntity`를 상속.
- `@MappedSuperclass`, `@Column(name = "name")`, `open var`로 선언.

```kotlin
@MappedSuperclass
open class NamedEntity : BaseEntity() {
    @Column(name = "name")
    open var name: String? = null
}
```

### 3. 사람(Person) 도메인 공통 속성은 Person 상속

- `firstName`, `lastName`은 각각 `@Column`, `@NotEmpty` 부착.
- 기본값은 빈 문자열.

```kotlin
@MappedSuperclass
open class Person : BaseEntity() {
    @Column(name = "first_name") @NotEmpty var firstName = ""
    @Column(name = "last_name") @NotEmpty var lastName = ""
}
```
