---
paths:
  - "go-rest-api-example/internal/db/**/*"
---

# db

## 책임
MongoDB 컬렉션 접근을 캡슐화한 Repository 인터페이스와 구현을 제공하고, 테스트용 Mock을 함께 관리한다.

## 연관관계
```
handlers → db.OrdersDataService (interface)
               ↓
           db.OrdersRepo (impl) → mongodb.MongoDatabase → MongoDB
               ↓
           db/mocks/MockOrdersDataService (test용)
```

---

## Naming

- 파일: `{domain}Repo.go` (예: `ordersRepo.go`)
- 인터페이스: `{Domain}DataService` (예: `OrdersDataService`)
- 구현체: `{Domain}Repo` (예: `OrdersRepo`)
- 컬렉션 상수: `{Domain}Collection`
- Mock: `Mock{Domain}DataService`, 메서드별 `{Method}Func` 필드

## Constraints

### 1. 생성자에서 nil 의존성 즉시 거부

```go
func NewOrdersRepo(lgr logger.Logger, db mongodb.MongoDatabase) (*OrdersRepo, error) {
    if lgr == nil || db == nil {
        return nil, errors.New("missing required inputs to create OrdersRepo")
    }
    return &OrdersRepo{collection: db.Collection(OrdersCollection), logger: lgr}, nil
}
```

### 2. 모든 public 메서드 시작 시 `validateCollection` 호출

```go
func validateCollection(c *mongo.Collection) error {
    if c == nil { return ErrInvalidInitialization }
    return nil
}

func (o *OrdersRepo) Create(ctx context.Context, po *data.Order) (string, error) {
    if err := validateCollection(o.collection); err != nil { return "", err }
    // ...
}
```

### 3. 파일 상단에 에러 상수 집중 정의

```go
var (
    ErrInvalidInitialization = errors.New("invalid initialization")
    ErrInvalidPOIDCreate     = errors.New("order id should be empty")
    ErrPOIDNotFound          = errors.New("purchase order doesn't exist with given id")
    ErrFailedToCreateOrder   = errors.New("failed to create order")
)
```

### 4. Create: 비어 있지 않은 ID면 에러, InsertedID 타입 단언 필수

```go
if !po.ID.IsZero() { return "", ErrInvalidPOIDCreate }
result, err := o.collection.InsertOne(ctx, po)
if err != nil { return "", ErrFailedToCreateOrder }
insertedID, ok := result.InsertedID.(primitive.ObjectID)
if !ok { return "", ErrInvalidID }
return insertedID.Hex(), nil
```

### 5. GetByID: `mongo.ErrNoDocuments` → `ErrPOIDNotFound`, 그 외 → `ErrUnexpectedGetOrder`

```go
err := o.collection.FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&result)
if errors.Is(err, mongo.ErrNoDocuments) { return nil, ErrPOIDNotFound }
if err != nil { return nil, ErrUnexpectedGetOrder }
```

### 6. Mock: 인터페이스 메서드마다 `Func` 필드, 테스트에서 주입

```go
type MockOrdersDataService struct {
    CreateFunc  func(ctx context.Context, po *data.Order) (string, error)
    GetAllFunc  func(ctx context.Context, limit int64) (*[]data.Order, error)
}
func (m *MockOrdersDataService) Create(ctx context.Context, po *data.Order) (string, error) {
    return m.CreateFunc(ctx, po)
}
```
