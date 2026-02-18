# skill: 게시글(Article) 관련 API 추가

이 프로젝트에서 게시글 도메인 기능을 추가하는 단계별 흐름입니다.

---

## 대상 흐름 예시
"게시글에 북마크(bookmark) 기능 추가" — POST/DELETE `/articles/<slug>/bookmark`

---

## 단계별 파일 생성 순서

### 1. models.py — 필드/관계 추가

```python
# conduit/apps/articles/models.py
class Article(TimestampedModel):
    # 기존 필드...
    # 새 관계는 profiles.Profile에 M2M 추가하는 방식 사용
```

Profile에 M2M 추가가 필요한 경우 `profiles/models.py`에 편의 메서드도 추가:
```python
def bookmark(self, article): self.bookmarks.add(article)
def has_bookmarked(self, article): return self.bookmarks.filter(pk=article.pk).exists()
```

### 2. migrations/ — 마이그레이션 생성

```bash
python manage.py makemigrations articles
python manage.py migrate
```

### 3. serializers.py — Serializer 필드 추가

camelCase 필드는 반드시 `SerializerMethodField` 사용:
```python
bookmarked = serializers.SerializerMethodField()

def get_bookmarked(self, instance):
    request = self.context.get('request', None)
    if request is None or not request.user.is_authenticated():
        return False
    return request.user.profile.has_bookmarked(instance)
```

### 4. views.py — 새 APIView 추가

즐겨찾기 패턴 동일하게 적용:
```python
class ArticlesBookmarkAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (ArticleJSONRenderer,)
    serializer_class = ArticleSerializer

    def post(self, request, article_slug=None):
        profile = self.request.user.profile
        try:
            article = Article.objects.get(slug=article_slug)
        except Article.DoesNotExist:
            raise NotFound('An article with this slug was not found.')
        profile.bookmark(article)
        s = self.serializer_class(article, context={'request': request})
        return Response(s.data, status=status.HTTP_201_CREATED)

    def delete(self, request, article_slug=None):
        profile = self.request.user.profile
        try:
            article = Article.objects.get(slug=article_slug)
        except Article.DoesNotExist:
            raise NotFound('An article with this slug was not found.')
        profile.unbookmark(article)
        s = self.serializer_class(article, context={'request': request})
        return Response(s.data, status=status.HTTP_200_OK)
```

### 5. urls.py — URL 등록

```python
url(r'^articles/(?P<article_slug>[-\w]+)/bookmark/?$',
    ArticlesBookmarkAPIView.as_view()),
```

---

## 핵심 패턴 참조

| 파일 | 참조 규칙 |
|------|-----------|
| models.py | `rules/conduit-apps-articles.md` — 모델 필드/관계 제약 |
| serializers.py | `rules/conduit-apps-articles.md` — ArticleSerializer 패턴 |
| views.py | `rules/conduit-apps-articles.md` — ArticlesFavoriteAPIView 패턴 |
| renderers.py | `rules/conduit-apps-core.md` — ConduitJSONRenderer 구조 |

---

## 체크리스트

- [ ] 모델 변경 후 migration 생성/적용
- [ ] Serializer에 `context={'request': request}` 전달
- [ ] 요청 바디 상위 키 `'article'` 유지 (생성/수정 시)
- [ ] renderer_classes에 `ArticleJSONRenderer` 지정
- [ ] URL에 trailing slash 처리 (`/?$`)
