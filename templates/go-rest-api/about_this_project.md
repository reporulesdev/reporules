# About This Project

## 출처

- 원본 프로젝트: `rameshsunkara/go-rest-api-example` (GitHub)
- RepoRules v0.1.0 으로 분석 생성 (2026-02-18)
- 모듈 경로: `github.com/rameshsunkara/go-rest-api-example`

## 아키텍처 스타일

**Layered REST API (Go + Gin + MongoDB)**

```
HTTP Request
    ↓
middleware/     (Auth, ReqID, QueryParams, Logging, ResponseHeaders)
    ↓
handlers/       (OrdersHandler, StatusHandler, SeedHandler)
    ↓
db/             (OrdersRepo - implements OrdersDataService interface)
    ↓
MongoDB         (via pkg/mongodb ConnectionManager)
```

- **models/data**: MongoDB 매핑 내부 도메인 모델 (`bson`/`json` 태그)
- **models/external**: HTTP 요청/응답 전용 모델 (`binding` 태그, ID/시간은 string 노출)
- **internal/errors**: 도메인 에러 코드 상수 집중 관리
- **internal/utilities**: 시간 포맷, 가격 계산, 개발 모드 판별 등 순수 유틸
- **pkg/**: logger (zerolog 기반 인터페이스), mongodb (Functional Options 패턴), flightrecorder (느린 요청 트레이스)
- **internal/server**: WebRouter + Start (graceful shutdown)

## 이 템플릿이 적합한 상황

- MongoDB를 주 데이터베이스로 사용하는 Go REST API
- 인터페이스 + 생성자 nil-check 패턴으로 의존성을 명시적으로 관리하는 프로젝트
- 도메인별 에러 상수와 `external.APIError` 공통 응답을 표준화하려는 팀
- 개발/운영 모드 분리(pprof, seed 엔드포인트 등)가 필요한 서비스
- 느린 요청 트레이스 캡처와 구조화 로깅(zerolog)이 필요한 환경
