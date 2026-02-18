---
paths:
  - "src/main/java/template/service/**/*"
---

# service

## 책임
비즈니스 로직을 처리하고 DTO/도메인/엔티티 간 변환을 담당한다.

## 연관관계
```
api (Controller) -> service (Service) -> repository (Repository)
                         |
                    exception (예외 발생)
```

---

## Naming
- 서비스 클래스: 복수형 도메인명 + `Service` (예: `ItemsService`)
- 도메인 모델: 단수형 (예: `Item`)

## Constraints

### 1. 서비스 클래스 구성
```java
@Service
@AllArgsConstructor
public class ItemsService {
    private final ItemsRepository repository;
    private final ModelMapper mapper;
}
```

### 2. 도메인 모델
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Item {
    private Long id;
    private String name;
}
```

### 3. 변환 메서드는 `@VisibleForTesting`
```java
@VisibleForTesting
ItemDTO toDTO(Item item) { return mapper.map(item, ItemDTO.class); }

@VisibleForTesting
Item toDomainObject(ItemDTO dto) { return mapper.map(dto, Item.class); }

@VisibleForTesting
Item toDomainObject(ItemEntity entity) { return mapper.map(entity, Item.class); }

@VisibleForTesting
ItemEntity toEntity(Item item) { return mapper.map(item, ItemEntity.class); }
```

### 4. 신규 생성 시 id가 이미 세팅된 경우 예외 발생
```java
public void postItem(ItemDTO dto) {
    var item = toDomainObject(dto);
    if (item.getId() != null) throw new ItemIdAlreadySetException(item.getId());
    var entity = toEntity(item);
    entity.setId(repository.findMaxID() + 1);
    repository.save(entity);
}
```
