---
paths:
  - "go-rest-api-example/internal/models/**/*"
---

# models

## 책임
MongoDB 저장용 내부 도메인 모델(`data`)과 HTTP API 노출용 외부 모델(`external`)을 분리하여 정의한다.

## 연관관계
```
HTTP Request → external.XXXInput (binding 검증)
                    ↓ (handler에서 변환)
              data.XXX (bson+json 태그) → MongoDB
                    ↓ (handler에서 변환)
              external.XXX (string ID/시간) → HTTP Response
```

---

## data 패키지 (`internal/models/data`)

- MongoDB `_id`: `primitive.ObjectID` + `bson:"_id,omitempty"` + `json:"orderId"`
- 모든 필드에 `json`/`bson` 태그 모두 지정 (필드명 camelCase)
- 시간 필드: `time.Time`
- 상태값: `string` 기반 타입 + 상수 집합

```go
type OrderStatus string
const (
    OrderPending    OrderStatus = "OrderPending"
    OrderProcessing OrderStatus = "OrderProcessing"
)

type Order struct {
    ID          primitive.ObjectID `bson:"_id,omitempty" json:"orderId"`
    Version     int64              `json:"version" bson:"version"`
    CreatedAt   time.Time          `json:"createdAt" bson:"createdAt"`
    Products    []Product          `json:"products" bson:"products"`
    Status      OrderStatus        `json:"status" bson:"status"`
    TotalAmount float64            `json:"totalAmount" bson:"totalAmount"`
}
```

## external 패키지 (`internal/models/external`)

- 요청 바디: `XXXInput` 이름, 필수 필드에 `binding:"required"`
- 응답: ID → `string`, 시간 → `string` (내부 타입과 다를 때)
- 공통 에러 응답: `APIError` 재사용

```go
type OrderInput struct {
    Products []ProductInput `json:"products" binding:"required"`
}
type ProductInput struct {
    Name     string  `json:"name" binding:"required"`
    Price    float64 `json:"price" binding:"required"`
    Quantity uint64  `json:"quantity" binding:"required"`
}

type APIError struct {
    HTTPStatusCode int    `json:"httpStatusCode"`
    Message        string `json:"message"`
    DebugID        string `json:"debugId"`
    ErrorCode      string `json:"errorCode"`
}

type Order struct {
    ID        string           `json:"orderId"`  // ObjectID.Hex()
    CreatedAt string           `json:"createdAt"` // FormatTimeToISO
    Products  []data.Product   `json:"products"`  // data 타입 재사용 가능
    Status    data.OrderStatus `json:"status"`
}
```

## 새 도메인 추가 규칙

1. 저장 모델 → `data/` (`bson`+`json` 태그, `primitive.ObjectID` ID)
2. 요청 모델 → `external/XXXInput` (`binding:"required"`)
3. 응답 모델 → `external/XXX` (ID/시간은 `string`)
4. 에러 응답은 `external.APIError` 재사용
