# skill: add-domain

새로운 도메인(예: `wishlist`)을 end-to-end로 추가하는 단계별 가이드.
- `{domain}` = 소문자 패키지명, `{Domain}` = PascalCase 접두사

---

## Step 1. model - 도메인 엔티티

`model/.../model/{domain}/{Domain}.java` — `@Accessors(fluent = true)`, 컬렉션은 `List.copyOf()` 반환, 비즈니스 규칙 보유.
필요 시 `{Domain}Exception extends Exception` 추가 (checked, 도메인 정보 필드 포함).

---

## Step 2. application - 포트 및 서비스

**UseCase** (`port/in/{domain}/Add{Domain}UseCase.java`)
```java
public interface AddToWishlistUseCase {
  Wishlist addToWishlist(CustomerId customerId, ProductId productId)
      throws ProductNotFoundException;
}
```

**Repository** (`port/out/persistence/{Domain}Repository.java`)
```java
public interface WishlistRepository {
  void save(Wishlist wishlist);
  Optional<Wishlist> findByCustomerId(CustomerId customerId);
}
```

**Service** (`service/{domain}/Add{Domain}Service.java`)
```java
public class AddToWishlistService implements AddToWishlistUseCase {
  private final WishlistRepository wishlistRepository;
  private final ProductRepository productRepository;
  // 1. 상품 조회 (없으면 예외)  2. 위시리스트 조회 or 신규 생성
  // 3. addProduct()  4. save()
}
```

---

## Step 3. adapter - Controller·WebModel·InMemoryRepository

**WebModel** (`adapter/in/rest/{domain}/{Domain}WebModel.java`)
```java
public record WishlistWebModel(List<String> productIds) {
  static WishlistWebModel fromDomainModel(Wishlist w) {
    return new WishlistWebModel(w.products().stream().map(p -> p.id().value()).toList());
  }
}
```

**Controller** (`adapter/in/rest/{domain}/Add{Domain}Controller.java`)
```java
@Path("/wishlists") @Produces(MediaType.APPLICATION_JSON)
public class AddToWishlistController {
  private final AddToWishlistUseCase uc;
  @POST @Path("/{customerId}/items")
  public WishlistWebModel add(@PathParam("customerId") String cid,
                              @QueryParam("productId") String pid) {
    try { return WishlistWebModel.fromDomainModel(uc.addToWishlist(parseCustomerId(cid), parseProductId(pid))); }
    catch (ProductNotFoundException e) { throw clientErrorException(BAD_REQUEST, "Product not found"); }
  }
}
```

**InMemoryRepository** (`adapter/out/persistence/inmemory/InMemory{Domain}Repository.java`)
```java
public class InMemoryWishlistRepository implements WishlistRepository {
  private final Map<CustomerId, Wishlist> store = new ConcurrentHashMap<>();
  @Override public void save(Wishlist w) { store.put(w.id(), w); }
  @Override public Optional<Wishlist> findByCustomerId(CustomerId id) { return Optional.ofNullable(store.get(id)); }
}
```

---

## Step 4. bootstrap - 컨트롤러 등록

`RestEasyUndertowShopApplication.getSingletons()` 에 추가:
```java
return Set.of(..., addToWishlistController());

private AddToWishlistController addToWishlistController() {
  return new AddToWishlistController(new AddToWishlistService(wishlistRepository, productRepository));
}
```

## 체크리스트
- [ ] model: 도메인 엔티티 + 예외
- [ ] application: UseCase + Repository 포트 + Service
- [ ] adapter: WebModel + Controller + InMemoryRepository
- [ ] bootstrap: `getSingletons()`에 컨트롤러 등록
- [ ] ArchUnit `DependencyRuleTest` 통과 확인
