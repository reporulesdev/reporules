---
paths:
  - "src/test/java/template/service/**/*"
---

# test/service

## 책임
서비스 계층의 비즈니스 로직과 예외 처리를 JUnit 5 + Mockito로 단위 검증한다.

## 연관관계
```
test/service -> service (Service) [repository Mock]
test/service -> test/util (TestItems - 더미 데이터)
```

---

## Naming
- 테스트 클래스: `{대상클래스명}Test` (예: `ItemsServiceTest`)
- 메서드명: `should{동작}` 서술형 (예: `shouldGetItem`)

## Constraints

### 1. JUnit 5 + Mockito 조합
```java
class ItemsServiceTest {
    @Test
    void shouldGetItem() {
        //given entity
        var entity = ItemEntity.builder().id(1L).name("Item A").build();
        //and repository
        var repository = mock(ItemsRepository.class);
        //and service
        var service = new ItemsService(repository, new ModelMapper());
        //when item is requested
        var result = service.getItem(entity.getId());
        //then expected item is returned
        assertEquals(Optional.of(service.toDTO(service.toDomainObject(entity))), result);
        //and repository was queried
        verify(repository).findById(entity.getId());
    }
}
```

### 2. 예외 검증 - 타입 + 메시지 모두 확인
```java
@Test
void shouldNotCreateItem() {
    var dto = new ItemDTO().name("Item A").id(1L);
    var repository = mock(ItemsRepository.class);
    var service = new ItemsService(repository, new ModelMapper());
    var ex = assertThrows(ItemIdAlreadySetException.class, () -> service.postItem(dto));
    assertEquals(ItemIdAlreadySetException.MESSAGE.formatted(1L), ex.getMessage());
    verify(repository, never()).save(any());
}
```

### 3. 핵심 규칙 요약
- AssertJ 사용 금지, JUnit 기본 Assertions만 사용 (`assertEquals`, `assertTrue`, `assertThrows`)
- `ModelMapper`는 `new ModelMapper()`로 직접 생성
- Given/When/Then 주석 스타일 (`//given`, `//when`, `//then`, `//and`) 사용
- 의존성 Mock은 `mock(Class.class)`, 동작 정의는 `when(...).thenReturn(...)`
