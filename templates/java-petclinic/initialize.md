# initialize

## 폴더 구조

```
src/main/java/.../petclinic/
  model/
    BaseEntity.java     # @MappedSuperclass, id, isNew()
    NamedEntity.java    # BaseEntity + name
    Person.java         # BaseEntity + firstName/lastName
  owner/
    Owner.java          # @Entity, Person 상속, pets 컬렉션
    Pet.java            # @Entity, NamedEntity 상속, visits 컬렉션
    PetType.java        # @Entity, NamedEntity 상속
    Visit.java          # @Entity, BaseEntity 상속
    OwnerRepository.java     # JpaRepository<Owner, Integer>
    PetTypeRepository.java   # JpaRepository<PetType, Integer>
    OwnerController.java     # /owners/** CRUD
    PetController.java       # /owners/{ownerId}/pets/**
    VisitController.java     # /owners/{ownerId}/pets/{petId}/visits/**
    PetTypeFormatter.java    # Formatter<PetType>
    PetValidator.java        # Validator for Pet
  vet/
    Specialty.java      # @Entity, NamedEntity 상속
    Vet.java            # @Entity, Person, specialties @ManyToMany
    Vets.java           # @XmlRootElement 래퍼
    VetRepository.java  # Repository<Vet, Integer> + @Cacheable
    VetController.java  # /vets HTML + JSON
  system/
    CacheConfiguration.java   # @EnableCaching
    WebConfiguration.java     # WebMvcConfigurer + Locale
    WelcomeController.java    # GET /
    CrashController.java      # GET /oups
```

## 새 도메인 추가 시 생성 순서

1. `model/` - 상속할 베이스 결정 (BaseEntity / NamedEntity / Person)
2. `{domain}/{Domain}.java` - `@Entity`, `@Table`, Bean Validation
3. `{domain}/{Domain}Repository.java` - `JpaRepository` 상속
4. `{domain}/{Domain}Controller.java` - `@Controller`, `@ModelAttribute`, 폼 처리
5. (선택) `{domain}/{Type}Formatter.java` - `Formatter<T>`, `@Component`
6. (선택) `{domain}/{Type}Validator.java` - `Validator` 구현

## 구획별 핵심 패턴 스니펫

### model - BaseEntity
```java
@MappedSuperclass
public class BaseEntity implements Serializable {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    public boolean isNew() { return this.id == null; }
}
```

### owner - 폼 처리 (검증 실패/성공 분기)
```java
@PostMapping("/owners/new")
public String processCreationForm(@Valid Owner owner, BindingResult result,
        RedirectAttributes redirectAttributes) {
    if (result.hasErrors()) return "owners/createOrUpdateOwnerForm";
    this.owners.save(owner);
    redirectAttributes.addFlashAttribute("message", "New Owner Created");
    return "redirect:/owners/" + owner.getId();
}
```

### vet - 캐시 + 페이징 Repository
```java
@Transactional(readOnly = true)
@Cacheable("vets")
Page<Vet> findAll(Pageable pageable) throws DataAccessException;
```

### system - 설정 클래스
```java
@Configuration(proxyBeanMethods = false)
@EnableCaching
class CacheConfiguration {
    @Bean
    JCacheManagerCustomizer petclinicCacheConfigurationCustomizer() {
        return cm -> cm.createCache("vets", cacheConfiguration());
    }
}
```

## rules/ 파일 목록

| 파일 | 경로 대상 | 용도 |
|------|-----------|------|
| `rules/model.md` | `model/**/*` | 공통 베이스 엔티티 규칙 |
| `rules/owner.md` | `owner/**/*` | Owner 도메인 전체 규칙 |
| `rules/system.md` | `system/**/*` | 인프라 설정 및 시스템 컨트롤러 |
| `rules/vet.md` | `vet/**/*` | Vet 도메인 규칙 (캐시, XML 래퍼) |

## skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `skills/add-owner.md` | Owner CRUD 흐름 |
| `skills/add-pet.md` | Pet + Visit 추가 흐름 |
| `skills/add-vet.md` | Vet 도메인 추가 흐름 |
