---
paths:
  - "go-rest-api-example/internal/server/**/*"
---

# server

## 책임
Gin 라우터를 구성하고(`WebRouter`), HTTP 서버 라이프사이클(시작/graceful shutdown)을 관리한다(`Start`).

## 연관관계
```
main → server.Start(ctx, cfg, lgr, dbMgr)
            ↓
       server.WebRouter → handlers 생성 → db.NewOrdersRepo
            ↓
       gin.Engine (라우트 등록) → middleware 체인
```

---

## Constraints

### 1. `Start`: graceful shutdown, `ErrServerClosed` 외 에러는 래핑 반환

```go
func Start(ctx context.Context, svcEnv *config.ServiceEnvConfig, lgr logger.Logger, dbMgr mongodb.MongoManager) error {
    router, err := WebRouter(svcEnv, lgr, dbMgr)
    if err != nil { return err }
    srv := &http.Server{Addr: ":" + svcEnv.Port, Handler: router}
    serverErrors := make(chan error, 1)
    go func() { serverErrors <- srv.ListenAndServe() }()
    select {
    case serverErr := <-serverErrors:
        if !errors.Is(serverErr, http.ErrServerClosed) { return fmt.Errorf("server failed: %w", serverErr) }
        return nil
    case <-ctx.Done():
        shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeoutSeconds*time.Second)
        defer cancel()
        return srv.Shutdown(shutdownCtx)
    }
}
```

### 2. Gin 모드: 기본 `ReleaseMode`, `IsDevMode`일 때만 `DebugMode`

```go
ginMode := gin.ReleaseMode
if utilities.IsDevMode(svcEnv.Environment) { ginMode = gin.DebugMode; gin.ForceConsoleColor() }
gin.SetMode(ginMode)
gin.EnableJsonDecoderDisallowUnknownFields()
gin.DefaultWriter = io.Discard
```

### 3. 미들웨어 등록 순서 (고정)

```go
router := gin.New()
router.Use(gin.Recovery(), gzip.Gzip(gzip.DefaultCompression),
    middleware.ReqIDMiddleware(), middleware.ResponseHeadersMiddleware(),
    middleware.RequestLogMiddleware(lgr, fr)) // EnableTracing이면 fr != nil
```

### 4. 라우트 그룹 구조

```go
router.GET("/healthz", status.CheckStatus)
router.GET("/metrics", gin.WrapH(promhttp.Handler()))

// 내부 API
internalAPIGrp := router.Group("/internal")
internalAPIGrp.Use(middleware.InternalAuthMiddleware())
pprof.RouteRegister(internalAPIGrp, "pprof")
if utilities.IsDevMode(svcEnv.Environment) {
    internalAPIGrp.POST("/seed-local-db", seed.SeedDB) // dev 모드에서만
}

// 외부 API
externalAPIGrp := router.Group("/ecommerce/v1")
externalAPIGrp.Use(middleware.AuthMiddleware(), middleware.QueryParamsCheckMiddleware(lgr))
ordersGroup := externalAPIGrp.Group("orders")
ordersGroup.GET("", ordersHandler.GetAll)
ordersGroup.GET("/:id", ordersHandler.GetByID)
ordersGroup.POST("", ordersHandler.Create)
ordersGroup.DELETE("/:id", ordersHandler.DeleteByID)
```

### 5. 테스트: 라우트 존재 여부는 `Method` + `Path` 기준 헬퍼로 검증

```go
func assertRoutePresent(t *testing.T, gotRoutes gin.RoutesInfo, wantRoute gin.RouteInfo) {
    for _, r := range gotRoutes {
        if r.Path == wantRoute.Path && r.Method == wantRoute.Method { return }
    }
    t.Errorf("route not found: %v", wantRoute)
}
```
