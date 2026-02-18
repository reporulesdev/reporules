---
paths:
  - "go-backend-clean-architecture/mongo/**/*"
---

# mongo Guide

## 책임
MongoDB 드라이버를 인터페이스로 감싸 테스트 가능성 확보 — 드라이버 구체 타입을 외부에 노출하지 않음.

## 연관관계
```
mongo/ (인터페이스 정의 + 구현체)
   ↑ repository/ (Database, Collection 인터페이스 사용)
   ↑ bootstrap/  (Client 인터페이스 사용)
mongo/mocks/ (테스트용 mock)
   ↑ repository 테스트
```

## 인터페이스 구조

```go
type Client interface {
    Database(string) Database
    Connect(context.Context) error
    Disconnect(context.Context) error
    Ping(context.Context) error
    StartSession() (mongo.Session, error)
}

type Database interface {
    Collection(string) Collection
    Client() Client
}

type Collection interface {
    FindOne(context.Context, interface{}) SingleResult
    InsertOne(context.Context, interface{}) (interface{}, error)
    Find(context.Context, interface{}, ...*options.FindOptions) (Cursor, error)
    UpdateOne(context.Context, interface{}, interface{}, ...*options.UpdateOptions) (*mongo.UpdateResult, error)
    DeleteOne(context.Context, interface{}) (int64, error)
}
```

## 패턴 1: 구현체 (드라이버 감싸기)

```go
type mongoDatabase struct{ db *mongo.Database }

func (md *mongoDatabase) Collection(colName string) Collection {
    return &mongoCollection{coll: md.db.Collection(colName)}
}

type mongoCollection struct{ coll *mongo.Collection }

func (mc *mongoCollection) InsertOne(ctx context.Context, doc interface{}) (interface{}, error) {
    id, err := mc.coll.InsertOne(ctx, doc)
    return id.InsertedID, err  // InsertedID만 추출
}

func (mc *mongoCollection) Find(ctx context.Context, filter interface{}, opts ...*options.FindOptions) (Cursor, error) {
    cur, err := mc.coll.Find(ctx, filter, opts...)
    return &mongoCursor{mc: cur}, err  // mongoCursor로 감싸서 반환
}
```

## 패턴 2: NewClient 초기화

```go
func NewClient(connection string) (Client, error) {
    time.Local = time.UTC
    c, err := mongo.NewClient(options.Client().ApplyURI(connection))
    return &mongoClient{cl: c}, err
}
```

## 패턴 3: mocks 패키지

```go
type Collection struct{ mock.Mock }

func NewCollection(t mockConstructorTestingTNewCollection) *Collection {
    mock := &Collection{}
    mock.Mock.Test(t)
    t.Cleanup(func() { mock.AssertExpectations(t) })
    return mock
}
```

## 규칙

- 인터페이스명: `Database`, `Collection`, `Client`, `Cursor`, `SingleResult` (PascalCase 단일 명사)
- 구현체명: 인터페이스명 앞에 `mongo` 접두사 소문자 (`mongoDatabase`, `mongoCollection` 등)
- `InsertOne`/`InsertMany`: 결과에서 `InsertedID(s)`만 추출 반환
- `DeleteOne`: `DeletedCount`만 추출 반환
- `Find`/`Aggregate`: `*mongo.Cursor` → `mongoCursor`로 감싸서 반환
- `UpdateOne`/`UpdateMany` 가변 인자: `opts[:]...` 로 전달
- mock 타입마다 `New{Type}` 생성 함수 정의, `t.Cleanup`에서 `AssertExpectations` 호출
