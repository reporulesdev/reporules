# add-pet

기존 Owner 하위에 Pet과 Visit을 추가하는 흐름 (Formatter, Validator 포함).
참고 rules: `rules/owner.md`

---

## 1단계: Pet Entity (`owner/Pet.java`)

- `NamedEntity` 상속, `@Entity`, `@Table(name="pets")`
- `type`: `@ManyToOne`, `birthDate`: `@DateTimeFormat(pattern="yyyy-MM-dd")`
- visits 컬렉션: `@OneToMany` + `final LinkedHashSet`

```java
@Entity
@Table(name = "pets")
public class Pet extends NamedEntity {

    @ManyToOne
    @JoinColumn(name = "type_id")
    private PetType type;

    @Column(name = "birth_date")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate birthDate;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JoinColumn(name = "pet_id")
    private final Set<Visit> visits = new LinkedHashSet<>();
}
```

## 2단계: PetTypeFormatter (`owner/PetTypeFormatter.java`)

- `Formatter<PetType>` 구현, `@Component`
- `parse()`: 이름 불일치 시 `ParseException`

```java
@Component
public class PetTypeFormatter implements Formatter<PetType> {
    private final PetTypeRepository types;
    public PetTypeFormatter(PetTypeRepository types) { this.types = types; }

    @Override
    public String print(PetType petType, Locale locale) {
        return (petType.getName() != null) ? petType.getName() : "<null>";
    }
    @Override
    public PetType parse(String text, Locale locale) throws ParseException {
        for (PetType type : types.findPetTypes()) {
            if (Objects.equals(type.getName(), text)) return type;
        }
        throw new ParseException("type not found: " + text, 0);
    }
}
```

## 3단계: PetValidator (`owner/PetValidator.java`)

- `Validator` 구현, `supports`에서 타입 제한
- 상수 `REQUIRED` 에러 코드 사용

```java
public class PetValidator implements Validator {
    private static final String REQUIRED = "required";

    @Override
    public void validate(Object obj, Errors errors) {
        Pet pet = (Pet) obj;
        if (!StringUtils.hasText(pet.getName()))
            errors.rejectValue("name", REQUIRED, REQUIRED);
        if (pet.isNew() && pet.getType() == null)
            errors.rejectValue("type", REQUIRED, REQUIRED);
        if (pet.getBirthDate() == null)
            errors.rejectValue("birthDate", REQUIRED, REQUIRED);
    }
    @Override
    public boolean supports(Class<?> clazz) { return Pet.class.isAssignableFrom(clazz); }
}
```

## 4단계: PetController (`owner/PetController.java`)

- `@RequestMapping("/owners/{ownerId}")`, 패키지 프라이빗
- `@InitBinder("pet")` 에서 `PetValidator` 등록
- 중복 이름 체크 + 미래 날짜 체크 후 저장

```java
@Controller
@RequestMapping("/owners/{ownerId}")
class PetController {
    @InitBinder("pet")
    public void initPetBinder(WebDataBinder dataBinder) {
        dataBinder.setValidator(new PetValidator());
    }

    @PostMapping("/pets/new")
    public String processCreationForm(Owner owner, @Valid Pet pet, BindingResult result,
            RedirectAttributes redirectAttributes) {
        if (StringUtils.hasText(pet.getName()) && pet.isNew()
                && owner.getPet(pet.getName(), true) != null)
            result.rejectValue("name", "duplicate", "already exists");
        if (pet.getBirthDate() != null && pet.getBirthDate().isAfter(LocalDate.now()))
            result.rejectValue("birthDate", "typeMismatch.birthDate");
        if (result.hasErrors()) return "pets/createOrUpdatePetForm";
        owner.addPet(pet);
        this.owners.save(owner);
        redirectAttributes.addFlashAttribute("message", "New Pet has been Added");
        return "redirect:/owners/{ownerId}";
    }
}
```

## 5단계: VisitController (`owner/VisitController.java`)

- `@ModelAttribute("visit")` 에서 pet에 visit 연결 후 모델 세팅

```java
@ModelAttribute("visit")
public Visit loadPetWithVisit(@PathVariable int ownerId, @PathVariable int petId,
        Map<String, Object> model) {
    Owner owner = owners.findById(ownerId)
        .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));
    Pet pet = owner.getPet(petId);
    model.put("pet", pet);
    model.put("owner", owner);
    Visit visit = new Visit();
    pet.addVisit(visit);
    return visit;
}
```
