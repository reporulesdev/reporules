# skill: add-rest-endpoint

기존 도메인에 새 REST 엔드포인트(UseCase)를 추가하는 단계별 가이드.
예시: `cart` 도메인에 "장바구니 비우기(EmptyCart)" 추가.

---

## Step 1. application - UseCase 인터페이스

`application/port/in/cart/EmptyCartUseCase.java`
```java
public interface EmptyCartUseCase {
  void emptyCart(CustomerId customerId);
}
```

---

## Step 2. application - Service 구현체

`application/service/cart/EmptyCartService.java`
```java
public class EmptyCartService implements EmptyCartUseCase {
  private final CartRepository cartRepository;
  public EmptyCartService(CartRepository cartRepository) { this.cartRepository = cartRepository; }
  @Override
  public void emptyCart(CustomerId customerId) { cartRepository.deleteByCustomerId(customerId); }
}
```

---

## Step 3. adapter - Controller

`adapter/in/rest/cart/EmptyCartController.java`
```java
@Path("/carts") @Produces(MediaType.APPLICATION_JSON)
public class EmptyCartController {
  private final EmptyCartUseCase emptyCartUseCase;
  public EmptyCartController(EmptyCartUseCase emptyCartUseCase) { this.emptyCartUseCase = emptyCartUseCase; }

  @DELETE @Path("/{customerId}")
  public void emptyCart(@PathParam("customerId") String customerIdString) {
    CustomerId customerId = parseCustomerId(customerIdString);
    emptyCartUseCase.emptyCart(customerId);
  }
}
```
WebModel은 응답 바디가 필요한 경우에만 추가. 삭제 작업은 생략 가능.

---

## Step 4. bootstrap - 컨트롤러 등록

`RestEasyUndertowShopApplication.getSingletons()`:
```java
return Set.of(
    addToCartController(), getCartController(),
    emptyCartController(),   // 추가
    findProductsController()
);

private EmptyCartController emptyCartController() {
  return new EmptyCartController(new EmptyCartService(cartRepository));
}
```

---

## Step 5. (선택) Repository 포트에 메서드 추가

기존 Repository에 메서드가 없으면 포트 + 모든 구현체에 추가:
```java
// CartRepository.java (port/out)
void deleteByCustomerId(CustomerId customerId);

// InMemoryCartRepository.java
@Override
public void deleteByCustomerId(CustomerId customerId) { carts.remove(customerId); }

// JpaCartRepository.java
@Override
public void deleteByCustomerId(CustomerId customerId) {
  try (EntityManager em = entityManagerFactory.createEntityManager()) {
    em.getTransaction().begin();
    CartJpaEntity entity = em.find(CartJpaEntity.class, customerId.value());
    if (entity != null) em.remove(entity);
    em.getTransaction().commit();
  }
}
```

## 체크리스트
- [ ] port/in: `{Action}{Domain}UseCase` 인터페이스 추가
- [ ] service: `{Action}{Domain}Service` 구현체 추가
- [ ] adapter/in/rest: `{Action}{Domain}Controller` 추가
- [ ] bootstrap: `getSingletons()`에 새 컨트롤러 등록
- [ ] (필요 시) Repository 포트 + 구현체에 메서드 추가 / ArchUnit `DependencyRuleTest` 통과 확인
