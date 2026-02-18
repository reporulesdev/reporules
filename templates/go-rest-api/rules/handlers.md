---
paths:
  - "go-rest-api-example/internal/handlers/**/*"
---

# handlers

## 책임
HTTP 요청을 파싱·검증하고, db 레이어를 호출한 뒤 external 모델로 변환하여 응답을 반환한다.

## 연관관계
```
gin.Context → Handler.Method → db.DataService → data.Model
                    ↓
            external.Model → c.JSON / abortWithAPIError
```

---

## Naming

- 파일: `{domain}Handler.go`, 타입: `{Domain}Handler`
- 생성자: `New{Domain}Handler(lgr, svc) (*Handler, error)`
- 메서드: `Create`, `GetAll`, `GetByID`, `DeleteByID` (모두 `*gin.Context` 단일 파라미터)

## Constraints

### 1. 생성자에서 nil 의존성 즉시 거부

```go
func NewOrdersHandler(lgr logger.Logger, dSvc db.OrdersDataService) (*OrdersHandler, error) {
    if lgr == nil || dSvc == nil {
        return nil, errors.New("missing required parameters to create orders handler")
    }
    return &OrdersHandler{oDataSvc: dSvc, logger: lgr}, nil
}
```

### 2. 에러 응답은 `abortWithAPIError` 헬퍼로 통일

```go
func (o *OrdersHandler) abortWithAPIError(c *gin.Context, lgr logger.Logger,
    status int, errorCode, message, debugID string, err error) {
    apiErr := &external.APIError{HTTPStatusCode: status, ErrorCode: errorCode,
        Message: message, DebugID: debugID}
    event := lgr.Error().Int("HttpStatusCode", status).Str("ErrorCode", errorCode)
    if err != nil { event = event.Err(err) }
    event.Msg(message)
    c.AbortWithStatusJSON(status, apiErr)
}
```

### 3. GetAll: `limit` 쿼리 파라미터 검증 (1 ~ MaxPageSize=100)

```go
const (OrderIDPath = "id"; MaxPageSize = 100)

if val < 1 || val > MaxPageSize {
    return 0, &external.APIError{HTTPStatusCode: http.StatusBadRequest,
        Message: fmt.Sprintf("Integer value within 1 and %d is expected", MaxPageSize)}
}
```

### 4. GetByID / DeleteByID: ID 파라미터 검증

```go
oID, err := primitive.ObjectIDFromHex(c.Param(OrderIDPath))
if err != nil || oID.IsZero() {
    o.abortWithAPIError(c, lgr, http.StatusBadRequest, errors.OrderGetInvalidParams,
        "invalid order ID", requestID, err)
    return
}
```

### 5. 내부 → 외부 모델 변환: ID는 `.Hex()`, 시간은 `utilities.FormatTimeToISO`

```go
extOrder := external.Order{
    ID:        order.ID.Hex(),
    CreatedAt: utilities.FormatTimeToISO(order.CreatedAt),
    Products:  order.Products,
}
c.JSON(http.StatusCreated, extOrder)
```

### 6. StatusHandler.CheckStatus: DB 실패 여부 무관 항상 HTTP 200

```go
func (s *StatusHandler) CheckStatus(c *gin.Context) {
    if err := s.dbMgr.Ping(); err != nil { s.lgr.Error().Msg("failed to ping DB") }
    c.Status(http.StatusOK)
}
```

### 7. 테스트 패턴

- `TestMain`에서 `gin.SetMode(gin.TestMode)` + 공통 로거 초기화
- `setupTestContext()` 헬퍼로 `(*gin.Context, *gin.Engine, *httptest.ResponseRecorder)` 반환
- 의존성 주입: `&mocks.MockOrdersDataService{CreateFunc: tt.mockCreateFunc}`
- 각 테스트에 `t.Parallel()` 호출
