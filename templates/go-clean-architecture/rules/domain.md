---
paths:
  - "go-backend-clean-architecture/domain/**/*"
---

# domain Guide

## 책임
비즈니스 엔티티, Repository/Usecase 인터페이스, DTO를 정의하는 최내층 레이어 — 어떤 내부 패키지에도 의존하지 않음.

## 연관관계
```
domain/ (의존 없음)
   ↑ usecase/    (인터페이스 구현)
   ↑ repository/ (인터페이스 구현)
   ↑ api/        (타입 참조)
```

## 파일 구조

```
domain/
  {name}.go           # 엔티티 + Repository + Usecase 인터페이스
  {auth_flow}.go      # Request/Response DTO + Usecase 인터페이스
  jwt_custom.go       # JwtCustomClaims, JwtCustomRefreshClaims
  success_response.go
  error_response.go
  mocks/              # mockery 자동 생성 mock
```

## 패턴 1: 엔티티 + 인터페이스

```go
const CollectionTask = "tasks"

type Task struct {
    ID     primitive.ObjectID `bson:"_id" json:"-"`
    Title  string             `bson:"title" form:"title" binding:"required" json:"title"`
    UserID primitive.ObjectID `bson:"userID" json:"-"`
}

type TaskRepository interface {
    Create(c context.Context, task *Task) error
    FetchByUserID(c context.Context, userID string) ([]Task, error)
}

type TaskUsecase interface {
    Create(c context.Context, task *Task) error
    FetchByUserID(c context.Context, userID string) ([]Task, error)
}
```

## 패턴 2: 인증 DTO + Usecase 인터페이스

```go
type LoginRequest struct {
    Email    string `form:"email" binding:"required,email"`
    Password string `form:"password" binding:"required"`
}
type LoginResponse struct {
    AccessToken  string `json:"accessToken"`
    RefreshToken string `json:"refreshToken"`
}
type LoginUsecase interface {
    GetUserByEmail(c context.Context, email string) (User, error)
    CreateAccessToken(user *User, secret string, expiry int) (string, error)
    CreateRefreshToken(user *User, secret string, expiry int) (string, error)
}
```

## 패턴 3: JWT Claims

```go
type JwtCustomClaims struct {
    Name string `json:"name"`
    ID   string `json:"id"`
    jwt.StandardClaims
}
type JwtCustomRefreshClaims struct {
    ID string `json:"id"`
    jwt.StandardClaims
}
```

## 규칙

- `CollectionXxx` 상수를 엔티티와 같은 파일에 정의
- 엔티티 필드: `bson` 태그 필수, HTTP 바인딩 필요 시 `form` + `binding` 태그 추가
- Request DTO: `form` + `binding` 태그, Response DTO: `json` 태그만
- `Repository` 인터페이스는 순수 CRUD, `Usecase` 인터페이스는 비즈니스 메서드
- mock은 mockery CLI로 자동 생성 (`domain/mocks/`)
