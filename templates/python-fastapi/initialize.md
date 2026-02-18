# python-fastapi 프로젝트 초기화 가이드

## 폴더 트리 구조

```
project/
├── app/
│   ├── api/
│   │   ├── main.py          # api_router 통합 등록
│   │   ├── deps.py          # 공통 의존성 (SessionDep, CurrentUser 등)
│   │   └── routes/
│   │       ├── login.py
│   │       ├── users.py
│   │       ├── items.py
│   │       ├── utils.py
│   │       └── private.py   # 로컬 환경 전용
│   ├── core/
│   │   ├── config.py        # Settings (pydantic BaseSettings)
│   │   ├── db.py            # engine, init_db
│   │   └── security.py      # JWT, 비밀번호 해시
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── email-templates/
│   │   └── *.mjml           # MJML 이메일 템플릿
│   ├── models.py            # SQLModel 모델 정의
│   ├── crud.py              # DB CRUD 함수
│   └── main.py              # FastAPI 앱 진입점
├── scripts/
│   ├── prestart.sh
│   ├── test.sh
│   └── lint.sh
└── tests/
```

## 새 도메인/기능 추가 시 생성 순서

1. `app/models.py` - SQLModel 모델 정의 (Base, Create, Update, Public 스키마)
2. `app/alembic/versions/{id}_{name}.py` - DB 마이그레이션 스크립트
3. `app/crud.py` - CRUD 함수 추가
4. `app/api/routes/{domain}.py` - APIRouter 및 엔드포인트 정의
5. `app/api/main.py` - api_router에 새 라우터 등록

## 구획별 핵심 코드 스니펫

### app/core/config.py
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_ignore_empty=True, extra="ignore")
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)

settings = Settings()
```

### app/api/deps.py
```python
SessionDep = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
```

### app/api/routes/{domain}.py
```python
router = APIRouter(prefix="/items", tags=["items"])

@router.get("/", response_model=ItemsPublic)
def read_items(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100):
    count = session.exec(select(func.count()).select_from(Item)).one()
    items = session.exec(select(Item).offset(skip).limit(limit)).all()
    return ItemsPublic(data=items, count=count)
```

### app/alembic/versions/{id}_{name}.py
```python
revision = "fe56fa70289e"
down_revision = "1a31ce608336"

def upgrade():
    op.add_column("item", sa.Column("created_at", sa.DateTime(timezone=True)))

def downgrade():
    op.drop_column("item", "created_at")
```

## 파일 목록 및 용도

### rules/
| 파일 | 경로 적용 | 용도 |
|---|---|---|
| `app-api.md` | `app/api/**/*` | 라우터, 의존성, 에러 처리 패턴 |
| `app-core.md` | `app/core/**/*` | 설정, DB 초기화, 보안 패턴 |
| `app-alembic.md` | `app/alembic/**/*` | 마이그레이션 파일 작성 규칙 |
| `app-email-templates.md` | `app/email-templates/**/*` | MJML 이메일 템플릿 구조 |
| `scripts.md` | `scripts/**/*` | 쉘 스크립트 작성 규칙 |

### skills/
| 파일 | 용도 |
|---|---|
| `add-domain-endpoint.md` | 새 도메인(모델+라우터) 추가 전체 흐름 |
| `add-db-migration.md` | Alembic 마이그레이션 파일 추가 흐름 |
