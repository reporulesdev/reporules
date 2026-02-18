# Skill: JWT 인증이 필요한 보호된 API 추가

domain/repository/usecase가 완료된 후, JWT 인증 적용 HTTP 엔드포인트를 추가하는 흐름.

---

## Step 1: api/controller/{name}_controller.go — 참고: `rules/api.md`

핵심: 사용자 ID를 `c.GetString("x-user-id")` 로 읽기 (JwtAuthMiddleware가 설정)

```go
type ProfileController struct {
    ProfileUsecase domain.ProfileUsecase
}

func (pc *ProfileController) Fetch(c *gin.Context) {
    userID := c.GetString("x-user-id")
    profile, err := pc.ProfileUsecase.GetProfileByID(c, userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Message: err.Error()})
        return
    }
    c.JSON(http.StatusOK, profile)
}
```

---

## Step 2: api/route/{name}_route.go — 참고: `rules/api.md`

```go
func NewProfileRouter(env *bootstrap.Env, timeout time.Duration, db mongo.Database, group *gin.RouterGroup) {
    ur := repository.NewUserRepository(db, domain.CollectionUser)
    pc := &controller.ProfileController{
        ProfileUsecase: usecase.NewProfileUsecase(ur, timeout),
    }
    group.GET("/profile", pc.Fetch)
}
```

---

## Step 3: api/route/route.go — protectedRouter에 등록

```go
func Setup(env *bootstrap.Env, timeout time.Duration, db mongo.Database, gin *gin.Engine) {
    publicRouter := gin.Group("")
    NewLoginRouter(env, timeout, db, publicRouter)   // 기존 유지

    protectedRouter := gin.Group("")
    protectedRouter.Use(middleware.JwtAuthMiddleware(env.AccessTokenSecret))
    NewProfileRouter(env, timeout, db, protectedRouter)  // 추가
}
```

---

## JwtAuthMiddleware 동작

- Authorization 헤더 Bearer 토큰 추출
- `tokenutil.IsAuthorized(token, secret)` 검증
- `tokenutil.ExtractIDFromToken(token, secret)` 으로 사용자 ID 추출
- `c.Set("x-user-id", userID)` 컨텍스트 저장

---

## Controller 테스트 패턴

```go
func TestFetch(t *testing.T) {
    mockUsecase := new(mocks.ProfileUsecase)
    userID := primitive.NewObjectID().Hex()
    mockUsecase.On("GetProfileByID", mock.Anything, userID).
        Return(&domain.Profile{Name: "Test"}, nil)

    r := gin.Default()
    r.Use(func(c *gin.Context) { c.Set("x-user-id", userID); c.Next() })
    r.GET("/profile", (&controller.ProfileController{ProfileUsecase: mockUsecase}).Fetch)

    rec := httptest.NewRecorder()
    r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/profile", nil))
    assert.Equal(t, http.StatusOK, rec.Code)
}
```
