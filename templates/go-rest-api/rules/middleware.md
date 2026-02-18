---
paths:
  - "go-rest-api-example/internal/middleware/**/*"
---

# middleware

## 책임
인증, 요청 ID 부여, 쿼리 파라미터 검증, 응답 헤더 설정, 요청 로깅 등 공통 횡단 관심사를 처리한다.

## 연관관계
```
server.WebRouter
    → gin.Recovery → gzip → ReqIDMiddleware → ResponseHeadersMiddleware
    → RequestLogMiddleware(lgr, fr?) → [AuthMiddleware] → [QueryParamsCheckMiddleware]
    → Handler
```

---

## Naming

- 모든 미들웨어: `XxxMiddleware` 함수명, `gin.HandlerFunc` 반환
- 테스트 파일: `{name}_test.go`, 패키지 `middleware_test`

## Constraints

### 1. 미들웨어 시그니처 고정

```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) { c.Next() }
}
func QueryParamsCheckMiddleware(lgr logger.Logger) gin.HandlerFunc {
    return func(c *gin.Context) { /* ... */ }
}
```

### 2. 중단 시 `AbortWithStatusJSON` + `return`, 계속 진행 시 마지막에 `c.Next()`

```go
// 중단
c.AbortWithStatusJSON(apiErr.HTTPStatusCode, apiErr)
return

// 계속
c.Next()
```

### 3. ReqID: 헤더에 없으면 UUID 생성, context와 응답 헤더 양쪽에 저장

```go
const RequestIdentifier = "X-Request-ID"
type ContextKey string

func ReqIDMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        reqID := c.Request.Header.Get(RequestIdentifier)
        if reqID == "" { reqID = uuid.New().String() }
        ctx := context.WithValue(c.Request.Context(), ContextKey(RequestIdentifier), reqID)
        c.Request = c.Request.WithContext(ctx)
        c.Writer.Header().Set(RequestIdentifier, reqID)
        c.Next()
    }
}
```

### 4. 쿼리 파라미터 검증: `AllowedQueryParams` 맵 기반, 미등록 경로 404, 불허 파라미터 400

```go
var AllowedQueryParams = map[string]map[string]bool{
    http.MethodGet + "/ecommerce/v1/orders":        {"limit": true, "offset": true},
    http.MethodPost + "/ecommerce/v1/orders":       nil,
    http.MethodGet + "/ecommerce/v1/orders/:id":    nil,
    http.MethodDelete + "/ecommerce/v1/orders/:id": nil,
}
```

### 5. 느린 요청: `SlowRequestThreshold = 500ms` 초과 시 `fr.CaptureSlowRequest` 호출

```go
const SlowRequestThreshold = 500 * time.Millisecond

func RequestLogMiddleware(lgr logger.Logger, fr *flightrecorder.Recorder) gin.HandlerFunc {
    return func(c *gin.Context) {
        l, _ := lgr.WithReqID(c)
        start := time.Now()
        c.Next()
        elapsed := time.Since(start)
        l.Info().Dur("elapsedMs", elapsed).Send()
        if fr != nil && elapsed > SlowRequestThreshold {
            fr.CaptureSlowRequest(l, c.Request.Method, c.FullPath(), elapsed)
        }
    }
}
```
