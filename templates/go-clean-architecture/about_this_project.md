# About This Project

## 출처

- **오픈소스**: [amitshekhariitbhu/go-backend-clean-architecture](https://github.com/amitshekhariitbhu/go-backend-clean-architecture)
- **분석 도구**: RepoRules v0.1.0
- **분석 일시**: 2026-02-18

이 템플릿은 위 오픈소스 프로젝트를 RepoRules로 분석하여 생성된 규칙 세트입니다.

## 아키텍처 스타일

**Clean Architecture** (Robert C. Martin)를 Go + Gin + MongoDB 스택으로 구현한 프로젝트입니다.

레이어 구조 (의존성 방향: 바깥 → 안쪽):

```
[api] → [usecase] → [domain] ← [repository]
                                     ↑
                                  [mongo]
         [bootstrap] (초기화, 조립)
         [internal]  (공통 유틸)
```

핵심 원칙:
- `domain/`은 어떤 내부 패키지에도 의존하지 않음 (표준 라이브러리 + 외부 라이브러리만 허용)
- 인터페이스는 `domain/`에 정의, 구현체는 각 외부 레이어에 위치
- `api/route/`에서 Repository → Usecase → Controller 순으로 의존성 조립
- `mongo/` 패키지가 드라이버를 인터페이스로 감싸 테스트 가능성 확보

## 이 템플릿이 적합한 상황

- Go로 REST API 백엔드를 처음 구축하는 팀
- MongoDB를 데이터 저장소로 사용하는 프로젝트
- 레이어 간 의존성 역전(DIP)을 명시적으로 관리하고 싶을 때
- 유닛 테스트를 레이어별로 격리하여 작성하고 싶을 때 (mockery 기반 mock 활용)
- Gin 프레임워크 기반의 소규모~중규모 서비스

## 포함된 도메인 예시

프로젝트에 구현된 도메인: `User`, `Task`, `Profile`, 인증 (`Login`, `Signup`, `RefreshToken`)
