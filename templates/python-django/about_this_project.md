# about_this_project.md

## 출처

이 템플릿은 [django-realworld-example-app](https://github.com/gothinkster/django-realworld-example-app) 오픈소스 프로젝트를 분석하여 생성되었습니다.

- RealWorld 스펙(Conduit)을 Django REST framework로 구현한 백엔드 예제입니다.
- RepoRules v0.1.0이 프로젝트를 분석하여 4개 구획(articles, authentication, core, profiles)의 규칙을 추출했습니다.

---

## 아키텍처 스타일

**Django Apps 기반 도메인 분리 구조** (small-segment 패턴)

```
conduit/
  apps/
    core/          # 공통 인프라 (TimestampedModel, JSONRenderer, 예외처리)
    authentication/ # 사용자 인증 (JWT, 커스텀 User 모델)
    profiles/      # 프로필, 팔로우, 즐겨찾기
    articles/      # 게시글, 댓글, 태그
```

핵심 패턴:
- 각 앱은 `models.py`, `serializers.py`, `views.py`, `urls.py`, `renderers.py`로 구성
- 모든 모델은 `core.TimestampedModel` 상속
- 응답은 앱별 `{Domain}JSONRenderer`가 최상위 키로 래핑 (`{"article": {...}}`)
- 인증은 `Authorization: Token <jwt>` 헤더 방식
- Serializer의 camelCase 필드는 `SerializerMethodField` 또는 `source` 사용

---

## 적합한 상황

- REST API 전용 Django 백엔드 (템플릿/뷰 없음)
- JWT 기반 인증이 필요한 프로젝트
- 도메인별로 앱을 분리하고 싶은 중소규모 API 서버
- RealWorld/Conduit 스펙을 참고로 Django DRF 구조를 학습하거나 새 프로젝트를 시작할 때
- 팔로우, 즐겨찾기, 태그 등 소셜 기능이 있는 콘텐츠 플랫폼
