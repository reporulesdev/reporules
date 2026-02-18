---
paths:
  - "owner/**/*"
---

# owner

## 책임
Owner·Pet·Visit·PetType 도메인의 Entity, Repository, Controller, Formatter, Validator를 모두 담당한다.

## 연관관계
```
HTTP 요청 → OwnerController / PetController / VisitController
  → OwnerRepository / PetTypeRepository (JpaRepository)
      → Owner(Person) → Pet(NamedEntity) → Visit(BaseEntity)
                      → PetType(NamedEntity)
PetTypeFormatter ← PetTypeRepository  (폼 String→PetType 변환)
PetValidator ← PetController @InitBinder
```

## Naming
- 엔티티: 단수형 (`Owner`, `Pet`, `PetType`, `Visit`)
- 리포지토리: `{Entity}Repository` / 컨트롤러: `{Entity}Controller`
- Formatter: `{Type}Formatter` / Validator: `{Type}Validator`

## Constraints

### 1. 패키지 / 라이선스
```java
package org.springframework.samples.petclinic.owner;
// 파일 상단 Apache 2.0 라이선스 헤더 필수
```

### 2. JPA 엔티티
- `@Entity` + `@Table(name="...")`, 컬렉션은 `final` 구체 타입 + `@OneToMany`+`@JoinColumn`

```java
@Entity @Table(name = "owners")
public class Owner extends Person {
    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id")
    private final List<Pet> pets = new ArrayList<>();
}
```

### 3. Bean Validation
- 문자열: `@NotBlank` / 전화번호: `@Pattern(regexp = "\\d{10}")` / 날짜: `@DateTimeFormat(pattern = "yyyy-MM-dd")`

### 4. Repository
```java
public interface OwnerRepository extends JpaRepository<Owner, Integer> {
    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);
}
public interface PetTypeRepository extends JpaRepository<PetType, Integer> {
    @Query("SELECT ptype FROM PetType ptype ORDER BY ptype.name")
    List<PetType> findPetTypes();
}
```

### 5. 컨트롤러 패턴
- 패키지 프라이빗 클래스, `@Controller`
- `@InitBinder`: id 바인딩 제외 + pet 폼에 `PetValidator` 등록
- `@ModelAttribute`: findById or new, 없으면 `IllegalArgumentException`

```java
@ModelAttribute("owner")
public Owner findOwner(@PathVariable(required = false) Integer ownerId) {
    return ownerId == null ? new Owner()
        : owners.findById(ownerId)
            .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));
}
```

### 6. 폼 처리
```java
@PostMapping("/owners/new")
public String processCreationForm(@Valid Owner owner, BindingResult result,
        RedirectAttributes redirectAttributes) {
    if (result.hasErrors()) return "owners/createOrUpdateOwnerForm";
    owners.save(owner);
    redirectAttributes.addFlashAttribute("message", "New Owner Created");
    return "redirect:/owners/" + owner.getId();
}
```

### 7. Formatter / Validator
- `PetTypeFormatter`: `@Component`, `parse()`에서 불일치 시 `ParseException`
- `PetValidator`: `Validator` 구현, 상수 `REQUIRED` 에러 코드, `supports()`로 타입 제한
