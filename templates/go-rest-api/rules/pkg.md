---
paths:
  - "go-rest-api-example/pkg/**/*"
---

# pkg

## 책임
애플리케이션 전반에서 재사용 가능한 인프라 패키지(로거, MongoDB 연결, 느린 요청 트레이서)를 제공한다.

## 연관관계
```
pkg/logger          → handlers, middleware, server (Logger 인터페이스)
pkg/mongodb         → db, server (MongoManager / MongoDatabase 인터페이스)
pkg/flightrecorder  → middleware.RequestLogMiddleware (느린 요청 트레이스)
```

---

## logger 패키지

- 외부에 `Logger`/`Event` 인터페이스만 노출, 구현체 (`AppLogger`, `zerologEvent`) 내부 은닉
- `Event`는 체이닝 지원: `.Str().Int().Err().Msg()`
- 요청 ID 로깅: `WithReqID(c *gin.Context)` → `WithReqIDCustom` thin wrapper

```go
type Logger interface {
    Info() Event; Error() Event; Debug() Event; Fatal() Event
    WithReqID(ctx *gin.Context) (Logger, string)
}
type Event interface {
    Str(key, val string) Event; Int(key string, val int) Event
    Err(err error) Event; Msg(msg string); Send()
}
const DefaultRequestIDKey = "X-Request-ID"
```

## mongodb 패키지

- 인터페이스: `MongoManager`, `MongoDatabase`
- 구현: `ConnectionManager` (Functional Options 패턴)
- 옵션 함수: `With{Field}` 형식

```go
type Option func(*MongoOptions)
func WithSRV() Option { return func(o *MongoOptions) { o.UseSRV = true } }
func WithReplicaSet(rs string) Option { return func(o *MongoOptions) { o.ReplicaSet = rs } }
```

- 에러 변수: `Err{Description}` (패키지 전역 `var`)
- 연결 URL 생성: `ConnectionURL(hosts, database, creds, opts...) (string, *MongoOptions, error)`
- 기본값은 `applyOptions` 내부에서만 설정
- 유효성 검사: `validateOptions` → `fmt.Errorf("%w: %s", baseErr, value)`

```go
var (
    ErrNoHosts            = errors.New("at least one host is required")
    ErrSRVRequiresOneHost = errors.New("SRV connection requires exactly one host")
    ErrInvalidReadPref    = errors.New("invalid read preference")
)
```

## flightrecorder 패키지

- 생성자 실패 시 `nil` 반환, 호출자는 nil 체크 필수
- `CaptureSlowRequest` 실패 시 `""` 반환
- 트레이스 파일명: `slow-request-{METHOD}-{SEGMENT}-{TIMESTAMP}.trace`

```go
func NewDefault(lgr logger.Logger) *Recorder { /* 실패 시 nil */ }
func (r *Recorder) CaptureSlowRequest(lgr logger.Logger, method, path string,
    elapsed time.Duration) string { /* 실패 시 "" */ }
```

## 공통 규칙

- 테스트 패키지: `<pkg>_test` 형식 (`flightrecorder_test`, `logger_test`, `mongodb_test`)
- 에러는 `errors.New` 전역 `var`로 선언, 에러 메시지 문자열까지 테스트로 고정
