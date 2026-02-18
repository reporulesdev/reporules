---
paths:
  - "go-backend-clean-architecture/usecase/**/*"
---

# usecase Guide

## 책임
`domain/` 인터페이스를 구현하는 비즈니스 로직 레이어 — Repository 호출에 context timeout 적용.

## 연관관계
```
usecase → domain (인터페이스 구현, 타입 참조)
usecase → internal/tokenutil (JWT 생성·검증 위임)
api/route → usecase (생성자 호출)
```

## 네이밍

- 파일: `{feature}_usecase.go`
- 구조체: `{feature}Usecase` (소문자, unexported)
- 생성자: `New{Feature}Usecase` (exported, domain 인터페이스 반환)

## 패턴 1: 구조체 + 생성자

```go
type taskUsecase struct {
    taskRepository domain.TaskRepository
    contextTimeout time.Duration
}

func NewTaskUsecase(r domain.TaskRepository, t time.Duration) domain.TaskUsecase {
    return &taskUsecase{taskRepository: r, contextTimeout: t}
}
```

## 패턴 2: context timeout 적용

```go
func (u *taskUsecase) FetchByUserID(c context.Context, id string) ([]domain.Task, error) {
    ctx, cancel := context.WithTimeout(c, u.contextTimeout)
    defer cancel()
    return u.taskRepository.FetchByUserID(ctx, id)
}
```

## 패턴 3: 토큰 로직 위임

```go
// usecase는 thin wrapper — 실제 로직은 tokenutil에 위임
func (u *loginUsecase) CreateAccessToken(user *domain.User, s string, e int) (string, error) {
    return tokenutil.CreateAccessToken(user, s, e)
}
func (u *loginUsecase) CreateRefreshToken(user *domain.User, s string, e int) (string, error) {
    return tokenutil.CreateRefreshToken(user, s, e)
}
```

## 패턴 4: 테스트

```go
package usecase_test

func TestFetchByUserID(t *testing.T) {
    mockRepo := new(mocks.TaskRepository)
    userID := primitive.NewObjectID().Hex()

    t.Run("success", func(t *testing.T) {
        mockTasks := []domain.Task{{ID: primitive.NewObjectID()}}
        mockRepo.On("FetchByUserID", mock.Anything, userID).Return(mockTasks, nil).Once()

        u := usecase.NewTaskUsecase(mockRepo, time.Second)
        list, err := u.FetchByUserID(context.Background(), userID)

        assert.NoError(t, err)
        assert.Len(t, list, len(mockTasks))
        mockRepo.AssertExpectations(t)
    })
}
```

## 규칙

- 모든 usecase 구조체는 Repository 필드 + `contextTimeout time.Duration` 보유
- 생성자 반환 타입은 반드시 `domain.{Feature}Usecase` 인터페이스 (구체 타입 포인터 노출 금지)
- Repository 호출마다 `context.WithTimeout` + `defer cancel()` 적용
- 비즈니스 로직 없는 위임 메서드는 thin wrapper로 작성
- 테스트 파일 패키지: `usecase_test`, mock: `domain/mocks`
