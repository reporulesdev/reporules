---
paths:
  - "vet/**/*"
---

# vet

## 책임
Vet·Specialty 엔티티 정의, JPA 매핑, 캐시 적용 리포지토리, XML/JSON 직렬화 래퍼, 페이징 컨트롤러를 담당한다.

## 연관관계
```
GET /vets.html → VetController.showVetList (페이징)
                  → VetRepository.findAll(Pageable) [@Cacheable]
                      → Vet (@Entity) ←@ManyToMany→ Specialty (@Entity)
GET /vets      → VetController.showResourcesVetList
                  → Vets (@XmlRootElement 래퍼) → List<Vet>
```

## Naming
- 엔티티: 단수형 (`Vet`, `Specialty`) / 컬렉션 래퍼: 복수형 (`Vets`)
- 리포지토리: `VetRepository` / 컨트롤러: `VetController`

## Constraints

### 1. JPA 엔티티

```java
@Entity @Table(name = "specialties")
public class Specialty extends NamedEntity { }

@Entity @Table(name = "vets")
public class Vet extends Person {
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "vet_specialties",
        joinColumns = @JoinColumn(name = "vet_id"),
        inverseJoinColumns = @JoinColumn(name = "specialty_id"))
    private Set<Specialty> specialties;
}
```

### 2. 컬렉션 필드 캡슐화
- 내부용: `get{Field}Internal()` → null 방지 초기화
- 외부용: 정렬된 `List` 반환, `@XmlElement` 부착

```java
protected Set<Specialty> getSpecialtiesInternal() {
    if (this.specialties == null) this.specialties = new HashSet<>();
    return this.specialties;
}
@XmlElement
public List<Specialty> getSpecialties() {
    return getSpecialtiesInternal().stream()
        .sorted(Comparator.comparing(NamedEntity::getName))
        .collect(Collectors.toList());
}
```

### 3. Vets 래퍼
```java
@XmlRootElement
public class Vets {
    private List<Vet> vets;
    @XmlElement
    public List<Vet> getVetList() {
        if (vets == null) vets = new ArrayList<>();
        return vets;
    }
}
```

### 4. Repository - @Cacheable + 페이징
```java
public interface VetRepository extends Repository<Vet, Integer> {
    @Transactional(readOnly = true)
    @Cacheable("vets")
    Collection<Vet> findAll() throws DataAccessException;

    @Transactional(readOnly = true)
    @Cacheable("vets")
    Page<Vet> findAll(Pageable pageable) throws DataAccessException;
}
```

### 5. 컨트롤러 - HTML 뷰 / API 분리
- HTML: `/vets.html` + `PageRequest` + `Model`에 페이징 정보
- API: `/vets` + `@ResponseBody Vets`

```java
@GetMapping({ "/vets" })
public @ResponseBody Vets showResourcesVetList() {
    Vets vets = new Vets();
    vets.getVetList().addAll(vetRepository.findAll());
    return vets;
}
```
