---
paths:
  - "go-backend-clean-architecture/api/**/*"
---

# api Guide

## 책임
HTTP 요청 수신·응답 반환, 의존성 조립(route), JWT 인증 미들웨어 적용.

## 연관관계
```
api/controller → domain (타입 참조)
api/controller → usecase (Usecase 인터페이스 호출)
api/route      → repository, usecase, controller (조립)
api/middleware → internal/tokenutil (JWT 검증)
```

## 패턴 1: Controller 구조

```go
type TaskController struct {
    TaskUsecase domain.TaskUsecase
}
// 환경 값 필요 시 *bootstrap.Env 추가
type LoginController struct {
    LoginUsecase domain.LoginUsecase
    Env          *bootstrap.Env
}
```

## 패턴 2: 핸들러 메서드

```go
func (tc *TaskController) Create(c *gin.Context) {
    var task domain.Task
    if err := c.ShouldBind(&task); err != nil {
        c.JSON(http.StatusBadRequest, domain.ErrorResponse{Message: err.Error()})
        return
    }
    userID := c.GetString("x-user-id")
    uid, err := primitive.ObjectIDFromHex(userID)
    if err != nil {
        c.JSON(http.StatusBadRequest, domain.ErrorResponse{Message: err.Error()})
        return
    }
    task.ID = primitive.NewObjectID()
    task.UserID = uid
    if err := tc.TaskUsecase.Create(c, &task); err != nil {
        c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Message: err.Error()})
        return
    }
    c.JSON(http.StatusOK, domain.SuccessResponse{Message: "Task created successfully"})
}
```

## 패턴 3: Route 조립

```go
func NewTaskRouter(env *bootstrap.Env, timeout time.Duration, db mongo.Database, group *gin.RouterGroup) {
    tr := repository.NewTaskRepository(db, domain.CollectionTask)
    tc := &controller.TaskController{
        TaskUsecase: usecase.NewTaskUsecase(tr, timeout),
    }
    group.GET("/task", tc.Fetch)
    group.POST("/task", tc.Create)
}
```

## 패턴 4: public/protected 라우터 분리

```go
func Setup(env *bootstrap.Env, timeout time.Duration, db mongo.Database, gin *gin.Engine) {
    publicRouter := gin.Group("")
    NewSignupRouter(env, timeout, db, publicRouter)
    NewLoginRouter(env, timeout, db, publicRouter)

    protectedRouter := gin.Group("")
    protectedRouter.Use(middleware.JwtAuthMiddleware(env.AccessTokenSecret))
    NewProfileRouter(env, timeout, db, protectedRouter)
    NewTaskRouter(env, timeout, db, protectedRouter)
}
```

## 규칙

- Controller: `ShouldBind` 실패 → 400, Usecase 에러 → 500, 성공 → 200/201
- 인증 사용자 ID: `c.GetString("x-user-id")` (JwtAuthMiddleware가 설정)
- Route 함수 시그니처: `func New{Domain}Router(env *bootstrap.Env, timeout time.Duration, db mongo.Database, group *gin.RouterGroup)`
- 내부 조립 순서: Repository → Usecase → Controller
- 테스트: `domain/mocks` mock 주입, `httptest` 사용
