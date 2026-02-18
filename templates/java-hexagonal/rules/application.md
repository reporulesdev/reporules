---
paths:
  - "application/**/*"
---

# application Guide

## 책임
유스케이스를 인터페이스(port/in)로 선언하고, Service(service/)로 구현하며, 영속성 포트(port/out)를 정의하는 애플리케이션 계층이다.

## 연관관계
```
adapter/in/rest  -->  port/in (UseCase 인터페이스 호출)
adapter/out/persistence  -->  port/out (Repository 인터페이스 구현)
service  -->  port/out (Repository 주입받아 사용)
service  -->  model (도메인 객체 조합)
port/in  -->  model (파라미터·반환 타입)
```

---

## 패턴 & 예제

### 1. UseCase 인터페이스 (port/in)
```java
// 패키지: eu.happycoders.shop.application.port.in.cart
public interface AddToCartUseCase {
  Cart addToCart(CustomerId customerId, ProductId productId, int quantity)
      throws ProductNotFoundException;
}
```
- 파라미터/반환 타입은 **도메인 모델만** 사용
- 호출자가 처리해야 할 비즈니스 예외만 `throws`에 선언

### 2. Service (use case 구현체)
```java
// 패키지: eu.happycoders.shop.application.service.cart
public class AddToCartService implements AddToCartUseCase {
  private final CartRepository cartRepository;
  private final ProductRepository productRepository;
  // 생성자 주입, 필드 final
  // 조회 → 도메인 조작 → 저장 흐름
}
```
- 인프라 세부사항(JPA, HTTP 등) 절대 포함 금지
- 입력 검증은 Service에서 수행 (UseCase 인터페이스에서는 선언만)

### 3. Repository 포트 (port/out/persistence)
```java
// 패키지: eu.happycoders.shop.application.port.out.persistence
public interface CartRepository {
  void save(Cart cart);
  Optional<Cart> findByCustomerId(CustomerId customerId);
}
```
- 메서드 시그니처에 도메인 모델 타입만 사용
- 존재하지 않을 수 있는 결과는 `Optional<T>`

### 4. 애플리케이션 예외 (port/in)
```java
// 패키지: eu.happycoders.shop.application.port.in.cart
public class ProductNotFoundException extends Exception { }
```
- checked exception으로 선언
- port/in/{domain} 패키지에 위치

---

## 디렉토리 구조
```
application/
  port/in/{domain}/
    {Action}{Domain}UseCase.java
    {Domain}ApplicationException.java
  port/out/persistence/
    {Domain}Repository.java
  service/{domain}/
    {Action}{Domain}Service.java
```

## 핵심 규칙
- Service는 반드시 대응하는 UseCase 인터페이스를 `implements`
- 이 계층에서 adapter, bootstrap 패키지 import 금지 (ArchUnit으로 검증됨)
- port 인터페이스는 port/in, port/out 으로 분리; port/in이 port/service를 import하면 안 됨
