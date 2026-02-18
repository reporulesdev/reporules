# Skill: 새 도메인(CRUD) 추가

이 프로젝트에서 새 도메인 엔티티에 대한 CRUD REST API를 추가하는 전체 단계입니다.
Orders 도메인을 예시로 설명하며, 새 도메인으로 치환하여 사용하세요.

---

## 생성 순서

### Step 1. 내부 저장 모델 (`internal/models/data/{domain}.go`)

참조: `rules/models.md`

```go
package data

type {Domain}Status string
const ({Domain}Pending {Domain}Status = "{Domain}Pending")

type {Domain} struct {
    ID        primitive.ObjectID `bson:"_id,omitempty" json:"{domain}Id"`
    Version   int64              `json:"version" bson:"version"`
    CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
    UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
    Status    {Domain}Status     `json:"status" bson:"status"`
}
```

### Step 2. 외부 API 모델 (`internal/models/external/{domain}.go`)

참조: `rules/models.md`

```go
package external

type {Domain}Input struct {
    // 필수 필드에 binding:"required"
    Name string `json:"name" binding:"required"`
}

type {Domain} struct {
    ID        string         `json:"{domain}Id"` // ObjectID.Hex()
    CreatedAt string         `json:"createdAt"`   // FormatTimeToISO
    Status    data.{Domain}Status `json:"status"`
}
```

### Step 3. 에러 코드 상수 (`internal/errors/{domain}Errors.go`)

참조: `rules/errors.md`

```go
package errors

const {domain}Prefix = "{domain}_"
const (
    {Domain}GetInvalidParams  = {domain}Prefix + "get_invalid_params"
    {Domain}GetNotFound       = {domain}Prefix + "get_not_found"
    {Domain}GetServerError    = {domain}Prefix + "get_server_error"
    {Domain}CreateInvalidInput = {domain}Prefix + "create_invalid_input"
    {Domain}CreateServerError  = {domain}Prefix + "create_server_error"
    {Domain}DeleteNotFound     = {domain}Prefix + "delete_not_found"
    {Domain}DeleteServerError  = {domain}Prefix + "delete_server_error"
)
```

### Step 4. Repository 인터페이스 + 구현 (`internal/db/{domain}Repo.go`)

참조: `rules/db.md`

```go
const {Domain}Collection = "{collectionName}"

type {Domain}DataService interface {
    Create(ctx context.Context, item *data.{Domain}) (string, error)
    GetAll(ctx context.Context, limit int64) (*[]{data.Domain}, error)
    GetByID(ctx context.Context, id primitive.ObjectID) (*data.{Domain}, error)
    DeleteByID(ctx context.Context, id primitive.ObjectID) error
}

var (
    ErrInvalidInitialization = errors.New("invalid initialization")
    ErrInvalid{Domain}IDCreate = errors.New("{domain} id should be empty")
    ErrFailed{Domain}Create    = errors.New("failed to create {domain}")
    ErrNotFound{Domain}        = errors.New("{domain} not found")
)

type {Domain}Repo struct { collection *mongo.Collection; logger logger.Logger }

func New{Domain}Repo(lgr logger.Logger, db mongodb.MongoDatabase) (*{Domain}Repo, error) {
    if lgr == nil || db == nil { return nil, errors.New("missing required inputs") }
    return &{Domain}Repo{collection: db.Collection({Domain}Collection), logger: lgr}, nil
}
```

### Step 5. Mock (`internal/db/mocks/mock{Domain}DataService.go`)

참조: `rules/db.md`

```go
package mocks

type Mock{Domain}DataService struct {
    CreateFunc     func(ctx context.Context, item *data.{Domain}) (string, error)
    GetAllFunc     func(ctx context.Context, limit int64) (*[]{data.Domain}, error)
    GetByIDFunc    func(ctx context.Context, id primitive.ObjectID) (*data.{Domain}, error)
    DeleteByIDFunc func(ctx context.Context, id primitive.ObjectID) error
}
func (m *Mock{Domain}DataService) Create(ctx context.Context, item *data.{Domain}) (string, error) {
    return m.CreateFunc(ctx, item)
}
// ... 나머지 메서드도 동일 패턴
```

### Step 6. Handler (`internal/handlers/{domain}Handler.go`)

참조: `rules/handlers.md`

```go
type {Domain}Handler struct { svc db.{Domain}DataService; logger logger.Logger }

func New{Domain}Handler(lgr logger.Logger, svc db.{Domain}DataService) (*{Domain}Handler, error) {
    if lgr == nil || svc == nil { return nil, errors.New("missing required parameters") }
    return &{Domain}Handler{svc: svc, logger: lgr}, nil
}

func (h *{Domain}Handler) Create(c *gin.Context) {
    lgr, requestID := h.logger.WithReqID(c)
    var in external.{Domain}Input
    if err := c.ShouldBindJSON(&in); err != nil {
        h.abortWithAPIError(c, lgr, http.StatusBadRequest, errors.{Domain}CreateInvalidInput,
            "Invalid request body", requestID, err)
        return
    }
    // data 모델로 변환 → svc.Create → external 모델로 변환 → c.JSON(201, ...)
}
```

### Step 7. 라우트 등록 (`internal/server/server.go`)

참조: `rules/server.md`

```go
{domain}Repo, err := db.New{Domain}Repo(lgr, dbMgr)
if err != nil { return nil, err }
{domain}Handler, err := handlers.New{Domain}Handler(lgr, {domain}Repo)
if err != nil { return nil, err }

{domain}Group := externalAPIGrp.Group("{domains}")
{domain}Group.GET("", {domain}Handler.GetAll)
{domain}Group.GET("/:id", {domain}Handler.GetByID)
{domain}Group.POST("", {domain}Handler.Create)
{domain}Group.DELETE("/:id", {domain}Handler.DeleteByID)
```

### Step 8. `AllowedQueryParams` 업데이트 (`internal/middleware/queryParamsCheck.go`)

참조: `rules/middleware.md`

```go
var AllowedQueryParams = map[string]map[string]bool{
    // 기존 orders 항목 유지 ...
    http.MethodGet + "/ecommerce/v1/{domains}":        {"limit": true},
    http.MethodPost + "/ecommerce/v1/{domains}":       nil,
    http.MethodGet + "/ecommerce/v1/{domains}/:id":    nil,
    http.MethodDelete + "/ecommerce/v1/{domains}/:id": nil,
}
```
