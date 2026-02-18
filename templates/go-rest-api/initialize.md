# Initialize Guide — go-rest-api

## 폴더 트리 구조

```
go-rest-api-example/
  cmd/main.go                         # 엔트리포인트: config.Load → mongodb.Connect → server.Start
  internal/
    config/                           # 환경 변수 로드 (ServiceEnvConfig, Load())
    db/                               # Repository 인터페이스 + 구현 + mocks/
    errors/                           # 도메인 에러 코드 상수 (prefix + snake_case)
    handlers/                         # Gin 핸들러 (OrdersHandler, StatusHandler, SeedHandler)
    middleware/                       # gin.HandlerFunc 반환 미들웨어들
    models/
      data/                           # MongoDB 내부 도메인 모델 (bson+json 태그)
      external/                       # HTTP 요청/응답 모델 (binding 태그, string ID/시간)
    server/                           # WebRouter + Start (graceful shutdown)
    utilities/                        # FormatTimeToISO, IsDevMode, CalculateTotalAmount 등
  pkg/
    logger/                           # Logger/Event 인터페이스 (zerolog 기반)
    mongodb/                          # ConnectionManager, Functional Options, ConnectionURL
    flightrecorder/                   # 느린 요청 트레이스 캡처
```

## 새 도메인/기능 추가 시 생성 순서

1. `internal/models/data/` — 내부 저장 모델 (`bson`+`json` 태그)
2. `internal/models/external/` — 요청(`XXXInput`) + 응답 모델 (`string` ID/시간)
3. `internal/errors/` — 에러 코드 상수 (`prefix + "action_detail"`)
4. `internal/db/{domain}Repo.go` — 인터페이스 + 구현 + 에러 상수
5. `internal/db/mocks/` — `Mock{Domain}DataService` (Func 필드 방식)
6. `internal/handlers/{domain}Handler.go` — `New{Domain}Handler` + 메서드들
7. `internal/server/server.go` — WebRouter에 라우트 등록

## 구획별 핵심 패턴

**config**: `Load()` 단일 함수, 필수 변수 누락 시 즉시 error 반환
```go
func Load() (*ServiceEnvConfig, error) {
    if dbHosts := os.Getenv("dbHosts"); dbHosts == "" {
        return nil, errors.New("dbHosts is missing in env")
    }
    // ...
}
```

**db**: 생성자 nil-check + 모든 public 메서드 시작 시 `validateCollection`
```go
func NewOrdersRepo(lgr logger.Logger, db mongodb.MongoDatabase) (*OrdersRepo, error) {
    if lgr == nil || db == nil { return nil, errors.New("missing required inputs") }
    return &OrdersRepo{collection: db.Collection(OrdersCollection), logger: lgr}, nil
}
```

**handlers**: 생성자 nil-check + `abortWithAPIError` 헬퍼로 에러 응답 통일
```go
func (o *OrdersHandler) abortWithAPIError(c *gin.Context, lgr logger.Logger,
    status int, errorCode, message, debugID string, err error) {
    apiErr := &external.APIError{HTTPStatusCode: status, ErrorCode: errorCode, Message: message, DebugID: debugID}
    c.AbortWithStatusJSON(status, apiErr)
}
```

**middleware**: `func XxxMiddleware(...) gin.HandlerFunc` 시그니처, 중단 시 `AbortWithStatusJSON` + `return`
```go
func ReqIDMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        reqID := c.Request.Header.Get(RequestIdentifier)
        if reqID == "" { reqID = uuid.New().String() }
        c.Writer.Header().Set(RequestIdentifier, reqID)
        c.Next()
    }
}
```

**server**: `gin.New()` + 미들웨어 순서 고정 + `/ecommerce/v1` 외부 그룹 / `/internal` 내부 그룹
```go
router := gin.New()
router.Use(gin.Recovery(), gzip.Gzip(gzip.DefaultCompression),
    middleware.ReqIDMiddleware(), middleware.ResponseHeadersMiddleware(),
    middleware.RequestLogMiddleware(lgr, fr))
```

## rules/ 및 skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `rules/config.md` | 환경 변수 로드 패턴 및 기본값 규칙 |
| `rules/db.md` | Repository 인터페이스/구현/Mock 패턴 |
| `rules/errors.md` | 도메인 에러 코드 상수 네이밍 |
| `rules/handlers.md` | Gin 핸들러 생성자/에러 응답/모델 변환 |
| `rules/middleware.md` | 미들웨어 시그니처/ReqID/쿼리 검증 |
| `rules/models.md` | data/external 모델 분리 패턴 |
| `rules/server.md` | WebRouter 구성/라우트 그룹/graceful shutdown |
| `rules/utilities.md` | 시간/가격/개발모드 유틸 함수 패턴 |
| `rules/pkg.md` | logger/mongodb/flightrecorder 패키지 패턴 |
| `skills/add-domain.md` | 새 도메인(CRUD) 전체 추가 단계 |
| `skills/add-middleware.md` | 새 미들웨어 추가 단계 |
