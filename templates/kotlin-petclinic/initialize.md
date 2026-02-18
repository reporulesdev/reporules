# kotlin-petclinic 초기화 가이드

## 폴더 트리

```
src/main/kotlin/org/springframework/samples/petclinic/
  model/          # 공통 JPA 기반 클래스 (BaseEntity, NamedEntity, Person)
  owner/          # Owner, Pet, PetType 도메인 + 컨트롤러 + 리포지토리 + 포맷터/검증기
  vet/            # Vet, Specialty 도메인 + 컨트롤러 + 리포지토리
  visit/          # Visit 도메인 + 리포지토리
  system/         # 시스템 설정(CacheConfig), 유틸 컨트롤러(WelcomeController, CrashController)
src/main/resources/
  templates/      # Thymeleaf HTML 뷰 (owners/, pets/, vets/, 등)
  db/             # 데이터베이스 스크립트
```

## 새 도메인/기능 추가 시 생성 순서

1. **model/** - 공통 기반 클래스 확인 (BaseEntity / NamedEntity / Person 중 상속 결정)
2. **{domain}/Domain.kt** - `@Entity`, `@Table`, 연관관계, 편의 메서드
3. **{domain}/DomainRepository.kt** - `Repository<Domain, Int>` 인터페이스
4. **{domain}/DomainController.kt** - `@Controller`, 생성자 주입, CRUD 엔드포인트
5. **templates/{domain}/** - Thymeleaf 뷰 파일

## 구획별 핵심 코드 스니펫

### model - 공통 상위 클래스
```kotlin
@MappedSuperclass
open class BaseEntity : Serializable {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    open var id: Int? = null
}
```

### owner - 컨트롤러 CRUD 패턴
```kotlin
@PostMapping("/owners/new")
fun processCreationForm(@Valid owner: Owner, result: BindingResult): String =
    if (result.hasErrors()) VIEWS_OWNER_CREATE_OR_UPDATE_FORM
    else { owners.save(owner); "redirect:/owners/" + owner.id }
```

### vet - 캐시 적용 리포지토리
```kotlin
interface VetRepository : Repository<Vet, Int> {
    @Transactional(readOnly = true)
    @Cacheable("vets")
    fun findAll(): Collection<Vet>
}
```

### visit - 엔티티 + 리포지토리
```kotlin
@Entity @Table(name = "visits")
class Visit : BaseEntity() {
    var date: LocalDate = LocalDate.now()
    var description: String? = null
    var petId: Int? = null
}
```

### system - 설정 클래스
```kotlin
@Configuration(proxyBeanMethods = false)
@EnableCaching
class CacheConfig {
    @Bean
    fun cacheManagerCustomizer(): JCacheManagerCustomizer = JCacheManagerCustomizer {
        it.createCache("vets", createCacheConfiguration())
    }
}
```

## rules/ 파일 목록

| 파일 | paths 적용 범위 | 용도 |
|------|----------------|------|
| `rules/model.md` | `model/**/*` | 공통 JPA 기반 클래스 작성 규칙 |
| `rules/owner.md` | `owner/**/*` | Owner/Pet/Visit 도메인·컨트롤러·리포지토리 규칙 |
| `rules/vet.md` | `vet/**/*` | Vet/Specialty 도메인·컨트롤러·리포지토리 규칙 |
| `rules/visit.md` | `visit/**/*` | Visit 도메인·리포지토리 규칙 |
| `rules/system.md` | `system/**/*` | 시스템 설정·유틸 컨트롤러 규칙 |

## skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `skills/add-owner-pet.md` | Owner 및 Pet 도메인 신규 추가 전체 흐름 |
| `skills/add-visit.md` | Pet에 Visit 추가 흐름 |
| `skills/add-vet-specialty.md` | Vet/Specialty 도메인 추가 흐름 |
