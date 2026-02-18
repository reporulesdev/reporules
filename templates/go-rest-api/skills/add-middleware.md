# Skill: 새 미들웨어 추가

이 프로젝트에서 새 Gin 미들웨어를 추가하는 단계입니다.

---

## 생성 순서

### Step 1. 미들웨어 파일 생성 (`internal/middleware/{name}Middleware.go`)

참조: `rules/middleware.md`

규칙:
- 함수명: `{Name}Middleware`
- 반환 타입: `gin.HandlerFunc`
- 내부 처리 로직은 `return func(c *gin.Context) { ... }` 클로저 안에 구현
- 요청 계속 진행: 마지막에 `c.Next()` 호출
- 요청 중단: `c.AbortWithStatusJSON(status, apiErr)` 후 `return` (c.Next() 없음)
- 로거가 필요하면 `logger.Logger`를 파라미터로 받고, 요청별 로거는 `lgr.WithReqID(c)` 사용

```go
package middleware

import "github.com/gin-gonic/gin"

// 로거 불필요한 단순 미들웨어
func {Name}Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 처리 로직
        c.Next()
    }
}

// 로거가 필요한 미들웨어
func {Name}Middleware(lgr logger.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        l, _ := lgr.WithReqID(c)
        // ...
        c.Next()
    }
}

// 조건부 중단 미들웨어
func {Name}Middleware(lgr logger.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        if /* 조건 */ {
            apiErr := &external.APIError{HTTPStatusCode: http.StatusUnauthorized}
            c.AbortWithStatusJSON(apiErr.HTTPStatusCode, apiErr)
            return
        }
        c.Next()
    }
}
```

### Step 2. 테스트 파일 생성 (`internal/middleware/{name}Middleware_test.go`)

참조: `rules/middleware.md`

```go
package middleware_test

import (
    "net/http/httptest"
    "testing"
    "github.com/gin-gonic/gin"
    "github.com/rameshsunkara/go-rest-api-example/internal/middleware"
)

func Test{Name}Middleware(t *testing.T) {
    gin.SetMode(gin.TestMode)
    router := gin.New()
    router.Use(middleware.{Name}Middleware())
    router.GET("/test", func(c *gin.Context) { c.String(200, "OK") })

    rec := httptest.NewRecorder()
    req, _ := http.NewRequest(http.MethodGet, "/test", nil)
    router.ServeHTTP(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
}
```

### Step 3. 서버에 미들웨어 등록 (`internal/server/server.go`)

참조: `rules/server.md`

공통 미들웨어 (모든 요청에 적용):
```go
router.Use(middleware.{Name}Middleware())
```

특정 그룹에만 적용 (외부 API):
```go
externalAPIGrp := router.Group("/ecommerce/v1")
externalAPIGrp.Use(middleware.{Name}Middleware(lgr))
```

특정 그룹에만 적용 (내부 API):
```go
internalAPIGrp := router.Group("/internal")
internalAPIGrp.Use(middleware.{Name}Middleware())
```

### Step 4. 쿼리 파라미터 검증이 포함된 경우: `AllowedQueryParams` 업데이트

새 경로가 추가되거나 새 쿼리 파라미터를 허용해야 하는 경우:

```go
var AllowedQueryParams = map[string]map[string]bool{
    // 기존 항목 유지
    http.MethodGet + "/new/path": {"newParam": true},
}
```

---

## 현재 미들웨어 체인 (등록 순서)

```
gin.Recovery()
gzip.Gzip(DefaultCompression)
ReqIDMiddleware()           // X-Request-ID 부여
ResponseHeadersMiddleware() // 보안 헤더 설정
RequestLogMiddleware(lgr, fr) // 요청 로깅 + 느린 요청 트레이스
--- 외부 API 그룹 ---
AuthMiddleware()
QueryParamsCheckMiddleware(lgr)
--- 내부 API 그룹 ---
InternalAuthMiddleware()
```
