---
paths:
  - "go-backend-clean-architecture/bootstrap/**/*"
---

# bootstrap Guide

## 책임
앱 시작 시 환경 변수 로딩, MongoDB 연결, Application 구조체 조립 — 의존성 초기화 진입점.

## 연관관계
```
bootstrap → mongo (Client 인터페이스 사용)
api/route → bootstrap (Env 주입)
cmd/main  → bootstrap (App() 호출)
```

## 패턴 1: Env (환경 변수)

```go
type Env struct {
    AppEnv                 string `mapstructure:"APP_ENV"`
    ServerAddress          string `mapstructure:"SERVER_ADDRESS"`
    ContextTimeout         int    `mapstructure:"CONTEXT_TIMEOUT"`
    DBHost                 string `mapstructure:"DB_HOST"`
    DBPort                 string `mapstructure:"DB_PORT"`
    DBUser                 string `mapstructure:"DB_USER"`
    DBPass                 string `mapstructure:"DB_PASS"`
    DBName                 string `mapstructure:"DB_NAME"`
    AccessTokenExpiryHour  int    `mapstructure:"ACCESS_TOKEN_EXPIRY_HOUR"`
    RefreshTokenExpiryHour int    `mapstructure:"REFRESH_TOKEN_EXPIRY_HOUR"`
    AccessTokenSecret      string `mapstructure:"ACCESS_TOKEN_SECRET"`
    RefreshTokenSecret     string `mapstructure:"REFRESH_TOKEN_SECRET"`
}

func NewEnv() *Env {
    env := Env{}
    viper.SetConfigFile(".env")
    if err := viper.ReadInConfig(); err != nil { log.Fatal(err) }
    if err := viper.Unmarshal(&env); err != nil { log.Fatal(err) }
    return &env
}
```

## 패턴 2: MongoDB 초기화/종료

```go
func NewMongoDatabase(env *Env) mongo.Client {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    uri := fmt.Sprintf("mongodb://%s:%s", env.DBHost, env.DBPort)
    if env.DBUser != "" && env.DBPass != "" {
        uri = fmt.Sprintf("mongodb://%s:%s@%s:%s", env.DBUser, env.DBPass, env.DBHost, env.DBPort)
    }
    client, err := mongo.NewClient(uri)
    if err != nil { log.Fatal(err) }
    if err = client.Connect(ctx); err != nil { log.Fatal(err) }
    if err = client.Ping(ctx); err != nil { log.Fatal(err) }
    return client
}

func CloseMongoDBConnection(client mongo.Client) {
    if client == nil { return }
    if err := client.Disconnect(context.TODO()); err != nil { log.Fatal(err) }
    log.Println("Connection to MongoDB closed.")
}
```

## 패턴 3: Application

```go
type Application struct {
    Env   *Env
    Mongo mongo.Client
}

func App() Application {
    app := &Application{}
    app.Env = NewEnv()
    app.Mongo = NewMongoDatabase(app.Env)
    return *app
}

func (app *Application) CloseDBConnection() {
    CloseMongoDBConnection(app.Mongo)
}
```

## 규칙

- 환경 변수: `spf13/viper` + `.env` 파일, `mapstructure` 태그로 매핑
- 로딩 실패 시 `log.Fatal`로 즉시 종료
- MongoDB URI: DBUser/DBPass 존재 여부로 인증 포함 URI 분기
- 초기화: `Connect` → `Ping` 순서, 각 에러 `log.Fatal`
- 새 설정 추가 시: `Env` 구조체에 필드 + `mapstructure` 태그 추가
