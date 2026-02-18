---
paths:
  - "src/test/java/template/util/**/*"
---

# test/util

## 책임
테스트에서 반복 사용하는 더미 데이터를 static 팩토리 메서드로 제공한다.

## 연관관계
```
test/util (TestItems) -> test/service, test/api (더미 데이터 공급)
```

---

## Naming
- 유틸 클래스: `Test{복수형명사}` (예: `TestItems`)
- 메서드: `createTest{Type}{Plural}` (예: `createTestItemDTOs`, `createTestItems`, `createTestItemEntities`)

## Constraints

### 1. public class + public static 팩토리 메서드
```java
public class TestItems {
    public static List<ItemDTO> createTestItemDTOs() {
        return List.of(
            new ItemDTO().id(1L).name("Item A"),
            new ItemDTO().id(2L).name("Item B"),
            new ItemDTO().id(3L).name("Item C")
        );
    }

    public static List<Item> createTestItems() {
        return List.of(
            Item.builder().id(1L).name("Item A").build(),
            Item.builder().id(2L).name("Item B").build(),
            Item.builder().id(3L).name("Item C").build()
        );
    }

    public static List<ItemEntity> createTestItemEntities() {
        return List.of(
            ItemEntity.builder().id(1L).name("Item A").build(),
            ItemEntity.builder().id(2L).name("Item B").build(),
            ItemEntity.builder().id(3L).name("Item C").build()
        );
    }
}
```

### 2. 핵심 규칙
- 인스턴스 생성 없이 사용 (`static` 메서드만)
- DTO/도메인/엔티티 간 동일 인덱스는 같은 `id`, `name` 사용 (데이터 일관성)
- 컬렉션 반환 시 `List.of(...)` 사용 (불변 리스트)
