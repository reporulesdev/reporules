---
paths:
  - "app/alembic/**/*"
---

# app/alembic

## 책임
SQLModel 모델 변경사항을 DB에 반영하는 버전별 마이그레이션 스크립트를 관리한다.

## 연관관계
```
app/models.py (SQLModel 정의)
    ↓ alembic revision --autogenerate
app/alembic/versions/{id}_{name}.py
    ↓ alembic upgrade head
PostgreSQL DB
```

`env.py`는 `settings.SQLALCHEMY_DATABASE_URI`와 `SQLModel.metadata`를 참조한다.

## Naming

- 버전 파일: `{revision_id}_{snake_case_description}.py`
  - 예: `e2412789c190_initialize_models.py`
  - 예: `fe56fa70289e_add_created_at_to_user_and_item.py`

## Constraints

### 1. 버전 파일 상단 구조

```python
"""Add created_at to User and Item

Revision ID: fe56fa70289e
Revises: 1a31ce608336
Create Date: 2026-01-23 15:50:37.171462

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes

# revision identifiers, used by Alembic.
revision = "fe56fa70289e"
down_revision = "1a31ce608336"
branch_labels = None
depends_on = None
```

- `revision`, `down_revision`, `branch_labels`, `depends_on`은 import 직후 모듈 레벨에 선언

### 2. upgrade / downgrade 함수

- 모든 파일에 `upgrade()` / `downgrade()` 두 함수 모두 정의 (인자 없음)
- `op.*` 연산만 사용

```python
def upgrade():
    op.add_column("item", sa.Column("created_at", sa.DateTime(timezone=True)))
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

def downgrade():
    op.drop_column("item", "created_at")
    op.drop_table("user")
```

### 3. env.py - DB URL 및 메타데이터

```python
from app.models import SQLModel  # noqa
from app.core.config import settings  # noqa

target_metadata = SQLModel.metadata

def get_url():
    return str(settings.SQLALCHEMY_DATABASE_URI)
```

### 4. env.py - compare_type=True 필수

offline 및 online 모드 모두 `compare_type=True` 설정:

```python
# offline
context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)

# online
context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
```

### 5. env.py - 로깅 설정

```python
config = context.config
assert config.config_file_name is not None
fileConfig(config.config_file_name)
```

### 6. 공통 import / Mako 템플릿

```python
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes  # SQLModel 타입 지원 필수
# from sqlalchemy.dialects import postgresql  # 필요 시 추가
```

`script.py.mako`: `import sqlmodel.sql.sqltypes` 포함 필수 (자동 생성 파일 기반).
