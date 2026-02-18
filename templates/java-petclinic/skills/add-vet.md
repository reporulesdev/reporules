# add-vet

Vet 도메인 전체(Entity → Repository → Controller + XML 래퍼)를 추가하는 흐름.
참고 rules: `rules/model.md`, `rules/vet.md`

---

## 1단계: Specialty Entity (`vet/Specialty.java`)

- `NamedEntity` 상속, `@Entity`, `@Table(name="specialties")`

```java
package org.springframework.samples.petclinic.vet;

@Entity
@Table(name = "specialties")
public class Specialty extends NamedEntity { }
```

## 2단계: Vet Entity (`vet/Vet.java`)

- `Person` 상속, `@Entity`, `@Table(name="vets")`
- specialties: `@ManyToMany` + `@JoinTable`
- 컬렉션 캡슐화: internal getter(null 초기화) + 외부 getter(정렬 List, `@XmlElement`)

```java
@Entity
@Table(name = "vets")
public class Vet extends Person {

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "vet_specialties",
        joinColumns = @JoinColumn(name = "vet_id"),
        inverseJoinColumns = @JoinColumn(name = "specialty_id"))
    private Set<Specialty> specialties;

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

    public void addSpecialty(Specialty specialty) {
        getSpecialtiesInternal().add(specialty);
    }
}
```

## 3단계: Vets 래퍼 클래스 (`vet/Vets.java`)

- XML/JSON 응답 단순화용, `@XmlRootElement`
- 내부 리스트: `@XmlElement` getter + null 지연 초기화

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

## 4단계: VetRepository (`vet/VetRepository.java`)

- `Repository<Vet, Integer>` 상속 (JpaRepository 아님)
- 조회 메서드: `@Transactional(readOnly = true)` + `@Cacheable("vets")`
- HTML 페이징용 + API 전체 조회용 오버로드 제공

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

## 5단계: VetController (`vet/VetController.java`)

- HTML 뷰용(`/vets.html`): `PageRequest` 페이징 → `Model`에 페이징 정보 저장
- API용(`/vets`): `@ResponseBody Vets` 반환

```java
@Controller
class VetController {
    private final VetRepository vetRepository;

    @GetMapping("/vets.html")
    public String showVetList(@RequestParam(defaultValue = "1") int page, Model model) {
        Vets vets = new Vets();
        Page<Vet> paginated = vetRepository.findAll(PageRequest.of(page - 1, 5));
        vets.getVetList().addAll(paginated.toList());
        model.addAttribute("currentPage", page);
        model.addAttribute("totalPages", paginated.getTotalPages());
        model.addAttribute("listVets", paginated.getContent());
        return "vets/vetList";
    }

    @GetMapping({ "/vets" })
    public @ResponseBody Vets showResourcesVetList() {
        Vets vets = new Vets();
        vets.getVetList().addAll(vetRepository.findAll());
        return vets;
    }
}
```

## 6단계: 캐시 설정 확인

- `system/CacheConfiguration.java` 에서 `"vets"` 캐시 생성 여부 확인
- 없으면 `cm.createCache("vets", cacheConfiguration())` 추가
