---
paths:
  - "go-backend-clean-architecture/repository/**/*"
---

# repository Guide

## 책임
`domain/` Repository 인터페이스의 MongoDB 구현체 — 실제 DB I/O 담당.

## 연관관계
```
repository → domain (인터페이스 구현, 타입 참조)
repository → mongo  (Database/Collection 인터페이스 사용)
usecase    → repository (생성자 주입)
```

## 네이밍

- 파일: `{domainName}_repository.go`
- 구조체: `{domainName}Repository` (소문자, unexported)
- 생성자: `New{DomainName}Repository` (exported, domain 인터페이스 반환)
- 테스트 파일 패키지: `repository_test`

## 패턴 1: 구조체 + 생성자

```go
type taskRepository struct {
    database   mongo.Database
    collection string
}

func NewTaskRepository(db mongo.Database, c string) domain.TaskRepository {
    return &taskRepository{database: db, collection: c}
}
```

## 패턴 2: InsertOne

```go
func (tr *taskRepository) Create(c context.Context, t *domain.Task) error {
    col := tr.database.Collection(tr.collection)
    _, err := col.InsertOne(c, t)
    return err
}
```

## 패턴 3: ObjectID 변환 + Find

```go
func (tr *taskRepository) FetchByUserID(c context.Context, id string) ([]domain.Task, error) {
    col := tr.database.Collection(tr.collection)
    var tasks []domain.Task
    hex, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        return tasks, err
    }
    cursor, err := col.Find(c, bson.M{"userID": hex})
    if err != nil {
        return tasks, err
    }
    err = cursor.All(c, &tasks)
    if tasks == nil {
        return []domain.Task{}, err
    }
    return tasks, err
}
```

## 패턴 4: 테스트 (mongo/mocks 사용)

```go
package repository_test

func TestCreate(t *testing.T) {
    db := &mocks.Database{}
    col := &mocks.Collection{}

    col.On("InsertOne", mock.Anything, mock.AnythingOfType("*domain.Task")).
        Return(primitive.NewObjectID(), nil).Once()
    db.On("Collection", domain.CollectionTask).Return(col)

    tr := repository.NewTaskRepository(db, domain.CollectionTask)
    err := tr.Create(context.Background(), &domain.Task{})

    assert.NoError(t, err)
    col.AssertExpectations(t)
}
```

## 규칙

- 모든 구조체 필드: `database mongo.Database` + `collection string`
- 생성자 반환 타입: `domain.{DomainName}Repository` 인터페이스
- 모든 메서드 첫 번째 인자: `context.Context`
- 컬렉션 접근: `database.Collection(collection)` 매번 호출
- 문자열 ID: `primitive.ObjectIDFromHex` 변환, 실패 시 즉시 에러 반환
- `cursor.All` 후 nil slice → 빈 slice로 치환
- 테스트: `mongo/mocks` 패키지의 mock 타입 사용
