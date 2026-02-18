---
paths:
  - "src/main/java/template/api/**/*"
---

# api

## 책임
HTTP 요청을 받아 서비스를 호출하고 ResponseEntity로 결과를 반환한다.

## 연관관계
```
Client -> api (Controller) -> service (Service)
```

---

## Naming
- 컨트롤러 클래스: `{Domain}Controller` (예: `ItemsController`)
- API 스펙 인터페이스를 `implements`로 구현

## Constraints

### 1. 클래스 구성
```java
@RestController
@AllArgsConstructor
public class ItemsController implements ItemsApi {
    private final ItemsService service;
}
```

### 2. 단건 조회: Optional 기반 분기
```java
@Override
public ResponseEntity<ItemDTO> getItem(Long id) {
    return service.getItem(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
```

### 3. 컬렉션 조회
```java
@Override
public ResponseEntity<List<ItemDTO>> getItems() {
    return ResponseEntity.ok(service.getItems().stream().toList());
}
```

### 4. POST - id가 있으면 400
```java
@Override
public ResponseEntity<Void> postItem(ItemDTO itemDTO) {
    if (itemDTO.getId() != null) return ResponseEntity.badRequest().build();
    service.postItem(itemDTO);
    return ResponseEntity.ok().build();
}
```

### 5. PUT - path id와 body id 일치 검증
```java
@Override
public ResponseEntity<Void> putItem(Long itemId, ItemDTO itemDTO) {
    if (itemDTO.getId() == null || !Objects.equals(itemId, itemDTO.getId())) {
        return ResponseEntity.badRequest().build();
    }
    service.putItem(itemId, itemDTO);
    return ResponseEntity.ok().build();
}
```

### 6. DELETE - 존재 확인 후 삭제
```java
@Override
public ResponseEntity<Void> deleteItem(Long id) {
    if (service.getItem(id).isEmpty()) return ResponseEntity.notFound().build();
    service.deleteItem(id);
    return ResponseEntity.ok().build();
}
```
