# add-owner

Owner 도메인 전체(Entity → Repository → Controller)를 처음부터 추가하는 흐름.
참고 rules: `rules/model.md`, `rules/owner.md`

---

## 1단계: Entity (`owner/Owner.java`)

- `Person` 상속, `@Entity`, `@Table(name="owners")`
- 컬렉션: `@OneToMany(cascade=ALL, fetch=EAGER)` + `final List`
- 문자열 필드: `@NotBlank` / 전화번호: `@Pattern(regexp = "\\d{10}")`

```java
@Entity @Table(name = "owners")
public class Owner extends Person {

    @Column(name = "address") @NotBlank
    private String address;

    @NotBlank
    @Pattern(regexp = "\\d{10}", message = "{telephone.invalid}")
    private String telephone;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id")
    private final List<Pet> pets = new ArrayList<>();

    public void addPet(Pet pet) {
        if (pet.isNew()) pets.add(pet);
    }
}
```

## 2단계: Repository (`owner/OwnerRepository.java`)

```java
public interface OwnerRepository extends JpaRepository<Owner, Integer> {
    Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable);
    Optional<Owner> findById(Integer id);
}
```

## 3단계: Controller (`owner/OwnerController.java`)

- 패키지 프라이빗, `@Controller`
- `@InitBinder`: `setDisallowedFields("id")`
- `@ModelAttribute`: ownerId 있으면 findById, 없으면 new

```java
@Controller
class OwnerController {
    private final OwnerRepository owners;
    OwnerController(OwnerRepository owners) { this.owners = owners; }

    @InitBinder
    public void setAllowedFields(WebDataBinder dataBinder) {
        dataBinder.setDisallowedFields("id");
    }

    @ModelAttribute("owner")
    public Owner findOwner(@PathVariable(required = false) Integer ownerId) {
        return ownerId == null ? new Owner()
            : owners.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));
    }

    @GetMapping("/owners/new")
    public String initCreationForm() { return "owners/createOrUpdateOwnerForm"; }

    @PostMapping("/owners/new")
    public String processCreationForm(@Valid Owner owner, BindingResult result,
            RedirectAttributes redirectAttributes) {
        if (result.hasErrors()) return "owners/createOrUpdateOwnerForm";
        owners.save(owner);
        redirectAttributes.addFlashAttribute("message", "New Owner Created");
        return "redirect:/owners/" + owner.getId();
    }
}
```

## 4단계: 도메인 메서드 null 검증

```java
public void addVisit(Integer petId, Visit visit) {
    Assert.notNull(petId, "Pet identifier must not be null!");
    Assert.notNull(visit, "Visit must not be null!");
    Pet pet = getPet(petId);
    Assert.notNull(pet, "Invalid Pet identifier!");
    pet.addVisit(visit);
}
```
