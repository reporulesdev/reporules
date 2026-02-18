# java-hexagonal 초기화 가이드

## 폴더 트리 구조

```
hexagonal-architecture-java/
  model/src/main/java/eu/happycoders/shop/model/
    cart/         Cart.java, CartLineItem.java, NotEnoughItemsInStockException.java
    customer/     CustomerId.java
    money/        Money.java
    product/      Product.java, ProductId.java

  application/src/main/java/eu/happycoders/shop/application/
    port/in/{domain}/    {Action}{Domain}UseCase.java, {Domain}ApplicationException.java
    port/out/persistence/ {Domain}Repository.java
    service/{domain}/    {Action}{Domain}Service.java

  adapter/src/main/java/eu/happycoders/shop/adapter/
    in/rest/{domain}/    {Action}{Domain}Controller.java, {Domain}WebModel.java
    in/rest/common/      ControllerCommons.java, CustomerIdParser.java, ProductIdParser.java
    out/persistence/inmemory/  InMemory{Domain}Repository.java
    out/persistence/jpa/       {Domain}JpaEntity.java, Jpa{Domain}Repository.java, {Domain}Mapper.java

  bootstrap/src/main/java/eu/happycoders/shop/bootstrap/
    Launcher.java
    RestEasyUndertowShopApplication.java
```

## 새 도메인/기능 추가 시 생성 순서

1. **model** - 도메인 엔티티, 값 객체, 예외
2. **application/port/in** - UseCase 인터페이스, 애플리케이션 예외
3. **application/port/out/persistence** - Repository 인터페이스
4. **application/service** - UseCase 구현체 Service
5. **adapter/in/rest** - Controller, WebModel
6. **adapter/out/persistence** - InMemoryRepository, JpaEntity, Mapper, JpaRepository
7. **bootstrap** - `getSingletons()`에 새 컨트롤러 등록

## 구획별 핵심 예제

### model - 값 객체
```java
public record CustomerId(int value) {
  public CustomerId {
    if (value < 1) throw new IllegalArgumentException("'value' must be a positive integer");
  }
}
```

### application - UseCase 인터페이스
```java
public interface AddToCartUseCase {
  Cart addToCart(CustomerId customerId, ProductId productId, int quantity)
      throws ProductNotFoundException;
}
```

### adapter/in/rest - Controller
```java
@Path("/carts")
@Produces(MediaType.APPLICATION_JSON)
public class AddToCartController {
  private final AddToCartUseCase addToCartUseCase;
  @POST @Path("/{customerId}/line-items")
  public CartWebModel addLineItem(...) { ... }
}
```

### bootstrap - 빈 등록
```java
@Override
public Set<Object> getSingletons() {
  initPersistenceAdapters();
  return Set.of(addToCartController(), getCartController(), ...);
}
```

## rules/ 및 skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `rules/model.md` | 도메인 엔티티·값 객체·예외 작성 규칙 |
| `rules/application.md` | UseCase·Service·Repository 포트 규칙 |
| `rules/adapter.md` | REST 컨트롤러·WebModel·Persistence 어댑터 규칙 |
| `rules/bootstrap.md` | 서버 부트스트랩·DI 조립·의존성 규칙 테스트 |
| `skills/add-domain.md` | 새 도메인을 end-to-end로 추가하는 단계별 가이드 |
| `skills/add-rest-endpoint.md` | 기존 도메인에 REST 엔드포인트 추가 가이드 |
