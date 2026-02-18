# Skill: 단위/통합 테스트 추가

## 서비스 단위 테스트

파일: `src/test/java/template/service/ItemsServiceTest.java`

```java
class ItemsServiceTest {
    @Test
    void shouldGetItem() {
        //given entity
        var entity = ItemEntity.builder().id(1L).name("Item A").build();
        //and repository
        var repository = mock(ItemsRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        //and service
        var service = new ItemsService(repository, new ModelMapper());
        //when + then
        var result = service.getItem(1L);
        assertTrue(result.isPresent());
        assertEquals("Item A", result.get().getName());
        verify(repository).findById(1L);
    }

    @Test
    void shouldNotCreateItemWhenIdAlreadySet() {
        var dto = new ItemDTO().id(1L).name("Item A");
        var repository = mock(ItemsRepository.class);
        var service = new ItemsService(repository, new ModelMapper());
        var ex = assertThrows(ItemIdAlreadySetException.class, () -> service.postItem(dto));
        assertEquals(ItemIdAlreadySetException.MESSAGE.formatted(1L), ex.getMessage());
        verify(repository, never()).save(any());
    }
}
```

규칙: AssertJ 금지 / JUnit Assertions만 사용 / `new ModelMapper()` 직접 생성 / `//given`, `//when`, `//then`, `//and` 주석 구조

---

## 컨트롤러 단위 테스트

파일: `src/test/java/template/api/ItemsControllerTest.java`

```java
class ItemsControllerTest {
    @Test
    void shouldGetItem() {
        var item = new ItemDTO().id(1L).name("Item A");
        var service = mock(ItemsService.class);
        when(service.getItem(1L)).thenReturn(Optional.of(item));
        var controller = new ItemsController(service);
        var response = controller.getItem(1L);
        assertEquals(OK, response.getStatusCode());
        assertEquals(item, response.getBody());
    }

    @Test
    void shouldNotAcceptPostWhenItemHasId() {
        var item = new ItemDTO().id(1L).name("Item A");
        var service = mock(ItemsService.class);
        var controller = new ItemsController(service);
        var response = controller.postItem(item);
        assertEquals(BAD_REQUEST, response.getStatusCode());
        verify(service, never()).postItem(any());
    }
}
```

---

## 컨트롤러 통합 테스트

파일: `src/test/java/template/api/ItemsControllerIntegrationTest.java`

```java
class ItemsControllerIntegrationTest extends AbstractIntegrationTest {
    private final ObjectWriter objectWriter = new ObjectMapper().writer();

    @Test
    void shouldGetItem() throws JsonProcessingException {
        when().get("/items/1").then().statusCode(200)
            .body(equalTo(objectWriter.writeValueAsString(new ItemDTO().id(1L).name("Item A"))));
    }

    @Test
    void shouldNotFindItem() {
        when().get("/items/999").then().statusCode(404).body(emptyString());
    }

    @Test
    void shouldCreateItem() throws JsonProcessingException {
        given().contentType("application/json")
            .body(objectWriter.writeValueAsString(new ItemDTO().name("Item D")))
            .when().post("/items").then().statusCode(200);
    }
}
```

규칙: `extends AbstractIntegrationTest` 필수 / REST Assured 정적 임포트 `given`, `when` / 부정 케이스 `.body(emptyString())`
