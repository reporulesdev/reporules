# go-clean-architecture Initialize Guide

## 프로젝트 구조

```
go-backend-clean-architecture/
  bootstrap/        # 앱 초기화 (Env, MongoDB 연결, Application)
  domain/           # 엔티티, 인터페이스, DTO (의존성 없음)
    mocks/          # mockery 자동 생성 mock
  internal/
    tokenutil/      # JWT 생성·검증 유틸
    fakeutil/       # 테스트용 유틸
  mongo/            # MongoDB 드라이버 래퍼 인터페이스
    mocks/          # mongo 인터페이스 mock
  repository/       # domain.Repository 구현체 (MongoDB)
  usecase/          # domain.Usecase 구현체 (비즈니스 로직)
  api/
    controller/     # HTTP 핸들러
    middleware/     # JWT 인증 미들웨어
    route/          # 라우팅 + 의존성 조립
  cmd/              # main.go 진입점
```

## 새 도메인 추가 시 생성 순서

1. `domain/{name}.go` — 엔티티, Repository/Usecase 인터페이스, DTO
2. `repository/{name}_repository.go` — MongoDB CRUD 구현
3. `usecase/{name}_usecase.go` — 비즈니스 로직 구현
4. `api/controller/{name}_controller.go` — HTTP 핸들러
5. `api/route/{name}_route.go` — 라우팅 + 의존성 조립 (Repository → Usecase → Controller)
6. `api/route/route.go` 의 `Setup` 함수에 `New{Name}Router` 등록

## 구획별 핵심 패턴 요약

### domain/
```go
type Task struct {
    ID     primitive.ObjectID `bson:"_id"`
    Title  string             `bson:"title" form:"title" binding:"required" json:"title"`
}
type TaskRepository interface { Create(c context.Context, task *Task) error }
type TaskUsecase interface    { Create(c context.Context, task *Task) error }
```

### usecase/
```go
func NewTaskUsecase(r domain.TaskRepository, t time.Duration) domain.TaskUsecase {
    return &taskUsecase{taskRepository: r, contextTimeout: t}
}
```

### repository/
```go
func NewTaskRepository(db mongo.Database, c string) domain.TaskRepository {
    return &taskRepository{database: db, collection: c}
}
```

### api/route/
```go
func NewTaskRouter(env *bootstrap.Env, timeout time.Duration, db mongo.Database, group *gin.RouterGroup) {
    tr := repository.NewTaskRepository(db, domain.CollectionTask)
    tc := &controller.TaskController{TaskUsecase: usecase.NewTaskUsecase(tr, timeout)}
    group.POST("/task", tc.Create)
}
```

## rules/ 파일 목록

| 파일 | 적용 경로 | 용도 |
|------|-----------|------|
| `domain.md` | `domain/**/*` | 엔티티·인터페이스·DTO 작성 규칙 |
| `api.md` | `api/**/*` | Controller·Route·Middleware 패턴 |
| `usecase.md` | `usecase/**/*` | Usecase 구현체 패턴 |
| `repository.md` | `repository/**/*` | Repository 구현체 패턴 |
| `mongo.md` | `mongo/**/*` | MongoDB 래퍼 인터페이스 패턴 |
| `bootstrap.md` | `bootstrap/**/*` | 앱 초기화·환경 설정 패턴 |
| `internal.md` | `internal/**/*` | 내부 유틸리티 패키지 패턴 |

## skills/ 파일 목록

| 파일 | 용도 |
|------|------|
| `add-domain.md` | 새 도메인 전체 추가 (domain → repo → usecase → api) |
| `add-protected-api.md` | JWT 인증이 필요한 보호된 API 엔드포인트 추가 |
