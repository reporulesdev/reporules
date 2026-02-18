---
paths:
  - "go-rest-api-example/internal/errors/**/*"
---

# errors

## 책임
HTTP API 응답에서 사용하는 도메인별 에러 코드 상수를 한 곳에 집중 관리한다.

## 연관관계
```
internal/errors (상수) → handlers.abortWithAPIError → external.APIError.ErrorCode → HTTP 응답
```

---

## Naming

- 상수 이름: `{Domain}{Action}{Detail}` (PascalCase)
  - 예: `OrderGetInvalidParams`, `OrderGetNotFound`, `OrderCreateServerError`
- 상수 값: `prefix + "action_detail"` (snake_case)
  - 예: `prefix + "get_invalid_params"`, `prefix + "create_server_error"`
- `prefix` 상수로 도메인 구분

## Constraints

### 공통 prefix + snake_case 조합으로 정의

```go
package errors

const prefix = "orders_"
const UnexpectedErrorMessage = "unexpected Error occurred, please try again later"

const (
    OrderGetInvalidParams  = prefix + "get_invalid_params"
    OrderGetNotFound       = prefix + "get_not_found"
    OrdersGetServerError   = prefix + "get_server_error"
    OrderCreateInvalidInput = prefix + "create_invalid_input"
    OrderCreateServerError  = prefix + "create_server_error"
    OrderDeleteInvalidID    = prefix + "delete_invalid_order_id"
    OrderDeleteNotFound     = prefix + "delete_not_found"
    OrderDeleteServerError  = prefix + "delete_server_error"
)
```

### 새 도메인 추가 시

1. 새 파일에 `prefix` 상수 정의 (예: `const prefix = "products_"`)
2. CRUD 작업별 상수 추가: `{Domain}{Create|Get|Update|Delete}{InvalidInput|NotFound|ServerError}`
3. `UnexpectedErrorMessage` 는 패키지 수준에서 공유 또는 도메인별 재정의
