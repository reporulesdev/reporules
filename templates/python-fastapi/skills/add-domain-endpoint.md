# Skill: 새 도메인 엔드포인트 추가

새 도메인 모델과 REST API 엔드포인트를 추가하는 전체 흐름.

## 파일 생성 순서

```
1. app/models.py                    - SQLModel 모델 + 스키마
2. app/alembic/versions/{id}_{name}.py - DB 마이그레이션
3. app/crud.py                      - CRUD 함수
4. app/api/routes/{domain}.py       - 라우터 및 엔드포인트
5. app/api/main.py                  - 라우터 등록
```

## Step 1: app/models.py

```python
class Post(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=255)
    owner_id: uuid.UUID = Field(foreign_key="user.id")

class PostCreate(SQLModel):
    title: str

class PostUpdate(SQLModel):
    title: str | None = None

class PostPublic(SQLModel):
    id: uuid.UUID
    title: str
    owner_id: uuid.UUID

class PostsPublic(SQLModel):
    data: list[PostPublic]
    count: int
```

## Step 2: app/alembic/versions/{id}_{name}.py

```python
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes

revision = "abc123def456"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "post",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

def downgrade():
    op.drop_table("post")
```

## Step 3: app/crud.py

```python
def create_post(*, session: Session, post_in: PostCreate, owner_id: uuid.UUID) -> Post:
    post = Post.model_validate(post_in, update={"owner_id": owner_id})
    session.add(post); session.commit(); session.refresh(post)
    return post
```

## Step 4: app/api/routes/posts.py

```python
router = APIRouter(prefix="/posts", tags=["posts"])

@router.get("/", response_model=PostsPublic)
def read_posts(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100):
    count = session.exec(select(func.count()).select_from(Post)).one()
    posts = session.exec(select(Post).offset(skip).limit(limit)).all()
    return PostsPublic(data=posts, count=count)

@router.post("/", response_model=PostPublic)
def create_post(*, session: SessionDep, current_user: CurrentUser, post_in: PostCreate):
    return crud.create_post(session=session, post_in=post_in, owner_id=current_user.id)

@router.delete("/{post_id}", response_model=Message)
def delete_post(session: SessionDep, current_user: CurrentUser, post_id: uuid.UUID):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not current_user.is_superuser and post.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(post); session.commit()
    return Message(message="Post deleted successfully")
```

## Step 5: app/api/main.py

```python
from app.api.routes import posts  # 추가
api_router.include_router(posts.router)  # 추가
```
