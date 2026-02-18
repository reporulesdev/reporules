---
paths:
  - "scripts/**/*"
---

# scripts

## 책임
개발 워크플로우(서버 시작 전 처리, 테스트, 린팅, 포맷팅)를 자동화하는 쉘 스크립트를 제공한다.

## 연관관계
```
Docker / CI 파이프라인
    ↓
scripts/prestart.sh  → app/backend_pre_start.py → DB 준비
                     → alembic upgrade head      → 마이그레이션
scripts/test.sh      → scripts/tests-start.sh → pytest + coverage
scripts/lint.sh      → ruff check + mypy
scripts/format.sh    → ruff format
```

## Naming

- `kebab-case` 파일명, 실행 목적 직접 표현
  - `prestart.sh`, `test.sh`, `tests-start.sh`, `lint.sh`, `format.sh`

## Constraints

### 1. Shebang 필수

```bash
#!/bin/sh -e        # sh 스크립트 (-e 옵션 필수)
#!/usr/bin/env bash  # bash 스크립트
#! /usr/bin/env bash # bash 스크립트 (공백 있는 변형도 사용)
```

### 2. set -e (즉시 종료)

`format.sh`를 제외한 모든 스크립트에 `set -e` 사용:

```bash
#!/usr/bin/env bash
set -e
set -x
mypy app
```

### 3. set -x (실행 로깅)

모든 스크립트에 `set -x` 사용:

```bash
#!/bin/sh -e
set -x
ruff check app scripts --fix
```

### 4. 공통 도구 및 경로

- Python 작업 디렉터리: `app`
- 테스트 디렉터리: `tests/`
- 코드 품질: `ruff`, `mypy`
- 테스트/커버리지: `coverage`, `pytest`
- 마이그레이션: `alembic`

```bash
# prestart.sh
python app/backend_pre_start.py
alembic upgrade head
python app/initial_data.py

# test.sh
coverage run -m pytest tests/
coverage report

# lint.sh
ruff check app
ruff format app --check
mypy app
```

### 5. 스크립트 간 재사용

다른 스크립트 호출 시 `bash scripts/<script>.sh "$@"` 형식으로 인자 전달:

```bash
#! /usr/bin/env bash
set -e
set -x
bash scripts/test.sh "$@"
```
