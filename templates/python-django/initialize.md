# initialize.md — python-django (Conduit) 프로젝트 가이드

## 폴더 트리 구조

```
conduit/apps/
  core/           # TimestampedModel, ConduitJSONRenderer, 예외처리, 유틸
  authentication/ # JWT User 모델, 인증 API (__init__, backends, models,
                  #   renderers, serializers, signals, views, urls, migrations/)
  profiles/       # Profile, 팔로우/즐겨찾기 (exceptions, models, renderers,
                  #   serializers, views, urls, migrations/)
  articles/       # Article/Comment/Tag CRUD (__init__, models, renderers,
                  #   relations, serializers, signals, views, urls, migrations/)
```

---

## 새 도메인/기능 추가 시 생성 순서

1. `models.py` — `TimestampedModel` 상속, 필드/관계 정의
2. `migrations/` — `makemigrations` 실행
3. `serializers.py` — `ModelSerializer`, camelCase는 `SerializerMethodField`
4. `renderers.py` — `ConduitJSONRenderer` 서브클래스
5. `views.py` — `APIView`/`GenericAPIView`, `renderer_classes` 지정
6. `urls.py` — `urlpatterns` 등록
7. `__init__.py` (AppConfig) — signals 사용 시 `ready()`에 import 추가

---

## 구획별 핵심 패턴 스니펫

**core — TimestampedModel**
```python
class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True
        ordering = ['-created_at', '-updated_at']
```

**authentication — JWT User**
```python
class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    USERNAME_FIELD = 'email'
    @property
    def token(self): return self._generate_jwt_token()
```

**profiles — Profile**
```python
class Profile(TimestampedModel):
    user = models.OneToOneField('authentication.User', on_delete=models.CASCADE)
    follows = models.ManyToManyField('self', related_name='followed_by', symmetrical=False)
    favorites = models.ManyToManyField('articles.Article', related_name='favorited_by')
```

**articles — ArticleSerializer**
```python
class ArticleSerializer(serializers.ModelSerializer):
    author = ProfileSerializer(read_only=True)
    tagList = TagRelatedField(many=True, required=False, source='tags')
    def create(self, validated_data):
        author = self.context.get('author', None)
        tags = validated_data.pop('tags', [])
        article = Article.objects.create(author=author, **validated_data)
        for tag in tags: article.tags.add(tag)
        return article
```

---

## rules/ 및 skills/ 파일 안내

| 파일 | 용도 |
|------|------|
| `rules/conduit-apps-core.md` | 공통 인프라 규칙 (TimestampedModel, Renderer, 예외처리) |
| `rules/conduit-apps-authentication.md` | 인증/계정 규칙 (JWT, User, Serializer, View) |
| `rules/conduit-apps-profiles.md` | 프로필/팔로우 규칙 |
| `rules/conduit-apps-articles.md` | 게시글/댓글/태그 규칙 |
| `skills/add-article.md` | 게시글 관련 API 추가 흐름 |
| `skills/add-auth-endpoint.md` | 인증 API 엔드포인트 추가 흐름 |
| `skills/add-domain-app.md` | 신규 도메인 앱 전체 추가 흐름 |
