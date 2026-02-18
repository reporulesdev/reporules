---
paths:
  - "src/main/java/template/repository/**/*"
---

# repository

## 책임
JPA 엔티티를 정의하고 Spring Data JPA를 통해 데이터베이스에 접근한다.

## 연관관계
```
service (Service) -> repository (Repository) -> DB
```

---

## Naming
- 엔티티 클래스: `*Entity` 접미사 (예: `ItemEntity`)
- 리포지토리 인터페이스: 복수형 + `Repository` (예: `ItemsRepository`)

## Constraints

### 1. JPA 엔티티
```java
@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "item")
public class ItemEntity {
    @Id
    private Long id;
    private String name;
}
```

### 2. Spring Data JPA 리포지토리
```java
@Repository
public interface ItemsRepository extends JpaRepository<ItemEntity, Long> {
    @Query("select max(item.id) from ItemEntity item")
    Long findMaxID();
}
```

- `JpaRepository<엔티티클래스, ID타입>` 상속
- `@Repository` 애노테이션 필수
- 커스텀 쿼리는 `@Query` JPQL 사용
