---
paths:
  - "model/**/*"
---

# model Guide

## 책임
도메인 엔티티·값 객체·예외를 정의하는 순수 도메인 계층으로, 외부 프레임워크에 의존하지 않는다.

## 연관관계
```
model (도메인 규칙/상태)
  <- application (도메인 객체를 조합·조작)
  <- adapter (도메인 객체를 REST/JPA 형식으로 변환)
  <- bootstrap (전체 조립)
```
model은 다른 어떤 구획에도 의존하지 않는다.

---

## 패턴 & 예제

### 도메인 엔티티 (상태 + 비즈니스 로직)
```java
@Accessors(fluent = true) @RequiredArgsConstructor
public class Cart {
  @Getter private final CustomerId id;
  private final Map<ProductId, CartLineItem> lineItems = new LinkedHashMap<>();

  public void addProduct(Product product, int quantity)
      throws NotEnoughItemsInStockException { ... }

  public List<CartLineItem> lineItems() { return List.copyOf(lineItems.values()); }
  public Money subTotal() { ... }
}
```

### 값 객체 – ID (Java record + 유효성 검증)
```java
public record CustomerId(int value) {
  public CustomerId {
    if (value < 1) throw new IllegalArgumentException("'value' must be a positive integer");
  }
}
```

### 값 객체 – 복합 값 (불변 + 연산)
```java
public record Money(Currency currency, BigDecimal amount) {
  public static Money of(Currency currency, int major, int minor) { ... }
  public Money multiply(int multiplicand) { ... }
  public Money add(Money augend) { ... }  // 통화 일치 검증 포함
}
```

### 도메인 예외 (체크 예외 + 추가 정보)
```java
public class NotEnoughItemsInStockException extends Exception {
  private final int itemsInStock;
  public int itemsInStock() { return itemsInStock; }
}
```

---

## 네이밍 규칙

| 종류 | 패턴 | 예시 |
|------|------|------|
| 패키지 | `eu.happycoders.shop.model.{domain}` | `model.cart` |
| 엔티티 | PascalCase 명사 | `Cart`, `Product` |
| 값 객체 | PascalCase 명사 | `CustomerId`, `Money` |
| 예외 | `*Exception` | `NotEnoughItemsInStockException` |
| 테스트 | `*Test` | `CartTest` |
| 테스트 팩토리 | `Test*Factory` | `TestProductFactory` |

## 핵심 규칙
- 엔티티의 컬렉션은 내부 관리, `List.copyOf()`로 읽기 전용 뷰 반환
- ID 값 객체는 record + compact constructor에서 유효성 검증
- Lombok `@Accessors(fluent = true)` 사용 → getter에 `get` 접두사 없음
- 테스트 팩토리(`Test*Factory`)로 반복 객체 생성을 캡슐화
