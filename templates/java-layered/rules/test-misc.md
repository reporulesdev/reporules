---
paths:
  - "src/test/java/template/misc/**/*"
---

# test/misc

## 책임
Actuator, OpenAPI, Swagger 등 인프라/미들웨어 엔드포인트를 통합 테스트로 검증한다.

## 연관관계
```
test/misc -> AbstractIntegrationTest -> 실제 서버 (인프라 엔드포인트 검증)
```

---

## Naming
- 테스트 클래스: `{Feature}IntegrationTest`
  - 예: `ActuatorIntegrationTest`, `OpenApiIntegrationTest`, `SwaggerIntegrationTest`

## Constraints

### 1. AbstractIntegrationTest 상속
```java
package template.misc;

class ActuatorIntegrationTest extends AbstractIntegrationTest {}
class OpenApiIntegrationTest extends AbstractIntegrationTest {}
class SwaggerIntegrationTest extends AbstractIntegrationTest {}
```

### 2. REST Assured로 인프라 엔드포인트 검증
```java
// import static io.restassured.RestAssured.when;
// import static org.hamcrest.Matchers.containsString;

@Test
void shouldReturnResponseFromActuatorEndpoint() {
    when().get("/actuator").then().statusCode(200)
        .body(containsString("/actuator/health"));
}

@Test
void shouldReturnResponseFromOpenApiEndpoint() {
    when().get("/api-docs").then().statusCode(200);
}

@Test
void shouldReturnResponseFromSwaggerEndpoint() {
    when().get("/swagger-ui/index.html").then().statusCode(200);
}
```

### 3. 핵심 규칙
- JUnit 5 `@Test` 사용, 메서드명은 `should...` 서술형
- `when().get(...).then().statusCode(...)` 체이닝 패턴
- 본문 검증이 필요한 경우 `.body(containsString(...))`
