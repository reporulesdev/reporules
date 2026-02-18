---
paths:
  - "app/api/**/*"
---

# app/api

## 책임
HTTP 엔드포인트 정의, 의존성 주입, 인증/권한 처리, 요청/응답 직렬화를 담당한다.

## 연관관계
```
HTTP Request → app/api/routes/{domain}.py
                    ↓ SessionDep (deps.py)
               app/crud.py → app/models.py
                    ↓
               app/core/security.py (인증)
```

## Naming

- 라우터 파일: 도메인 단위 복수형 소문자 스네이크 케이스 (`items.py`, `users.py`)
- 의존성 타입 별칭: `SessionDep`, `TokenDep`, `CurrentUser` (`deps.py` 정의)

## Constraints

### 1. 라우터 등록 (app/api/main.py)

```python
api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(items.router)
if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
```

새 라우터 추가: `app/api/routes/{name}.py` 생성 후 `main.py`에 등록.

### 2. APIRouter 선언

```python
router = APIRouter(prefix="/items", tags=["items"])  # 일반 도메인
router = APIRouter(tags=["login"])                    # 인증 (prefix 없음)
router = APIRouter(tags=["private"], prefix="/private")  # 내부 전용
```

### 3. 의존성 (deps.py)

```python
def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]
CurrentUser = Annotated[User, Depends(get_current_user)]
```

### 4. 인증 패턴

```python
def get_current_user(session: SessionDep, token: TokenDep) -> User:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
    user = session.get(User, TokenPayload(**payload).sub)
    if not user or not user.is_active:
        raise HTTPException(status_code=404)
    return user

def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return current_user
```

슈퍼유저 전용: `dependencies=[Depends(get_current_active_superuser)]`

### 5. SQLModel CRUD 패턴

```python
# 목록 조회
count = session.exec(select(func.count()).select_from(Item)).one()
items = session.exec(select(Item).order_by(col(Item.created_at).desc()).offset(skip).limit(limit)).all()

# 업데이트
item.sqlmodel_update(item_in.model_dump(exclude_unset=True))
session.add(item); session.commit(); session.refresh(item)

# 삭제 (연관 데이터 포함)
session.exec(delete(Item).where(col(Item.owner_id) == user_id))
session.delete(user); session.commit()
```

### 6. 에러 처리 / 응답 모델

- 400: 규칙 위반, 403: 권한 부족, 404: 없음, 409: 중복
- 보안: 비밀번호 복구 시 이메일 존재 여부와 무관하게 동일 메시지 반환
- 슈퍼유저는 자기 자신 삭제 불가 (403)

```python
@router.get("/", response_model=ItemsPublic)
def read_items(...): return ItemsPublic(data=items, count=count)

@router.get("/health-check/")
async def health_check() -> bool: return True
```
