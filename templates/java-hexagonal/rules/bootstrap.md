---
paths:
  - "bootstrap/**/*"
---

# bootstrap Guide

## 책임
Undertow 서버 기동, 수동 DI 조립(컨트롤러·Repository 인스턴스 생성), persistence 전략 선택, ArchUnit 의존성 규칙 검증을 담당한다.

## 연관관계
```
Launcher  -->  UndertowJaxrsServer  -->  RestEasyUndertowShopApplication
RestEasyUndertowShopApplication  -->  adapter (Controller, Repository 인스턴스 생성)
                                  -->  application (Service, UseCase 인스턴스 생성)
DependencyRuleTest (ArchUnit)  -->  전체 패키지 의존성 검증
```

---

## 패턴 & 예제

### 1. 서버 진입점 (Launcher)
```java
public class Launcher {
  private static final int PORT = 8080;
  private UndertowJaxrsServer server;

  public static void main(String[] args) { new Launcher().startOnPort(PORT); }

  public void startOnPort(int port) {
    server = new UndertowJaxrsServer().setPort(port);
    server.start();
    server.deploy(RestEasyUndertowShopApplication.class);
  }
  public void stop() { server.stop(); }
}
```

### 2. 수동 DI 조립 (RestEasyUndertowShopApplication)
```java
public class RestEasyUndertowShopApplication extends Application {
  private CartRepository cartRepository;
  private ProductRepository productRepository;

  @Override
  public Set<Object> getSingletons() {
    initPersistenceAdapters();
    return Set.of(addToCartController(), getCartController(),
                  emptyCartController(), findProductsController());
  }

  private void initPersistenceAdapters() {
    String persistence = System.getProperty("persistence", "inmemory");
    switch (persistence) {
      case "inmemory" -> initInMemoryAdapters();
      case "mysql"    -> initMySqlAdapters();
      default -> throw new IllegalArgumentException("Invalid 'persistence' property: '%s'".formatted(persistence));
    }
  }
}
```
- 새 컨트롤러 추가 시 `getSingletons()` 반환 목록에 직접 등록

### 3. 의존성 규칙 (ArchUnit)
```java
// 금지된 의존 방향:
// model     -> application, adapter, bootstrap
// application -> adapter, bootstrap
// application.port -> application.service
// adapter   -> application.service, bootstrap
```

### 4. E2E 테스트 기반 클래스
```java
abstract class EndToEndTest {
  @BeforeAll static void init() { launcher = new Launcher(); launcher.startOnPort(TEST_PORT); }
  @AfterAll  static void stop() { launcher.stop(); }
}
// 개별 E2E 테스트는 EndToEndTest 상속, 서버 직접 시작/종료 금지
```

---

## 핵심 규칙
- `Launcher`와 `RestEasyUndertowShopApplication`의 시그니처 변경 금지
- persistence 전략은 시스템 프로퍼티 `-Dpersistence=inmemory|mysql`로만 분기
- 모든 E2E 테스트는 반드시 `EndToEndTest` 상속
- ArchUnit `DependencyRuleTest`가 항상 통과하는지 확인 후 PR 제출
