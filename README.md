# RepoRules

코드베이스를 분석해서 코딩 에이전트(Claude Code, Cursor 등)에 바로 쓸 수 있는 rules/skills를 자동으로 뽑아주는 CLI입니다.

---

## 기능

- `reporules analyze` — 기존 코드베이스를 분석해서 rules/skills 생성
- `reporules template` — 사전 분석된 템플릿을 설치 (Go, Java, Kotlin, Node, Python)

---

## 이런 분께 권장합니다

- 새로 합류한 프로젝트에 에이전트 리소스를 만들고 싶은 경우
- 낯선 스택으로 프로젝트를 시작하는데 기반 리소스가 필요한 경우

`.claude` / `.cursor` 하위에 아무것도 없는 상태의 초기 세팅을 돕습니다.

---

## 사용법

### analyze

기존 코드베이스를 분석해서 rules와 skills를 생성합니다.

```bash
# 현재 디렉토리 분석
reporules analyze

# 특정 디렉토리 분석
reporules analyze ./my-project

```

완료 후 출력 디렉토리 구조:

```
.reporules/
  rules/        # 모듈별 코딩 패턴 가이드
  skills/       # 단계별 작업 가이드 (add-domain 등)
  USAGE.md      # 생성된 파일 목록 및 적용 방법
  report.md     # 분석 리포트
```

#### --include-small

파일 수가 적어 기본적으로 건너뛰는 소규모 모듈도 분석합니다.
규칙이 있을 것 같은 작은 모듈이 있는 경우 사용하세요.

```bash
reporules analyze --include-small
```

---

### template

언어와 아키텍처를 선택하면 사전 분석된 rules/skills를 설치합니다.
인터랙티브 UI로 동작합니다.

```bash
reporules template
```

지원 템플릿:

| 언어 | 템플릿 |
|------|--------|
| Go | Clean Architecture, REST API |
| Java | Hexagonal, Layered, Pet Clinic |
| Kotlin | Hexagonal, Pet Clinic |
| Node | NestJS, CLI Tool |
| Python | FastAPI, Django REST Framework |

---

## 설치

```bash
# 압축 해제 후 디렉토리 이동
cd reporules-v0.1.0

# 의존성 설치 및 빌드
npm install
npm run build
```

alias 등록 (zsh 기준):

```bash
echo "alias reporules='$(pwd)/dist/console/index.js'" >> ~/.zshrc
source ~/.zshrc
```

실행 권한이 없는 경우:

```bash
chmod +x dist/console/index.js
```

API 키 설정:

```bash
export OPENAI_API_KEY="your-api-key"
```

---

## 원리

1. 프로젝트 tree와 빌드 파일(`build.gradle`, `package.json` 등)을 읽어 프로젝트 구성 파악
2. 파일 네이밍과 경로 패턴의 반복을 통해 주요 패키지/폴더 단위로 세그먼트 분리
3. 각 세그먼트에서 대표 파일을 샘플링
4. 샘플링 결과를 바탕으로 패턴과 규칙을 rules/skills로 생성

---

## 라이선스

MIT
