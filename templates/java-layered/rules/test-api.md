---
paths:
  - "src/test/java/template/api/**/*"
---

# test/api

## 책임
컨트롤러의 HTTP 요청/응답 로직을 단위 테스트(Mockito)와 통합 테스트(REST Assured)로 검증한다.

## 연관관계
```
test/api (단위 테스트) -> api (Controller) [서비스 Mock]
test/api (통합 테스트) -> AbstractIntegrationTest -> 실제 서버
```

---

## Naming
- 단위 테스트: `{ControllerName}Test`
- 통합 테스트: `{ControllerName}IntegrationTest extends AbstractIntegrationTest`

## Constraints

### 1. 통합 테스트 - AbstractIntegrationTest 상속 + REST Assured
```java
class ItemsControllerIntegrationTest extends AbstractIntegrationTest {
    private final ObjectWriter objectWriter = new ObjectMapper().writer();

    @Test
    void shouldGetItem() throws JsonProcessingException {
        when().get("/items/1").then().statusCode(200)
            .body(equalTo(objectWriter.writeValueAsString(
                new ItemDTO().id(1L).name("Item A"))));
    }
}
```

### 2. 통합 테스트 - 부정 케이스는 상태코드 + emptyString()
```java
@Test
void shouldNotFindItem() {
    when().get("/items/4").then().statusCode(404).body(emptyString());
}
```

### 3. 단위 테스트 - 서비스 Mock + 컨트롤러 직접 생성
```java
@Test
void shouldGetItem() {
    var item = new ItemDTO().id(1L).name("Item A");
    var service = mock(ItemsService.class);
    when(service.getItem(1L)).thenReturn(Optional.of(item));
    var controller = new ItemsController(service);
    var response = controller.getItem(1L);
    assertEquals(item, response.getBody());
}
```

### 4. 단위 테스트 - HTTP 상태 코드 검증
```java
// import static org.springframework.http.HttpStatus.BAD_REQUEST;
assertEquals(BAD_REQUEST, response.getStatusCode());
```

### 5. 단위 테스트 - 서비스 호출 검증
```java
verify(service).postItem(item);                     // 호출됨
verify(service, never()).postItem(any());            // 호출 안됨
```
