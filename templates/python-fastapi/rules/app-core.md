---
paths:
  - "app/core/**/*"
---

# app/core

## 책임
애플리케이션 전역 설정, DB 연결 및 초기화, JWT/비밀번호 보안 유틸리티를 제공한다.

## 연관관계
```
.env 파일 → config.py (Settings) → 모든 모듈
                ↓
           db.py (engine, init_db) → SQLModel
                ↓
           security.py (JWT, 비밀번호 해시) → app/api/deps.py
```

## Naming

- 설정 클래스: `Settings` (`config.py`), DB 엔진: `engine` (`db.py`), JWT 상수: `ALGORITHM` (`security.py`)

## Constraints

### 1. 설정 - 단일 인스턴스 전역 공유

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_ignore_empty=True, extra="ignore")
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)

settings = Settings()  # type: ignore
# 사용: from app.core.config import settings
```

### 2. 파생 설정값 - computed_field + property

```python
@computed_field  # type: ignore[prop-decorator]
@property
def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
    return PostgresDsn.build(scheme="postgresql+psycopg", username=self.POSTGRES_USER,
        password=self.POSTGRES_PASSWORD, host=self.POSTGRES_SERVER, path=self.POSTGRES_DB)

@computed_field  # type: ignore[prop-decorator]
@property
def all_cors_origins(self) -> list[str]:
    return [str(o).rstrip("/") for o in self.BACKEND_CORS_ORIGINS] + [self.FRONTEND_HOST]
```

### 3. 설정 후처리 - model_validator / 보안 검증

```python
@model_validator(mode="after")
def _enforce_non_default_secrets(self) -> Self:
    self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
    return self

def _check_default_secret(self, var_name: str, value: str | None) -> None:
    if value == "changethis":
        if self.ENVIRONMENT == "local":
            warnings.warn(f'{var_name} is "changethis"', stacklevel=1)
        else:
            raise ValueError(f'{var_name} must be changed for deployment')
```

### 4. DB 초기화 / 보안

```python
# db.py
engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

def init_db(session: Session) -> None:
    user = session.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).first()
    if not user:
        crud.create_user(session=session, user_create=UserCreate(
            email=settings.FIRST_SUPERUSER, password=settings.FIRST_SUPERUSER_PASSWORD, is_superuser=True))

# security.py
password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))
ALGORITHM = "HS256"

def verify_password(plain: str, hashed: str) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain, hashed)

def get_password_hash(password: str) -> str:
    return password_hash.hash(password)

def create_access_token(subject: str | Any, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    return jwt.encode({"exp": expire, "sub": str(subject)}, settings.SECRET_KEY, algorithm=ALGORITHM)
```

### 5. CORS 파싱

```python
def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",") if i.strip()]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)

BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = []
```
