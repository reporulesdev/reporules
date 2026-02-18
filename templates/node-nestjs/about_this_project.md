# About This Project

## 출처

[nestjs-realworld-example-app](https://github.com/lujakob/nestjs-realworld-example-app) 오픈소스 프로젝트 기반.
RealWorld 스펙(Conduit)을 NestJS + TypeORM으로 구현한 백엔드 예제 앱.

RepoRules v0.1.0이 자동 분석하여 생성한 템플릿입니다.

---

## 아키텍처 스타일

**도메인 모듈 분리형 (NestJS Module per Domain)**

- 각 도메인(article, user, profile, tag)이 독립 NestJS 모듈로 구성
- 각 모듈 내부: Controller → Service → Repository(TypeORM) 3계층
- 공유 유틸(ValidationPipe, BaseController)은 `src/shared/`에 분리
- 인증: JWT 미들웨어(`AuthMiddleware`)를 모듈 레벨에서 라우트에 바인딩
- 응답 구조: 항상 `{ domain: DomainData }` 형태의 래핑 RO(Response Object) 사용

```
HTTP Request
  → Controller (라우팅, 데코레이터, 응답 포맷)
    → Service (비즈니스 로직, 검증, 예외)
      → Repository/QueryBuilder (DB 접근)
        → Entity (DB 매핑)
  → Response: { domain: DomainData }
```

---

## 이 템플릿이 적합한 상황

- REST API 백엔드를 NestJS로 처음 구축하는 경우
- 도메인별 모듈 분리가 명확한 중소규모 서비스
- TypeORM + PostgreSQL/MySQL 조합의 CRUD API
- JWT 기반 인증이 필요한 프로젝트
- Swagger 문서화가 필요한 API 서버
- 팔로우/좋아요 등 관계 엔티티가 있는 소셜 기능이 포함된 서비스

---

## 분석된 모듈 구성

| 모듈 | 분류 | 설명 |
|------|------|------|
| src/article/ | decomposed | 게시글 + 댓글 + 즐겨찾기 |
| src/user/ | decomposed | 회원가입/로그인/프로필 수정 |
| src/profile/ | decomposed | 프로필 조회 + 팔로우/언팔로우 |
| src/tag/ | template | 태그 목록 조회 (단순 CRUD) |
| src/shared/ | small-segment | 공통 파이프, BaseController |
