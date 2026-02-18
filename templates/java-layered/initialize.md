# Java Layered Architecture - 초기화 가이드

## 폴더 트리 구조

```
src/
├── main/java/template/
│   ├── api/           # REST 컨트롤러 (ItemsController implements ItemsApi)
│   ├── service/       # 비즈니스 로직 + 도메인 모델 (ItemsService, Item)
│   ├── repository/    # JPA 엔티티 + Repository (ItemEntity, ItemsRepository)
│   ├── config/        # Spring Bean 설정 (TemplateConfig - ModelMapper Bean)
│   └── exception/     # 도메인 예외 (ItemIdAlreadySetException)
└── test/java/template/
    ├── api/           # 컨트롤러 단위(Mockito) + 통합(REST Assured) 테스트
    ├── service/       # 서비스 단위 테스트 (JUnit 5 + Mockito)
    ├── util/          # 테스트 더미 데이터 팩토리 (TestItems)
    └── misc/          # 인프라 통합 테스트 (Actuator, OpenAPI, Swagger)
```

## 새 도메인 추가 시 생성 순서

1. `exception/` - 도메인 예외 (`RuntimeException` 상속)
2. `repository/` - JPA 엔티티 + `JpaRepository` 인터페이스
3. `service/` - 도메인 모델 + `@Service` 클래스 + `ModelMapper` 변환 메서드
4. `api/` - `@RestController` 클래스 (API 인터페이스 구현)
5. `test/util/` - `TestXxx` 더미 데이터 팩토리
6. `test/service/` - 서비스 단위 테스트
7. `test/api/` - 컨트롤러 단위 + 통합 테스트

## 구획별 핵심 패턴

**repository/**
```java
@Entity @Data @Builder @NoArgsConstructor @AllArgsConstructor @Table(name = "item")
public class ItemEntity { @Id private Long id; private String name; }

@Repository
public interface ItemsRepository extends JpaRepository<ItemEntity, Long> {
    @Query("select max(item.id) from ItemEntity item") Long findMaxID();
}
```

**service/**
```java
@Service @AllArgsConstructor
public class ItemsService {
    private final ItemsRepository repository;
    private final ModelMapper mapper;
    public void postItem(ItemDTO dto) {
        var item = toDomainObject(dto);
        if (item.getId() != null) throw new ItemIdAlreadySetException(item.getId());
        var entity = toEntity(item);
        entity.setId(repository.findMaxID() + 1);
        repository.save(entity);
    }
}
```

**api/**
```java
@RestController @AllArgsConstructor
public class ItemsController implements ItemsApi {
    private final ItemsService service;
    @Override
    public ResponseEntity<ItemDTO> getItem(Long id) {
        return service.getItem(id).map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

**exception/**
```java
public final class ItemIdAlreadySetException extends RuntimeException {
    public static final String MESSAGE = "Item ID must be null. Received: %s.";
    public ItemIdAlreadySetException(Long id) { super(format(MESSAGE, id)); }
}
```

## rules/ 파일 목록

| 파일 | 경로 패턴 | 용도 |
|------|-----------|------|
| `rules/api.md` | `src/main/java/template/api/**` | 컨트롤러 패턴, HTTP 응답 매핑 |
| `rules/service.md` | `src/main/java/template/service/**` | 서비스/도메인, ModelMapper 변환 |
| `rules/repository.md` | `src/main/java/template/repository/**` | JPA 엔티티, Spring Data Repository |
| `rules/config.md` | `src/main/java/template/config/**` | Spring Bean 설정 |
| `rules/exception.md` | `src/main/java/template/exception/**` | 도메인 예외 클래스 |
| `rules/test-api.md` | `src/test/java/template/api/**` | 컨트롤러 단위/통합 테스트 |
| `rules/test-service.md` | `src/test/java/template/service/**` | 서비스 단위 테스트 |
| `rules/test-util.md` | `src/test/java/template/util/**` | 테스트 더미 데이터 팩토리 |
| `rules/test-misc.md` | `src/test/java/template/misc/**` | 인프라 통합 테스트 |

## skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `skills/add-domain.md` | 새 도메인 전체 계층 추가 (exception→repository→service→api→test) |
| `skills/add-crud-endpoint.md` | 기존 도메인에 CRUD 엔드포인트 추가 |
| `skills/add-test.md` | 단위/통합 테스트 패턴 참조 |
