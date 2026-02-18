# Skill: 새 도메인 추가 (end-to-end)

새로운 도메인(예: `Order`)을 API부터 DB까지 전체 계층에 걸쳐 추가합니다.

---

## 생성 순서

### Step 1. exception/

```java
public final class OrderIdAlreadySetException extends RuntimeException {
    public static final String MESSAGE = "Order ID must be null. Received: %s.";
    public OrderIdAlreadySetException(Long id) { super(format(MESSAGE, id)); }
}
```

### Step 2. repository/

```java
@Entity @Data @Builder @NoArgsConstructor @AllArgsConstructor @Table(name = "orders")
public class OrderEntity { @Id private Long id; private String description; }

@Repository
public interface OrdersRepository extends JpaRepository<OrderEntity, Long> {
    @Query("select max(o.id) from OrderEntity o") Long findMaxID();
}
```

### Step 3. service/ - 도메인 모델 + Service

```java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Order { private Long id; private String description; }

@Service @AllArgsConstructor
public class OrdersService {
    private final OrdersRepository repository;
    private final ModelMapper mapper;

    public void postOrder(OrderDTO dto) {
        var order = toDomainObject(dto);
        if (order.getId() != null) throw new OrderIdAlreadySetException(order.getId());
        var entity = toEntity(order);
        entity.setId(repository.findMaxID() + 1);
        repository.save(entity);
    }

    @VisibleForTesting OrderDTO toDTO(Order o) { return mapper.map(o, OrderDTO.class); }
    @VisibleForTesting Order toDomainObject(OrderDTO d) { return mapper.map(d, Order.class); }
    @VisibleForTesting Order toDomainObject(OrderEntity e) { return mapper.map(e, Order.class); }
    @VisibleForTesting OrderEntity toEntity(Order o) { return mapper.map(o, OrderEntity.class); }
}
```

### Step 4. api/ - Controller

```java
@RestController @AllArgsConstructor
public class OrdersController implements OrdersApi {
    private final OrdersService service;

    @Override
    public ResponseEntity<OrderDTO> getOrder(Long id) {
        return service.getOrder(id).map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @Override
    public ResponseEntity<Void> postOrder(OrderDTO dto) {
        if (dto.getId() != null) return ResponseEntity.badRequest().build();
        service.postOrder(dto);
        return ResponseEntity.ok().build();
    }
}
```

### Step 5. test/util/ - 더미 데이터

```java
public class TestOrders {
    public static List<OrderDTO> createTestOrderDTOs() {
        return List.of(new OrderDTO().id(1L).description("Order A"));
    }
    public static List<OrderEntity> createTestOrderEntities() {
        return List.of(OrderEntity.builder().id(1L).description("Order A").build());
    }
}
```

### Step 6. test/ - 테스트 작성

- 서비스 단위 테스트: `rules/test-service.md` 참고
- 컨트롤러 단위/통합 테스트: `rules/test-api.md` 참고
