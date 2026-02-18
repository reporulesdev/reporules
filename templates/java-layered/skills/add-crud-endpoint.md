# Skill: 기존 도메인에 CRUD 엔드포인트 추가

이미 엔티티/서비스/컨트롤러가 존재하는 상황에서 새 CRUD 메서드를 추가합니다.

---

## 전제 조건
`ItemEntity`, `ItemsRepository`, `Item`, `ItemsService`, `ItemsController` 존재

---

## Step 1. service/ - 비즈니스 로직 메서드 추가

`ItemsService.java` 기존 파일 수정:

```java
// 목록 조회
public List<ItemDTO> getItems() {
    return repository.findAll().stream()
        .map(this::toDomainObject).map(this::toDTO).toList();
}

// 단건 조회
public Optional<ItemDTO> getItem(Long id) {
    return repository.findById(id).map(this::toDomainObject).map(this::toDTO);
}

// 수정
public void putItem(Long id, ItemDTO dto) {
    repository.save(toEntity(toDomainObject(dto)));
}

// 삭제
public void deleteItem(Long id) {
    repository.deleteById(id);
}
```

---

## Step 2. api/ - Controller 메서드 구현 추가

`ItemsController.java` 기존 파일 수정:

```java
@Override
public ResponseEntity<List<ItemDTO>> getItems() {
    return ResponseEntity.ok(service.getItems().stream().toList());
}

@Override
public ResponseEntity<ItemDTO> getItem(Long id) {
    return service.getItem(id).map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}

@Override
public ResponseEntity<Void> putItem(Long itemId, ItemDTO dto) {
    if (dto.getId() == null || !Objects.equals(itemId, dto.getId()))
        return ResponseEntity.badRequest().build();
    service.putItem(itemId, dto);
    return ResponseEntity.ok().build();
}

@Override
public ResponseEntity<Void> deleteItem(Long id) {
    if (service.getItem(id).isEmpty()) return ResponseEntity.notFound().build();
    service.deleteItem(id);
    return ResponseEntity.ok().build();
}
```

---

## Step 3. 테스트 추가

서비스 단위 테스트 패턴: `rules/test-service.md`
- `mock(ItemsRepository.class)` + `new ModelMapper()` + `new ItemsService(...)`
- `//given`, `//when`, `//then` 주석 구조

컨트롤러 단위/통합 테스트 패턴: `rules/test-api.md`
- 단위: `mock(ItemsService.class)` + `new ItemsController(service)` + `assertEquals(상태코드, response.getStatusCode())`
- 통합: `extends AbstractIntegrationTest` + REST Assured `when().get(...).then().statusCode(...)`
