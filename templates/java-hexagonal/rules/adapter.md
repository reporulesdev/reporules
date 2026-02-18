---
paths:
  - "adapter/**/*"
---

# adapter Guide

## 책임
REST 진입점(in/rest)과 영속성 구현(out/persistence)을 담당하며, 도메인 모델과 외부 형식(HTTP JSON, JPA) 사이의 변환만 수행한다.

## 연관관계
```
HTTP 요청  -->  {Action}{Domain}Controller  -->  {Action}{Domain}UseCase (port/in 호출)
                       |
                  {Domain}WebModel (도메인 → JSON 변환)

{Domain}Repository (port/out)  <--  InMemory{Domain}Repository
                               <--  Jpa{Domain}Repository  -->  {Domain}JpaEntity
                                                            -->  {Domain}Mapper
```

---

## 패턴 & 예제

### 1. REST Controller
```java
// 패키지: eu.happycoders.shop.adapter.in.rest.{domain}
@Path("/carts")
@Produces(MediaType.APPLICATION_JSON)
public class AddToCartController {
  private final AddToCartUseCase addToCartUseCase;

  @POST @Path("/{customerId}/line-items")
  public CartWebModel addLineItem(
      @PathParam("customerId") String customerIdString,
      @QueryParam("productId") String productIdString,
      @QueryParam("quantity") int quantity) {
    CustomerId customerId = parseCustomerId(customerIdString);
    try {
      Cart cart = addToCartUseCase.addToCart(customerId, parseProductId(productIdString), quantity);
      return CartWebModel.fromDomainModel(cart);
    } catch (ProductNotFoundException e) {
      throw clientErrorException(Response.Status.BAD_REQUEST, "The requested product does not exist");
    }
  }
}
```

### 2. WebModel (REST 응답 전용)
```java
public record CartWebModel(List<CartLineItemWebModel> lineItems, int numberOfItems, Money subTotal) {
  static CartWebModel fromDomainModel(Cart cart) {
    return new CartWebModel(
        cart.lineItems().stream().map(CartLineItemWebModel::fromDomainModel).toList(),
        cart.numberOfItems(), cart.subTotal());
  }
}
```
- `record` + 정적 팩토리 `fromDomainModel()`로만 생성
- 도메인 모델 직접 노출 금지

### 3. InMemory Repository
```java
public class InMemoryCartRepository implements CartRepository {
  private final Map<CustomerId, Cart> carts = new ConcurrentHashMap<>();
  @Override public void save(Cart cart) { carts.put(cart.id(), cart); }
  @Override public Optional<Cart> findByCustomerId(CustomerId id) { return Optional.ofNullable(carts.get(id)); }
}
```

### 4. JPA Entity + Mapper
```java
@Entity @Table(name = "Cart") @Getter @Setter
public class CartJpaEntity {
  @Id private int customerId;
  @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<CartLineItemJpaEntity> lineItems;
}
// 도메인 로직 없음, DB 스키마 매핑만
// 변환은 {Domain}Mapper 클래스에 위임
```

---

## 핵심 규칙
- Controller는 `*UseCase` 포트만 의존, Repository 직접 접근 금지
- 잘못된 입력/도메인 예외는 `ControllerCommons.clientErrorException()`으로 처리
- Path/Query 파라미터 파싱은 `CustomerIdParser`, `ProductIdParser` 등 공통 파서 사용
- JPA Repository 각 메서드에서 `EntityManager` 생성, 쓰기 작업에 명시적 트랜잭션
- 새 JPA 엔티티 추가 시 `persistence.xml`의 `<class>` 목록에 등록 필수
- adapter 계층에서 `application.service`, `bootstrap` 패키지 import 금지
