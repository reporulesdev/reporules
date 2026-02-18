# Skill: DB 마이그레이션 추가

기존 테이블에 컬럼 추가, 인덱스 변경, 테이블 수정 등 스키마 변경 작업 흐름.

## 언제 사용하나

- `app/models.py`에서 기존 SQLModel 모델에 필드를 추가/수정/삭제할 때
- 새 인덱스나 제약 조건이 필요할 때
- 기존 마이그레이션을 되돌려야 할 때 (downgrade)

## 단계별 작업 순서

```
1. app/models.py        - 모델 변경
2. alembic 명령 실행     - 버전 파일 자동 생성
3. versions/{id}_{name}.py - 내용 검토 및 수정
4. alembic upgrade head  - DB에 적용
```

---

## Step 1: app/models.py - 모델 변경

```python
# 기존
class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str

# 변경 후 - created_at 필드 추가
class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str
    created_at: datetime | None = Field(default=None)
```

---

## Step 2: 마이그레이션 파일 자동 생성

```bash
# 자동 생성 (권장)
alembic revision --autogenerate -m "add_created_at_to_user"

# 수동 생성 (비어있는 파일)
alembic revision -m "add_created_at_to_user"
```

생성된 파일 위치: `app/alembic/versions/{revision_id}_add_created_at_to_user.py`

---

## Step 3: 생성된 파일 구조 확인

```python
"""Add created_at to user

Revision ID: fe56fa70289e
Revises: 1a31ce608336
Create Date: 2026-02-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes

# revision identifiers - imports 직후 선언 필수
revision = "fe56fa70289e"
down_revision = "1a31ce608336"  # 이전 revision ID
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("user", "created_at")
```

### 주요 op 패턴

```python
# 컬럼 추가
op.add_column("table_name", sa.Column("col", sa.String(), nullable=True))

# 컬럼 삭제
op.drop_column("table_name", "col")

# 인덱스 추가
op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

# 인덱스 삭제
op.drop_index(op.f("ix_user_email"), table_name="user")

# 테이블 생성
op.create_table(
    "post",
    sa.Column("id", sa.Uuid(), nullable=False),
    sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.PrimaryKeyConstraint("id"),
)

# 테이블 삭제
op.drop_table("post")
```

---

## Step 4: DB에 적용

```bash
# 최신 버전으로 업그레이드
alembic upgrade head

# 특정 revision으로 업그레이드
alembic upgrade fe56fa70289e

# 한 단계 롤백
alembic downgrade -1

# 현재 상태 확인
alembic current
```

---

## 주의사항

- `env.py`의 `target_metadata = SQLModel.metadata` 설정 확인 (models import 필수)
- `compare_type=True`가 env.py에 설정되어 있어야 컬럼 타입 변경 감지 가능
- `down_revision`이 실제 이전 revision ID와 일치하는지 반드시 확인
