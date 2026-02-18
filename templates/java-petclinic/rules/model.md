---
paths:
  - "model/**/*"
---

# model

## 책임
모든 도메인 엔티티가 공통으로 상속하는 베이스 클래스(id 관리, 이름 속성, 인물 속성)를 제공한다.

## 연관관계
```
model.BaseEntity
  └── model.NamedEntity  (name 속성 추가)
  └── model.Person       (firstName/lastName 추가)
        └── owner.Owner
        └── owner.Pet  (NamedEntity 경로)
        └── vet.Vet
        └── vet.Specialty (NamedEntity 경로)
```

## Naming

- 공통 베이스: `BaseEntity`
- 이름 속성 베이스: `NamedEntity` (BaseEntity 상속)
- 인물 베이스: `Person` (BaseEntity 상속)

## Constraints

### 1. BaseEntity

- `@MappedSuperclass`, `Serializable` 구현
- `id`: `@Id` + `@GeneratedValue(strategy = GenerationType.IDENTITY)`
- `isNew()`: `id == null` 여부 반환

```java
@MappedSuperclass
public class BaseEntity implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    public boolean isNew() { return this.id == null; }
}
```

### 2. NamedEntity

- `BaseEntity` 상속 + `@MappedSuperclass`
- `name`: `@Column` + `@NotBlank`
- `toString()`: name != null → name, 아니면 `"<null>"`

```java
@MappedSuperclass
public class NamedEntity extends BaseEntity {
    @Column @NotBlank
    private String name;
    @Override
    public String toString() {
        return (this.name != null) ? this.name : "<null>";
    }
}
```

### 3. Person

- `BaseEntity` 상속 + `@MappedSuperclass`
- `firstName`, `lastName`: 각각 `@Column` + `@NotBlank`

```java
@MappedSuperclass
public class Person extends BaseEntity {
    @Column @NotBlank private String firstName;
    @Column @NotBlank private String lastName;
}
```
