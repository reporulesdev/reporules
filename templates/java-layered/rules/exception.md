---
paths:
  - "src/main/java/template/exception/**/*"
---

# exception

## 책임
도메인 비즈니스 규칙 위반 시 발생시키는 예외 클래스를 정의한다.

## 연관관계
```
service (예외 throw) -> exception (RuntimeException 구현체)
```

---

## Naming
- 예외 클래스: `{Domain}{Detail}Exception` (예: `ItemIdAlreadySetException`)

## Constraints

### 1. `RuntimeException` 상속 + MESSAGE 상수 + `String.format` 생성자
```java
public final class ItemIdAlreadySetException extends RuntimeException {
    public static final String MESSAGE =
        "Item ID must be null when creating a new item. "
        + "Expected null so the service can assign a new ID, but received: %s.";

    public ItemIdAlreadySetException(Long id) {
        super(format(MESSAGE, id));
    }
}
```

- 모든 예외 클래스는 `RuntimeException` 상속
- 메시지 템플릿은 `public static final String MESSAGE` 상수로 정의
- 생성자에서 `String.format` (정적 임포트 `format`) 사용
- 클래스는 `final`로 선언
