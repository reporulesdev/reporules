# About This Project

## 출처

**full-stack-fastapi-template** - Tiangolo(FastAPI 창시자)가 공개한 오픈소스 풀스택 템플릿.
- GitHub: https://github.com/fastapi/full-stack-fastapi-template
- 분석 도구: RepoRules v0.1.0 (2026-02-17 생성)
- 총 파일 수: 61개, 규칙 구획: 6개 (global 포함)

## 아키텍처 스타일

**모놀리식 백엔드 + 분리된 프론트엔드** 구조.

백엔드는 아래 레이어로 구성된다:

```
HTTP Request
    ↓
app/api/routes/{domain}.py   # 엔드포인트, 의존성 주입
    ↓
app/crud.py                  # DB 접근 로직
    ↓
app/models.py                # SQLModel 스키마 (DB + Pydantic 통합)
    ↓
app/core/db.py               # SQLAlchemy engine
    ↓
PostgreSQL
```

- **설정 중앙화**: `app/core/config.py`의 단일 `Settings` 인스턴스를 전역 공유
- **의존성 주입**: `app/api/deps.py`에서 `Annotated` 타입 별칭으로 DB 세션, 인증 의존성 정의
- **마이그레이션**: Alembic을 사용하여 `app/alembic/versions/`에 버전별 마이그레이션 파일 관리
- **이메일**: MJML 기반 이메일 템플릿을 `app/email-templates/`에서 관리
- **보안**: JWT(HS256) + pwdlib(Argon2/bcrypt) 조합

## 이 템플릿이 적합한 상황

| 상황 | 적합 여부 |
|---|---|
| FastAPI로 REST API + 인증 시스템 빠르게 구축 | 적합 |
| SQLModel + PostgreSQL 조합으로 타입 안전한 ORM 사용 | 적합 |
| 슈퍼유저/일반사용자 권한 구분이 필요한 서비스 | 적합 |
| 이메일 알림(비밀번호 초기화 등)이 필요한 서비스 | 적합 |
| 마이크로서비스 아키텍처 | 부적합 (모놀리식 구조) |
| 복잡한 도메인 로직이 많은 DDD 프로젝트 | 부적합 (단순 CRUD 중심) |

## 주요 기술 스택

- **웹 프레임워크**: FastAPI
- **ORM**: SQLModel (SQLAlchemy + Pydantic 통합)
- **DB**: PostgreSQL (`psycopg` 드라이버)
- **마이그레이션**: Alembic
- **인증**: JWT (PyJWT, HS256)
- **비밀번호**: pwdlib (Argon2Hasher + BcryptHasher)
- **설정**: pydantic-settings (`BaseSettings`)
- **이메일 템플릿**: MJML
- **코드 품질**: ruff, mypy, coverage, pytest
