---
paths:
  - "go-rest-api-example/internal/config/**/*"
---

# config

## 책임
환경 변수를 읽어 `ServiceEnvConfig` 구조체로 변환하고 유효성을 검증한다.

## 연관관계
```
os.Getenv → config.Load() → ServiceEnvConfig → server.Start / mongodb.Connect
```

---

## Naming

- 설정 구조체: `*EnvConfig` 접미사 (`ServiceEnvConfig`)
- 필수 환경 변수 기본값: `Def*` (`DefEnvironment`, `DefDatabase`)
- 선택 환경 변수 기본값: `Default*` (`DefaultPort`, `DefaultLogLevel`)
- 로드 함수: 단일 `Load() (*ServiceEnvConfig, error)`

## Constraints

### 1. 필수 환경 변수가 비면 즉시 error 반환

```go
func Load() (*ServiceEnvConfig, error) {
    dbHosts := os.Getenv("dbHosts")
    if dbHosts == "" {
        return nil, errors.New("dbHosts is missing in env")
    }
    dbCredentialsSideCar := os.Getenv("DBCredentialsSideCar")
    if dbCredentialsSideCar == "" {
        return nil, errors.New("database credentials sidecar file path is missing in env")
    }
    // ...
}
```

### 2. 선택 환경 변수는 비면 상수 기본값 사용

```go
port := os.Getenv("port")
if port == "" { port = DefaultPort }

envName := os.Getenv("environment")
if envName == "" { envName = DefEnvironment }
```

### 3. 불리언 환경 변수는 `strconv.ParseBool`, 실패 시 기본값

```go
enableTracing, err := strconv.ParseBool(os.Getenv("enableTracing"))
if err != nil { enableTracing = DefEnableTracing }
```

### 4. 환경 변수 키 스타일 유지

- 카멜케이스: `"environment"`, `"port"`, `"logLevel"`, `"dbHosts"`, `"enableTracing"`
- 파스칼케이스: `"DBCredentialsSideCar"`

### 5. 테스트는 `t.Setenv`로 환경 격리

```go
func TestLoadWithValidConfig(t *testing.T) {
    t.Setenv("dbHosts", "localhost:27017")
    t.Setenv("DBCredentialsSideCar", "/path/to/creds")
    cfg, err := config.Load()
    require.NoError(t, err)
    assert.NotNil(t, cfg)
}
```
